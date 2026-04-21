import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import os

def train():
    # Load synthetic data
    data_path = 'ml_engine/data/synthetic_telemetry.csv'
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found. Run generate_data.py first.")
        return
        
    df = pd.read_csv(data_path)
    
    # Isolation Forest
    # contamination=0.15 matches our generate_data.py anomaly ratio
    model = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
    model.fit(df)
    
    # Save model
    os.makedirs('ml_engine/models', exist_ok=True)
    model_path = 'ml_engine/models/isolation_forest.joblib'
    joblib.dump(model, model_path)
    
    print(f"Model trained and saved to {model_path}")

if __name__ == "__main__":
    train()
