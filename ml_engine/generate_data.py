import pandas as pd
import numpy as np
import os

# Set seed for reproducibility
np.random.seed(42)

def generate_synthetic_data(num_samples=1000, anomaly_ratio=0.15):
    """
    Generates synthetic behavioral telemetry data.
    
    Metrics:
    - late_night_usage_mins: 0 to 180 (Normal: 10-40, Anomalous: 60-150)
    - notification_response_rate: 0.0 to 1.0 (Normal: 0.1-0.3, Anomalous: 0.6-0.9)
    - context_switching_index: 0 to 100 (Normal: 20-50, Anomalous: 70-100)
    - social_interaction_mins: 0 to 300 (Normal: 60-120, Anomalous: 5-30)
    """
    
    num_anomalies = int(num_samples * anomaly_ratio)
    num_normal = num_samples - num_anomalies
    
    # Generate Normal Data
    normal_data = {
        'late_night_usage_mins': np.random.normal(25, 10, num_normal).clip(0, 60),
        'notification_response_rate': np.random.normal(0.2, 0.1, num_normal).clip(0, 0.4),
        'context_switching_index': np.random.normal(35, 10, num_normal).clip(0, 60),
        'social_interaction_mins': np.random.normal(90, 20, num_normal).clip(30, 200)
    }
    
    # Generate Anomalous Data
    anomalous_data = {
        'late_night_usage_mins': np.random.normal(100, 20, num_anomalies).clip(60, 180),
        'notification_response_rate': np.random.normal(0.7, 0.15, num_anomalies).clip(0.5, 1.0),
        'context_switching_index': np.random.normal(85, 10, num_anomalies).clip(60, 100),
        'social_interaction_mins': np.random.normal(15, 10, num_anomalies).clip(0, 40)
    }
    
    df_normal = pd.DataFrame(normal_data)
    df_anomalous = pd.DataFrame(anomalous_data)
    
    # Combine and shuffle
    df = pd.concat([df_normal, df_anomalous]).sample(frac=1).reset_index(drop=True)
    
    # Ensure directory exists
    os.makedirs('ml_engine/data', exist_ok=True)
    
    # Save to CSV
    output_path = 'ml_engine/data/synthetic_telemetry.csv'
    df.to_csv(output_path, index=False)
    print(f"Generated {num_samples} samples and saved to {output_path}")

if __name__ == "__main__":
    generate_synthetic_data()
