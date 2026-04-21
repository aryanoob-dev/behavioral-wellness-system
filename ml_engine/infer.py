import joblib
import pandas as pd
import shap
import os
import numpy as np

# Load the model and training data (for SHAP background)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'isolation_forest.joblib')
DATA_PATH = os.path.join(BASE_DIR, 'data', 'synthetic_telemetry.csv')

# Globals for caching
_model = None
_explainer = None
_feature_names = ['late_night_usage_mins', 'notification_response_rate', 'context_switching_index', 'social_interaction_mins']

def load_engine():
    global _model, _explainer
    if _model is None:
        _model = joblib.load(MODEL_PATH)
        # Load background data for SHAP
        train_df = pd.read_csv(DATA_PATH)
        # Use a small sample of background data to speed up SHAP
        _explainer = shap.Explainer(_model.predict, train_df.sample(50, random_state=42))

def calculate_ml_risk(telemetry_dict):
    """
    Predicts risk score and provides SHAP-based explanation.
    """
    load_engine()
    
    # Prep data
    input_df = pd.DataFrame([telemetry_dict])[_feature_names]
    
    # 1. Get Prediction (-1 for anomaly, 1 for normal)
    # But we want a score from 0 to 100.
    # We use the decision function: more negative = more anomalous.
    raw_score = _model.decision_function(input_df)[0]
    
    # Map decision_function (typically -0.5 to 0.5) to 0-100
    # Lower raw_score (anomalous) -> Higher risk_score
    # We calibrate roughly based on our training data ratio
    risk_score = int(np.clip((0.2 - raw_score) * 200, 0, 100))
    
    # 2. Category
    if risk_score < 40:
        category = "Normal"
    elif risk_score < 75:
        category = "Mild Concern"
    else:
        category = "High Concern"
        
    # 3. SHAP Explanation
    shap_values = _explainer(input_df)
    
    # Find the feature with the highest (most positive) impact on anomaly detection
    # In SHAP for IF predict, positive values mean 'more likely to be normal'? 
    # Actually, we used _model.predict in Explainer. predict returns 1 or -1.
    # This might not be great. Let's use decision_function instead.
    
    # Re-init explainer with decision_function for better granularity
    global _explainer_df
    if 'load_engine_df' not in globals():
        train_df = pd.read_csv(DATA_PATH)
        _explainer_df = shap.Explainer(_model.decision_function, train_df.sample(50, random_state=42))
        globals()['load_engine_df'] = True
        
    shap_vals_df = _explainer_df(input_df)
    
    # In decision_function, lower is anomalous. 
    # Negative SHAP value means that feature is pushing the score towards 'anomalous'.
    # We want the MOST negative contribution.
    contributions = shap_vals_df.values[0]
    top_factor_idx = np.argmin(contributions)
    top_factor_name = _feature_names[top_factor_idx]
    
    # Human readable mapping
    factor_mapping = {
        'late_night_usage_mins': 'High late-night phone usage',
        'notification_response_rate': 'Unusually fast notification response rate',
        'context_switching_index': 'Frequent app context-switching',
        'social_interaction_mins': 'Decrease in social app interactions'
    }
    
    top_factor = factor_mapping.get(top_factor_name, "Behavioral shift detected")
    
    # Generate intervention message
    if category == "Normal":
        msg = "Your behavioral patterns are stable and within your typical baseline."
    elif category == "Mild Concern":
        msg = f"We've noticed a shift: {top_factor}. Taking a short break may help."
    else:
        # Changed from "due to" to observational language
        msg = f"We noticed a shift: {top_factor.lower()}. Please consider digital detox and reach out if you feel overwhelmed."
        
    return {
        "risk_score": risk_score,
        "category": category,
        "top_factor": top_factor,
        "intervention_message": msg
    }

if __name__ == "__main__":
    # Test sample
    test_sample = {
        'late_night_usage_mins': 120,
        'notification_response_rate': 0.8,
        'context_switching_index': 90,
        'social_interaction_mins': 10
    }
    print(calculate_ml_risk(test_sample))
