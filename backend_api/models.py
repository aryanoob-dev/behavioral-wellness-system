import uuid
import sqlalchemy
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    timezone = Column(String, default="UTC") # Mandatory timezone for data bucketing
    
    telemetry_logs = relationship("TelemetryLog", back_populates="user")
    insights = relationship("RiskInsightLog", back_populates="user")
    summaries = relationship("DailySummary", back_populates="user")
    check_ins = relationship("CheckIn", back_populates="user")
    raw_telemetry = relationship("RawTelemetryEvent", back_populates="user")

class RawTelemetryEvent(Base):
    __tablename__ = "raw_telemetry"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    event_type = Column(String) # e.g. "screen_session", "app_switch"
    payload = Column(JSON) # Detailed context
    timestamp = Column(String) # ISO8601 with offset
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    synced = Column(Boolean, default=False) # For future synchronization logic
    
    user = relationship("User", back_populates="raw_telemetry")

class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(String)
    late_night_usage_mins = Column(Integer)
    notification_responses_per_hour = Column(Float)
    context_switching_index = Column(Integer)
    social_interaction_mins = Column(Integer)
    
    user = relationship("User", back_populates="telemetry_logs")

class RiskInsightLog(Base):
    __tablename__ = "risk_insights"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(String)
    risk_score = Column(Integer)
    category = Column(String)
    top_factor = Column(String)
    intervention_message = Column(String, nullable=True)
    
    # New columns for Phase 5
    sample_count = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    timezone = Column(String)
    
    user = relationship("User", back_populates="insights")

class DailySummary(Base):
    __tablename__ = "daily_summaries"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(String) # Local date string (YYYY-MM-DD)
    risk_score = Column(Integer)
    confidence = Column(Float)
    sample_count = Column(Integer)
    top_factor = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="summaries")

class CheckIn(Base):
    __tablename__ = "check_ins"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    mood = Column(String) # e.g., "Happy", "Stressed"
    energy_level = Column(Integer) # 1-10
    sleep_quality = Column(Integer, nullable=True) # 1-5
    focus_level = Column(Integer, nullable=True) # 1-5
    social_engagement = Column(Integer, nullable=True) # 1-5
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="check_ins")
