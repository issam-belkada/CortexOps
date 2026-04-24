from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from app.ml_service import detector # Import our new AI logic
from app.log_service import log_analyzer

app = FastAPI(title="Intelligent Monitoring API")

# 1. CORS Configuration
# This is CRITICAL to allow your React Frontend (port 5173/3000) 
# to talk to your FastAPI Backend (port 8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROMETHEUS_URL = "http://localhost:9090/api/v1/query"

@app.get("/")
def read_root():
    return {"message": "AI-Engine API is running"}


@app.get("/api/v1/analysis")
def get_fleet_analysis():
    query = '100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])))'
    
    try:
        response = requests.get(PROMETHEUS_URL, params={'query': query})
        raw_data = response.json()
        
        df = detector.transform_data(raw_data)
        if df is None or df.empty:
            return {"message": "No data"}
        
        analysis_results = detector.detect(df)
        
        # --- NEW: ENHANCED LOG CORRELATION ---
        for entry in analysis_results:
            if entry['status'] == "Anomalous":
                # Automatically fetch context from Loki
                entry['recent_logs'] = log_analyzer.get_logs_for_instance(entry['instance'])
            else:
                entry['recent_logs'] = []
        
        return {
            "total_instances": len(analysis_results),
            "anomalies_detected": sum(1 for x in analysis_results if x['status'] == "Anomalous"),
            "fleet_data": analysis_results
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/v1/metrics/raw")
def get_raw_metrics():
    """
    Fetches real-time CPU data from Prometheus for the whole fleet.
    """
    query = '100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])))'
    try:
        response = requests.get(PROMETHEUS_URL, params={'query': query})
        data = response.json()
        return data
    except Exception as e:
        return {"error": f"Could not connect to Prometheus: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)