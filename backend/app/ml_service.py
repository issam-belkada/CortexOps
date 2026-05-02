import numpy as np
import joblib
import os
from sklearn.ensemble import IsolationForest

class HybridAI:
    def __init__(self, model_path='root_cause_model.pkl'):
        # 1. Isolation Forest: Less sensitive (low contamination)
        self.detector = IsolationForest(contamination=0.01, random_state=42)
        
        # 2. Random Forest: Trained in Colab
        try:
            self.classifier = joblib.load(model_path)
            print("Random Forest Loaded")
        except:
            self.classifier = None
            print("⚠️ root_cause_model.pkl not found!")

        self.history = []
        self.is_trained = False

    def _parse_logs_for_errors(self, logs):
        """Checks recent logs for specific error codes."""
        # Mapping ERR1-4 to ERROR_1000-1003 from your CSV
        error_targets = ["ERROR_1000", "ERROR_1001", "ERROR_1002", "ERROR_1003"]
        found_errors = [0, 0, 0, 0]
        
        log_text = " ".join(logs).upper()
        for i, code in enumerate(error_targets):
            if code in log_text or f"ERR{i+1}" in log_text:
                found_errors[i] = 1
        return found_errors

    def analyze(self, instance_name, current_metrics, logs=[]):
        """
        metrics: [cpu, ram, disk, network]
        logs: list of strings from the server
        """
        cpu, ram, disk, network = current_metrics
        
        # --- A. Manual Threshold Engine (The "Expert") ---
        cpu_load = 1 if cpu > 70 else 0
        mem_load = 1 if ram > 70 else 0
        delay = 1 if network > 876 else 0
        errors = self._parse_logs_for_errors(logs)
        
        # Combine into the feature vector your Random Forest expects
        # Order: [CPU_LOAD, MEMORY_LOAD, DELAY, ERR1000, ERR1001, ERR1002, ERR1003]
        rf_features = [cpu_load, mem_load, delay] + errors
        
        expert_triggered = any([cpu_load, mem_load, delay]) or any(errors)

        # --- B. Isolation Forest Engine (The "Scout") ---
        self.history.append(current_metrics)
        if len(self.history) > 100: self.history.pop(0) # Keep sliding window
        
        is_outlier = False
        if len(self.history) >= 40:
            if not self.is_trained:
                self.detector.fit(self.history)
                self.is_trained = True
            
            # Predict outlier
            pred = self.detector.predict([current_metrics])[0]
            
            # Double check: Only alert if it's an outlier AND a high spike (+30%)
            history_mean = np.mean(self.history, axis=0)
            if pred == -1 and (cpu > history_mean[0] * 1.30 or ram > history_mean[1] * 1.30):
                is_outlier = True

        # --- C. Final Decision ---
        if expert_triggered or is_outlier:
            cause = "Unknown Behavior"
            if self.classifier:
                # Use Random Forest to explain the cause
                cause = self.classifier.predict([rf_features])[0]
            
            trigger_type = "Spike Detected" if is_outlier else "Threshold Exceeded"
            return "Anomalous", f"{trigger_type} -> Cause: {cause}"

        return "Healthy", "Normal"
    
detector = HybridAI()