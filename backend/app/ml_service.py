import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

class AnomalyDetector:
    def __init__(self, contamination=0.05):
        # contamination is the % of data we expect to be 'outliers'
        self.model = IsolationForest(contamination=contamination, random_state=42)
        self.is_trained = False

    def transform_data(self, prometheus_data):
        """
        Converts raw Prometheus JSON into a format the AI understands.
        """
        results = prometheus_data.get('data', {}).get('result', [])
        if not results:
            return None
        
        # We extract the value and the instance name
        processed_data = []
        for item in results:
            processed_data.append({
                "instance": item['metric']['instance'],
                "cpu_value": float(item['value'][1])
            })
        
        return pd.DataFrame(processed_data)

    def detect(self, df):
        """
        Runs the Isolation Forest model.
        Returns 1 for normal, -1 for anomaly.
        """
        # Isolation Forest needs a 2D array: [[val1], [val2], ...]
        X = df[['cpu_value']].values
        
        # In a real system, we'd 'fit' on historical data. 
        # For this MVP, we 'fit_predict' on the current fleet state.
        predictions = self.model.fit_predict(X)
        
        # Add results back to the dataframe
        df['anomaly_score'] = predictions
        df['status'] = df['anomaly_score'].apply(lambda x: "Anomalous" if x == -1 else "Healthy")
        
        return df.to_dict(orient='records')

# Create a singleton instance to be used by the API
detector = AnomalyDetector()