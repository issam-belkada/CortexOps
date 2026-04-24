from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

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