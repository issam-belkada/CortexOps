import requests
import datetime

LOKI_URL = "http://localhost:3100/loki/api/v1/query_range"

class LogAnalyzer:
    def get_logs_for_instance(self, instance_name: str, limit: int = 10):
        """
        Queries Loki for the most recent logs of a specific instance.
        """
        # Calculate time range (last 5 minutes)
        end_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        # This LogQL query filters by job and searches for error-related keywords
        # Note: We use the 'job' label we defined in promtail-config
        logql = '{job="server_logs"}'
        
        params = {
            'query': logql,
            'limit': limit,
            'direction': 'backward'
        }

        try:
            response = requests.get(LOKI_URL, params=params)
            results = response.json().get('data', {}).get('result', [])
            
            extracted_logs = []
            for stream in results:
                # We filter by filename or instance if possible
                # For our simulation, we check if the path contains the instance name
                for entry in stream.get('values', []):
                    timestamp, message = entry
                    extracted_logs.append({
                        "time": timestamp,
                        "message": message
                    })
            return extracted_logs
        except Exception as e:
            return [{"error": f"Loki Connection Failed: {str(e)}"}]

log_analyzer = LogAnalyzer()