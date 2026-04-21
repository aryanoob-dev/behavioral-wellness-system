from sqlalchemy.orm import Session
from . import models, schemas

def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(id=user.id, name=user.name, timezone=user.timezone)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_telemetry_log(db: Session, telemetry: schemas.DailyTelemetry):
    db_item = models.TelemetryLog(**telemetry.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def create_risk_insight(db: Session, insight: schemas.RiskInsight):
    db_item = models.RiskInsightLog(**insight.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_latest_insight(db: Session, user_id: str):
    return db.query(models.RiskInsightLog).filter(models.RiskInsightLog.user_id == user_id).order_by(models.RiskInsightLog.id.desc()).first()

def get_total_sample_count(db: Session, user_id: str):
    # Sum of sample_count across all logs for this user
    from sqlalchemy import func
    result = db.query(func.sum(models.RiskInsightLog.sample_count)).filter(models.RiskInsightLog.user_id == user_id).scalar()
    return result or 0

def create_daily_summary(db: Session, summary: models.DailySummary):
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary

def get_daily_trends(db: Session, user_id: str, limit: int = 7):
    return db.query(models.DailySummary).filter(models.DailySummary.user_id == user_id).order_by(models.DailySummary.date.desc()).limit(limit).all()

def create_checkin(db: Session, checkin: schemas.CheckInCreate):
    db_item = models.CheckIn(**checkin.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_recent_checkins(db: Session, user_id: str, limit: int = 5):
    return db.query(models.CheckIn).filter(models.CheckIn.user_id == user_id).order_by(models.CheckIn.created_at.desc()).limit(limit).all()

def get_recent_insights(db: Session, user_id: str, limit: int = 5):
    return db.query(models.RiskInsightLog).filter(models.RiskInsightLog.user_id == user_id).order_by(models.RiskInsightLog.id.desc()).limit(limit).all()

from sqlalchemy import func

def create_raw_telemetry_batch(db: Session, batch: schemas.TelemetryBatchRequest):
    accepted = 0
    rejected = 0
    for event_data in batch.events:
        try:
            db_event = models.RawTelemetryEvent(**event_data.model_dump())
            db.add(db_event)
            accepted += 1
        except Exception as e:
            print(f"Error ingesting event: {e}")
            rejected += 1
    
    db.commit()
    return {"accepted": accepted, "rejected": rejected}

def get_user_baseline(db: Session, user_id: str, days: int = 7):
    # Get the average of risk_score from DailySummary for the last 'days'
    result = db.query(func.avg(models.DailySummary.risk_score)).filter(
        models.DailySummary.user_id == user_id
    ).order_by(models.DailySummary.date.desc()).limit(days).scalar()
    return result or 0.0
