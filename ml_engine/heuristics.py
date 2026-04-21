def calculate_risk_score(telemetry_data: dict, baseline_data: dict) -> dict:
    """
    Rule-based heuristics for generating a risk score based on daily telemetry and 14-day baseline.
    In Phase 1, we use simple rules instead of an ML model.
    """
    score = 0
    factors = []
    
    # 1. Late Night Usage (LNU) Check
    lnu = telemetry_data.get('late_night_usage_mins', 0)
    baseline_lnu = baseline_data.get('late_night_usage_mins_avg', 0)
    if lnu > baseline_lnu + 30: # 30 mins over average
        score += 30
        factors.append("Spike in late night phone usage")
    elif lnu > 60: # absolute threshold
        score += 20
        factors.append("High late night screen time")
        
    # 2. Context Switching
    csi = telemetry_data.get('context_switching_index', 0)
    baseline_csi = baseline_data.get('context_switching_index_avg', 0)
    if csi > baseline_csi * 1.5: # 50% higher than normal
        score += 25
        factors.append("High app context-switching frequency")
        
    # 3. Notification Anxiety
    notif_resp = telemetry_data.get('notification_responses_per_hour', 0)
    if notif_resp > 20: 
        score += 15
        factors.append("High notification response rate")
        
    # 4. Social Collapse
    soc = telemetry_data.get('social_interaction_mins', 0)
    baseline_soc = baseline_data.get('social_interaction_mins_avg', 0)
    if baseline_soc > 30 and soc < baseline_soc * 0.4: # 60% drop
        score += 20
        factors.append("Significant drop in social interactions")

    # Cap score at 100
    score = min(score, 100)
    
    # Categorization
    if score >= 71:
        category = "High Concern"
        msg = "You've had signs of high digital stress today. It's time to put the phone down, breathe, and reset."
    elif score >= 41:
        category = "Mild Concern"
        msg = "We noticed some digital fatigue. Taking a 5-minute break now can help maintain focus later."
    else:
        category = "Normal"
        msg = None
        
    top_factor = factors[0] if factors else "No significant anomalies detected."
    
    return {
        "risk_score": score,
        "category": category,
        "top_factor": top_factor,
        "intervention_message": msg
    }
