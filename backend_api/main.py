import sys
import os
import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from dotenv import load_dotenv

load_dotenv()

# Allow importing from sibling directories
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_engine.infer import calculate_ml_risk
from backend_api import models, schemas, crud
from backend_api.database import SessionLocal, engine, get_db

MIN_SAMPLES_FOR_SCORE = 50

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Early Warning System API", description="Mental Health Behavioral Intelligence", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Seed the database with a user if none exists
    db = SessionLocal()
    user = crud.get_user(db, "user_123")
    if not user:
        user_in = schemas.UserCreate(id="user_123", name="Alex")
        crud.create_user(db, user_in)
        # Seed an initial insight
        # We'll use a semi-random sample to trigger the ML logic
        seed_telemetry = {
            "late_night_usage_mins": 24,
            "notification_response_rate": 0.2,
            "context_switching_index": 30,
            "social_interaction_mins": 80
        }
        insight_data = calculate_ml_risk(seed_telemetry)
        
        insight_in = schemas.RiskInsight(
            user_id="user_123",
            date=datetime.datetime.now().strftime("%Y-%m-%d"),
            risk_score=insight_data["risk_score"],
            category=insight_data["category"],
            top_factor=insight_data["top_factor"],
            intervention_message=insight_data["intervention_message"]
        )
        crud.create_risk_insight(db, insight_in)
    db.close()

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.now().isoformat()}

@app.get("/")
def read_root():
    return {"message": "Mental Health Early Warning System API is running."}

@app.post("/users", response_model=schemas.UserCreate)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user.id)
    if db_user:
        raise HTTPException(status_code=400, detail="User already exists")
    return crud.create_user(db, user)

@app.get("/users/{user_id}", response_model=schemas.User)
def get_user(user_id: str, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.get("/insights/{user_id}", response_model=schemas.RiskInsight)
def get_insights(user_id: str, db: Session = Depends(get_db)):
    insight = crud.get_latest_insight(db, user_id=user_id)
    if insight is None:
        raise HTTPException(status_code=404, detail="No insights found")
    return insight

@app.post("/telemetry", response_model=schemas.RiskInsight)
def ingest_telemetry(telemetry: schemas.DailyTelemetry, db: Session = Depends(get_db)):
    # 1. Save telemetry to DB
    crud.create_telemetry_log(db, telemetry)
    
    # 2. Call the ML Engine
    ml_input = telemetry.model_dump()
    ml_input['notification_response_rate'] = ml_input.pop('notification_responses_per_hour')
    
    insight_data = calculate_ml_risk(ml_input)
    
    # 3. Calculate Confidence & Metadata
    # For now, we mock sample_count per telemetry event (e.g. 10 interactions)
    # until a real-world pipeline is implemented.
    event_sample_count = 10 
    total_samples = crud.get_total_sample_count(db, telemetry.user_id) + event_sample_count
    confidence = min(1.0, total_samples / MIN_SAMPLES_FOR_SCORE)
    
    user = crud.get_user(db, telemetry.user_id)
    tz = user.timezone if user else "UTC"

    # 4. Create Insight 
    baseline = crud.get_user_baseline(db, telemetry.user_id)
    should_notify = insight_data["risk_score"] > (baseline + 20)
    
    insight_schema = schemas.RiskInsight(
        user_id=telemetry.user_id,
        date=telemetry.date,
        risk_score=insight_data["risk_score"],
        category=insight_data["category"],
        top_factor=insight_data["top_factor"],
        intervention_message=insight_data.get("intervention_message", ""),
        sample_count=event_sample_count,
        confidence=confidence,
        timezone=tz,
        should_notify=should_notify
    )
    
    # 5. Save insight to DB
    insight_log = crud.create_risk_insight(db, insight_schema)
    
    # 6. Update/Create Daily Summary (Simplified for MVP: update latest for the date)
    # In a real app, this would be an upsert or handled by a background worker.
    summary = models.DailySummary(
        user_id=telemetry.user_id,
        date=telemetry.date,
        risk_score=insight_data["risk_score"],
        confidence=confidence,
        sample_count=total_samples, # Storing total progress for the day
        top_factor=insight_data["top_factor"]
    )
    crud.create_daily_summary(db, summary)
    
    return insight_schema

@app.get("/insights/trends/{user_id}", response_model=schemas.DailyTrendsResponse)
def get_trends(user_id: str, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    total_samples = crud.get_total_sample_count(db, user_id)
    
    # Ensure exactly 7 days
    trends = []
    today = datetime.date.today()
    for i in range(6, -1, -1):
        target_date = (today - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        summary = db.query(models.DailySummary).filter(
            models.DailySummary.user_id == user_id,
            models.DailySummary.date == target_date
        ).first()
        
        if summary:
            trends.append(schemas.DailySummarySchema(
                date=summary.date,
                risk_score=summary.risk_score,
                confidence=summary.confidence,
                sample_count=summary.sample_count,
                top_factor=summary.top_factor
            ))
        else:
            trends.append(schemas.DailySummarySchema(
                date=target_date,
                risk_score=None,
                confidence=0.0,
                sample_count=0,
                top_factor="No data"
            ))
            
    return {
        "user_id": user_id,
        "min_samples_required": MIN_SAMPLES_FOR_SCORE,
        "current_sample_count": total_samples,
        "is_ready": total_samples >= MIN_SAMPLES_FOR_SCORE,
        "trends": trends
    }

@app.post("/checkins", response_model=schemas.CheckInRead)
def create_checkin(checkin: schemas.CheckInCreate, db: Session = Depends(get_db)):
    return crud.create_checkin(db, checkin)

@app.get("/insights", response_model=schemas.RiskInsight)
def get_insights_query(user_id: str, db: Session = Depends(get_db)):
    insight = crud.get_latest_insight(db, user_id=user_id)
    if insight is None:
        raise HTTPException(status_code=404, detail="No insights found")
    return insight

@app.get("/trends", response_model=schemas.DailyTrendsResponse)
def get_trends_query(user_id: str, db: Session = Depends(get_db)):
    return get_trends(user_id, db)

@app.get("/notifications/preview/{user_id}", response_model=schemas.NotificationPreviewResponse)
def get_notification_preview(user_id: str, db: Session = Depends(get_db)):
    latest_insight = crud.get_latest_insight(db, user_id=user_id)
    if not latest_insight:
        raise HTTPException(status_code=404, detail="No data for user")
    
    baseline = crud.get_user_baseline(db, user_id)
    latest_score = latest_insight.risk_score
    
    # Logic: Spike if score is > 20 points above the 7-day average
    is_spike = latest_score > (baseline + 20)
    
    message = "Your behavioral patterns are stable."
    if is_spike:
        message = f"Alert: Significant behavioral shift detected ({latest_insight.top_factor}). Please check your trends."
    
    return {
        "user_id": user_id,
        "would_notify": is_spike,
        "message": message,
        "spike_detected": is_spike,
        "latest_score": latest_score,
        "baseline_avg": baseline
    }

@app.get("/insights/history/{user_id}", response_model=schemas.RiskInsightHistory)
def get_insights_history(user_id: str, db: Session = Depends(get_db)):
    insights = crud.get_recent_insights(db, user_id=user_id, limit=5)
    checkins = crud.get_recent_checkins(db, user_id=user_id, limit=5)
    
    # Map model objects to schemas and ensure dates are strings
    return {
        "user_id": user_id,
        "insights": [schemas.RiskInsight(
            user_id=i.user_id,
            date=i.date,
            risk_score=i.risk_score,
            category=i.category,
            top_factor=i.top_factor,
            intervention_message=i.intervention_message,
            sample_count=i.sample_count,
            confidence=i.confidence,
            timezone=i.timezone
        ) for i in insights],
        "check_ins": [schemas.CheckInRead(
            id=c.id,
            user_id=c.user_id,
            mood=c.mood,
            energy_level=c.energy_level,
            note=c.note,
            created_at=c.created_at.isoformat()
        ) for c in checkins]
    }

@app.post("/telemetry/batch", response_model=schemas.BatchResponse)
def ingest_telemetry_batch(batch: schemas.TelemetryBatchRequest, db: Session = Depends(get_db)):
    return crud.create_raw_telemetry_batch(db, batch)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("backend_api.main:app", host=host, port=port, reload=True)
