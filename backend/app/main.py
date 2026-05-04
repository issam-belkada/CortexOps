import asyncio
import requests
import time
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from app.ml_service import detector
from app.log_service import log_analyzer
from app.database import SessionLocal, AnomalyRecord, InstanceStatus, init_db
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────────────────────────────────────────────────────────
# CRITICAL: Define client lists BEFORE routes and lifespan so every coroutine
# shares the exact same list object.
# ─────────────────────────────────────────────────────────────────────────────
connected_clients: list[WebSocket] = []
connected_clients_anomalies: list[WebSocket] = []
connected_clients_combined: list[WebSocket] = []

init_db()

# ─────────────────────────────────────────────────────────────────────────────
# Prometheus config
# ─────────────────────────────────────────────────────────────────────────────
PROMETHEUS_URL = "http://localhost:9090/api/v1/query"

QUERIES = {
    "cpu": 'sum by(instance) (irate(node_cpu_seconds_total{mode!="idle"}[1m])) / count by(instance) (node_cpu_seconds_total{mode="idle"}) * 100',
    "ram": '100 * (1 - (node_memory_MemFree_bytes / node_memory_MemTotal_bytes))',
    "disk": 'max by(instance) (100 - (node_filesystem_avail_bytes{device=~"/dev/.*", fstype!="tmpfs"} * 100 / node_filesystem_size_bytes{device=~"/dev/.*", fstype!="tmpfs"}))',
    "network": 'sum by(instance) (rate(node_network_receive_bytes_total[1m]))'
}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: safe broadcast — removes dead clients without crashing the loop
# ─────────────────────────────────────────────────────────────────────────────
async def broadcast(clients: list[WebSocket], payload: dict) -> None:
    dead: list[WebSocket] = []
    for client in clients[:]:
        try:
            await client.send_json(payload)
        except Exception as exc:
            print(f"[WS] Dead client removed ({exc.__class__.__name__})")
            dead.append(client)
    for d in dead:
        if d in clients:
            clients.remove(d)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan: start background task
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Lifespan] Starting background monitoring task...")
    task = asyncio.create_task(background_monitoring())
    yield
    print("[Lifespan] Shutting down...")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket routes
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws/fleet")
async def websocket_fleet_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"[WS/fleet] Client connected. Total: {len(connected_clients)}")
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        print(f"[WS/fleet] Client disconnected. Total: {len(connected_clients)}")


@app.websocket("/ws/anomalies")
async def websocket_anomalies_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients_anomalies.append(websocket)
    print(f"[WS/anomalies] Client connected. Total: {len(connected_clients_anomalies)}")
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if websocket in connected_clients_anomalies:
            connected_clients_anomalies.remove(websocket)
        print(f"[WS/anomalies] Client disconnected. Total: {len(connected_clients_anomalies)}")


@app.websocket("/ws/combined")
async def websocket_combined_endpoint(websocket: WebSocket):
    """Single unified WebSocket - carries both fleet and anomaly updates."""
    await websocket.accept()
    connected_clients_combined.append(websocket)
    print(f"[WS/combined] Client connected. Total: {len(connected_clients_combined)}")

    # Send an immediate fleet snapshot so the UI doesn't wait up to 3s
    try:
        fleet_snapshot = await compute_fleet_analysis()
        await websocket.send_json({"type": "fleet", "data": fleet_snapshot})
        print("[WS/combined] Sent initial fleet snapshot to new client.")
    except Exception as e:
        print(f"[WS/combined] Failed to send initial snapshot: {e}")

    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if websocket in connected_clients_combined:
            connected_clients_combined.remove(websocket)
        print(f"[WS/combined] Client disconnected. Total: {len(connected_clients_combined)}")


# ─────────────────────────────────────────────────────────────────────────────
# Metric fetching
# ─────────────────────────────────────────────────────────────────────────────
def fetch_metric(name: str, query: str) -> dict:
    try:
        response = requests.get(PROMETHEUS_URL, params={"query": query}, timeout=2)
        results = response.json().get("data", {}).get("result", [])
        return {name: {res["metric"]["instance"]: float(res["value"][1]) for res in results}}
    except Exception as e:
        print(f"[Prometheus] Error fetching '{name}': {e}")
        return {name: {}}


async def fetch_metric_async(name: str, query: str) -> dict:
    return await asyncio.to_thread(fetch_metric, name, query)


# ─────────────────────────────────────────────────────────────────────────────
# Fleet analysis
# ─────────────────────────────────────────────────────────────────────────────
def compute_fleet_analysis_sync() -> dict:
    all_data: dict = {}
    for name, query in QUERIES.items():
        all_data.update(fetch_metric(name, query))

    instances = set().union(*(m.keys() for m in all_data.values())) if all_data else set()

    fleet_analysis = []
    db = SessionLocal()
    try:
        for inst in instances:
            current_metrics = [
                all_data["cpu"].get(inst, 0),
                all_data["ram"].get(inst, 0),
                all_data["disk"].get(inst, 0),
                all_data["network"].get(inst, 0),
            ]

            instance_status = db.query(InstanceStatus).filter_by(instance=inst).first()
            status = instance_status.status if instance_status else "Unknown"
            reason = instance_status.reason if instance_status else "No data yet"

            logs = log_analyzer.get_logs_for_instance(inst)

            fleet_analysis.append({
                "instance": inst,
                "metrics": {
                    "cpu":     round(current_metrics[0], 2),
                    "ram":     round(current_metrics[1], 2),
                    "disk":    round(current_metrics[2], 2),
                    "network": round(current_metrics[3], 2),
                },
                "status": status,
                "reason": reason,
                "recent_logs": logs,
            })
    finally:
        db.close()

    return {
        "timestamp": time.time(),
        "summary": {
            "total_instances": len(fleet_analysis),
            "anomalies":       sum(1 for x in fleet_analysis if x["status"] == "Anomalous"),
            "learning_phase":  sum(1 for x in fleet_analysis if x["status"] == "Learning"),
        },
        "fleet": fleet_analysis,
    }


async def compute_fleet_analysis() -> dict:
    return await asyncio.to_thread(compute_fleet_analysis_sync)


# ─────────────────────────────────────────────────────────────────────────────
# Monitoring cycle
#
# KEY FIX: Returns plain dicts instead of SQLAlchemy ORM objects.
# Accessing ORM attributes after db.close() raises DetachedInstanceError,
# which was silently killing the background loop after the very first cycle.
# db.flush() is called before close so that auto-generated fields (id,
# timestamp) are populated and can be serialized while the session is open.
# ─────────────────────────────────────────────────────────────────────────────
def process_monitoring_cycle(instances, all_data) -> list[dict]:
    db = SessionLocal()
    new_anomalies: list[dict] = []

    try:
        for inst in instances:
            current_metrics = [
                all_data["cpu"].get(inst, 0),
                all_data["ram"].get(inst, 0),
                all_data["disk"].get(inst, 0),
                all_data["network"].get(inst, 0),
            ]

            logs = log_analyzer.get_logs_for_instance(inst)
            log_messages = [l["message"] for l in logs if "message" in l]

            status, reason = detector.analyze(inst, current_metrics, logs=log_messages)

            # Upsert InstanceStatus
            instance_status = db.query(InstanceStatus).filter_by(instance=inst).first()
            if instance_status:
                instance_status.status = status
                instance_status.reason = reason
            else:
                instance_status = InstanceStatus(instance=inst, status=status, reason=reason)
                db.add(instance_status)

            if status == "Anomalous":
                try:
                    trigger, predicted_cause = reason.split(" -> Cause: ")
                except ValueError:
                    trigger, predicted_cause = "Unknown", reason

                log_str = " | ".join(log_messages[:5])

                new_event = AnomalyRecord(
                    instance=inst,
                    cpu_val=round(current_metrics[0], 2),
                    ram_val=round(current_metrics[1], 2),
                    disk_val=round(current_metrics[2], 2),
                    net_val=round(current_metrics[3], 2),
                    trigger_type=trigger,
                    cause=predicted_cause,
                    logs=log_str,
                )
                db.add(new_event)

                # flush() writes to DB and populates server-generated fields
                # (id, timestamp) while the session is still open so we can
                # safely read them below.
                db.flush()

                # Serialize to a plain dict NOW — before db.close()
                new_anomalies.append({
                    "id":           new_event.id,
                    "timestamp":    new_event.timestamp.isoformat() if new_event.timestamp else None,
                    "instance":     new_event.instance,
                    "cpu_val":      new_event.cpu_val,
                    "ram_val":      new_event.ram_val,
                    "disk_val":     new_event.disk_val,
                    "net_val":      new_event.net_val,
                    "trigger_type": new_event.trigger_type,
                    "cause":        new_event.cause,
                    "logs":         new_event.logs,
                })

        db.commit()
    except Exception as exc:
        print(f"[Monitor] DB error in monitoring cycle: {exc}")
        db.rollback()
        raise
    finally:
        db.close()  # safe — all anomalies already serialized to plain dicts

    return new_anomalies


# ─────────────────────────────────────────────────────────────────────────────
# Background monitoring loop
#
# KEY FIX: Wrapped entire body in try/except so any unhandled exception logs
# the error and continues — instead of silently killing the while True loop.
# ─────────────────────────────────────────────────────────────────────────────
async def background_monitoring():
    print("[Monitor] Background loop started.")
    loop_count = 0

    while True:
        loop_count += 1
        try:
            # 1. Collect metrics in parallel
            metric_results = await asyncio.gather(
                *(fetch_metric_async(name, query) for name, query in QUERIES.items())
            )
            all_data: dict = {}
            for result in metric_results:
                all_data.update(result)

            instances = set().union(*(m.keys() for m in all_data.values())) if all_data else set()

            # 2. AI analysis + DB writes — returns plain dicts, never ORM objects
            try:
                new_anomalies: list[dict] = await asyncio.to_thread(
                    process_monitoring_cycle, instances, all_data
                )
            except Exception as e:
                print(f"[Monitor] Cycle error (loop continues): {e}")
                new_anomalies = []

            # 3. Broadcast anomalies — already plain dicts, no ORM access needed
            for anomaly_data in new_anomalies:
                await broadcast(connected_clients_anomalies, anomaly_data)
                await broadcast(connected_clients_combined, {"type": "anomalies", "data": anomaly_data})

            # 4. Compute fresh fleet snapshot
            fleet_data = await compute_fleet_analysis()

            print(
                f"[Monitor] Loop #{loop_count} | "
                f"instances={len(instances)} | "
                f"new_anomalies={len(new_anomalies)} | "
                f"combined_clients={len(connected_clients_combined)} | "
                f"fleet_clients={len(connected_clients)}"
            )

            # 5. Broadcast fleet
            await broadcast(connected_clients, fleet_data)
            await broadcast(connected_clients_combined, {"type": "fleet", "data": fleet_data})

        except asyncio.CancelledError:
            print("[Monitor] Loop cancelled — shutting down.")
            raise  # let lifespan handle it cleanly
        except Exception as exc:
            # Log and survive — the loop must never die from a single bad cycle
            print(f"[Monitor] !! Unhandled error in loop #{loop_count}: {exc.__class__.__name__}: {exc}")

        await asyncio.sleep(3)


# ─────────────────────────────────────────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/v1/fleet/intelligence")
async def get_fleet_intelligence():
    return await compute_fleet_analysis()


@app.get("/api/v1/fleet/history")
async def get_fleet_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = SessionLocal()
    try:
        total_records = db.query(AnomalyRecord).count()
        total_pages = (total_records + page_size - 1) // page_size if total_records > 0 else 0
        offset = (page - 1) * page_size

        records = (
            db.query(AnomalyRecord)
            .order_by(AnomalyRecord.timestamp.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        return {
            "page":          page,
            "page_size":     page_size,
            "total_records": total_records,
            "total_pages":   total_pages,
            "history": [
                {
                    "id":           r.id,
                    "timestamp":    r.timestamp.isoformat() if r.timestamp else None,
                    "instance":     r.instance,
                    "cpu_val":      r.cpu_val,
                    "ram_val":      r.ram_val,
                    "disk_val":     r.disk_val,
                    "net_val":      r.net_val,
                    "trigger_type": r.trigger_type,
                    "cause":        r.cause,
                    "logs":         r.logs,
                }
                for r in records
            ],
        }
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)