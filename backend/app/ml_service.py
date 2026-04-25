import time
from sklearn.ensemble import IsolationForest
import numpy as np

class AnomalyDetector:
    def __init__(self):
        self.models = {}      # Stores trained models: { "inst": model_obj }
        self.history = {}     # Stores raw data for retraining
        self.last_trained = {} # Timestamps: { "inst": 1714000... }
        self.retrain_interval = 3600  # Retrain once per hour (3600 seconds)

    def analyze_instance(self, instance_name, current_metrics):
        now = time.time()
        
        # 1. Initialize or Check if it's time to retrain
        needs_training = (
            instance_name not in self.models or 
            (now - self.last_trained.get(instance_name, 0)) > self.retrain_interval
        )

        # 2. Add current metrics to history for the next training session
        if instance_name not in self.history:
            self.history[instance_name] = []
        self.history[instance_name].append(current_metrics)
        
        # Keep a rolling window of 100 points for retraining
        if len(self.history[instance_name]) > 100:
            self.history[instance_name].pop(0)

        # 3. TRAINING PHASE (Only runs occasionally)
        if needs_training and len(self.history[instance_name]) >= 30:
            X_train = np.array(self.history[instance_name])
            self.models[instance_name] = IsolationForest(contamination=0.01).fit(X_train)
            self.last_trained[instance_name] = now
            print(f"Model for {instance_name} updated.")

        # 4. INFERENCE PHASE (Runs every request - very fast)
        if instance_name in self.models:
            X_now = np.array([current_metrics])
            prediction = self.models[instance_name].predict(X_now)
            
            # Change: Lower threshold to 10% and add a print for debugging
            is_outlier = prediction[0] == -1
            cpu_val = current_metrics[0]
            
            if is_outlier:
                print(f"⚠️ AI detected outlier for {instance_name}: CPU={cpu_val}%")

            if is_outlier and cpu_val > 10.0: # Lowered from 15.0 to 10.0
                return "Anomalous"
            return "Healthy"
        
        return "Learning"
    
detector = AnomalyDetector()