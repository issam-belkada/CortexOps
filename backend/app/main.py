import asyncio
import requests
import time
from fastapi import FastAPI
from app.ml_service import detector
from app.log_service import log_analyzer
from app.database import SessionLocal, AnomalyRecord, init_db

app = FastAPI()

# Ensure Database Tables are created
init_db()

PROMETHEUS_URL = "http://localhost:9090/api/v1/query"

QUERIES = {
    "cpu": '100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])))',
    "ram": '100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))',
    "disk": '100 - (node_filesystem_avail_bytes{mountpoint="/"} * 100 / node_filesystem_size_bytes{mountpoint="/"})',
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
            # Prepare current feature vector for this specific instance
            current_metrics = [
                all_data['cpu'].get(inst, 0),
                all_data['ram'].get(inst, 0),
                all_data['disk'].get(inst, 0),
                all_data['network'].get(inst, 0)
            ]

            # 3. SELF-COMPARISON AI LOGIC
            # This calls the method that compares the instance to its own history
            status = detector.analyze_instance(inst, current_metrics)

            # 4. Fetch Logs and Save to DB only if truly Anomalous
            logs = []
            if status == "Anomalous":
                logs = log_analyzer.get_logs_for_instance(inst)
                
                # PERSISTENCE: Save the incident to PostgreSQL
                new_event = AnomalyRecord(
                    instance=inst,
                    cpu_val=round(current_metrics[0], 2),
                    ram_val=round(current_metrics[1], 2),
                    log_preview=str(logs[0]['message']) if logs else "No specific error logs found"
                )
                db.add(new_event)

            # Build the response object for this instance
            fleet_analysis.append({
                "instance": inst,
                "metrics": {
                    "cpu": round(current_metrics[0], 2),
                    "ram": round(current_metrics[1], 2),
                    "disk": round(current_metrics[2], 2),
                    "network": round(current_metrics[3], 2)
                },
                "status": status,
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