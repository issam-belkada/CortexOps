from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from app.ml_service import detector # Import our new AI logic

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
    """
    1. Fetches data from Prometheus
    2. Sends it to the ML Service
    3. Returns Intelligent Status
    """
    query = '100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])))'
    
    try:
        # Step 1: Get Data
        response = requests.get(PROMETHEUS_URL, params={'query': query})
        raw_data = response.json()
        
        # Step 2: Transform Data
        df = detector.transform_data(raw_data)
        if df is None or df.empty:
            return {"message": "No data available from fleet"}
        
        # Step 3: Run AI Detection
        analysis_results = detector.detect(df)
        
        return {
            "total_instances": len(analysis_results),
            "anomalies_detected": sum(1 for x in analysis_results if x['status'] == "Anomalous"),
            "data": analysis_results
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