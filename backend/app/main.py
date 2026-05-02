import asyncio
import requests
import time
from fastapi import FastAPI
from app.ml_service import detector
from app.log_service import log_analyzer
from app.database import SessionLocal, AnomalyRecord, init_db
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure Database Tables are created
init_db()

PROMETHEUS_URL = "http://localhost:9090/api/v1/query"

QUERIES = {
    # irate is better for volatile metrics like CPU spikes
    "cpu": 'sum by(instance) (irate(node_cpu_seconds_total{mode!="idle"}[1m])) / count by(instance) (node_cpu_seconds_total{mode="idle"}) * 100',
    "ram": '100 * (1 - (node_memory_MemFree_bytes / node_memory_MemTotal_bytes))',
    "disk": 'max by(instance) (100 - (node_filesystem_avail_bytes{device=~"/dev/.*", fstype!="tmpfs"} * 100 / node_filesystem_size_bytes{device=~"/dev/.*", fstype!="tmpfs"}))',
    "network": 'sum by(instance) (rate(node_network_receive_bytes_total[1m]))'
}

def fetch_metric(name, query):
    try:
        response = requests.get(PROMETHEUS_URL, params={'query': query}, timeout=2)
        results = response.json().get('data', {}).get('result', [])
        return {name: {res['metric']['instance']: float(res['value'][1]) for res in results}}
    except Exception as e:
        print(f"Error fetching {name}: {e}")
        return {name: {}}

@app.get("/api/v1/fleet/intelligence")
async def get_fleet_intelligence():
    # 1. Parallel-style Metric Collection
    all_data = {}
    for name, query in QUERIES.items():
        all_data.update(fetch_metric(name, query))

    # 2. Identify all unique instances across all metrics
    instances = set().union(*[m.keys() for m in all_data.values()])
    
    fleet_analysis = []
    db = SessionLocal()

    try:
        for inst in instances:
            current_metrics = [
                all_data['cpu'].get(inst, 0),
                all_data['ram'].get(inst, 0),
                all_data['disk'].get(inst, 0),
                all_data['network'].get(inst, 0)
            ]

            # A. Fetch logs FIRST so we can pass them to the AI for RCA
            logs = log_analyzer.get_logs_for_instance(inst)
            log_messages = [l['message'] for l in logs] if logs else []

            # B. CALL THE HYBRID AI
            # Returns: status ("Anomalous"/"Healthy"), reason ("Spike -> Cause: MEMORY", etc.)
            status, reason = detector.analyze(inst, current_metrics, logs=log_messages)

            if status == "Anomalous":
                # analysis_result is "Trigger -> Cause" - we need to split them
                try:
                    trigger, predicted_cause = reason.split(" -> Cause: ")
                except ValueError:
                    trigger, predicted_cause = "Unknown", reason
            
                # Save to the new schema
                new_event = AnomalyRecord(
                    instance=inst,
                    cpu_val=round(current_metrics[0], 2),
                    ram_val=round(current_metrics[1], 2),
                    disk_val=round(current_metrics[2], 2),
                    net_val=round(current_metrics[3], 2),
                    trigger_type=trigger,
                    cause=predicted_cause,
                    logs=" | ".join(log_messages[:5]) # Store top 5 log lines for context
                )
                db.add(new_event)

            fleet_analysis.append({
                "instance": inst,
                "metrics": {
                    "cpu": round(current_metrics[0], 2),
                    "ram": round(current_metrics[1], 2),
                    "disk": round(current_metrics[2], 2),
                    "network": round(current_metrics[3], 2)
                },
                "status": status,
                "reason": reason, # Add this to your API response for the React UI
                "recent_logs": logs
            })

        db.commit() # Save all detected anomalies to DB at once
    except Exception as e:
        print(f"Database/Analysis Error: {e}")
        db.rollback()
    finally:
        db.close()

    return {
        "timestamp": time.time(),
        "summary": {
            "total_instances": len(fleet_analysis),
            "anomalies": sum(1 for x in fleet_analysis if x['status'] == "Anomalous"),
            "learning_phase": sum(1 for x in fleet_analysis if x['status'] == "Learning")
        },
        "fleet": fleet_analysis
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)