from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    id: str
    name: str
    timezone: Optional[str] = "UTC"

class User(UserCreate):
    pass

class DailyTelemetry(BaseModel):
    user_id: str
    date: str
    late_night_usage_mins: int
    notification_responses_per_hour: float
    context_switching_index: int
    social_interaction_mins: int

class RiskInsight(BaseModel):
    user_id: str
    date: str
    risk_score: int 
    category: str 
    top_factor: str
    intervention_message: Optional[str] = None
    sample_count: int = 0
    confidence: float = 0.0
    timezone: str = "UTC"
    should_notify: bool = False

class DailySummarySchema(BaseModel):
    date: str
    risk_score: int
    confidence: float
    sample_count: int
    top_factor: str

class DailyTrendsResponse(BaseModel):
    user_id: str
    min_samples_required: int
    current_sample_count: int
    is_ready: bool
    trends: list[DailySummarySchema]

from typing import Optional, Any, Union
from pydantic import Field

class CheckInCreate(BaseModel):
    user_id: str
    mood: str
    energy_level: int
    sleep_quality: Optional[int] = None
    focus_level: Optional[int] = None
    social_engagement: Optional[int] = None
    note: Optional[str] = ""

class CheckInRead(CheckInCreate):
    id: int
    created_at: datetime

class RiskInsightHistory(BaseModel):
    user_id: str
    insights: list[RiskInsight]
    check_ins: list[CheckInRead]

class RawTelemetryEvent(BaseModel):
    user_id: str
    event_type: str
    payload: dict
    timestamp: str # ISO8601 with offset

class TelemetryBatchRequest(BaseModel):
    events: list[RawTelemetryEvent]

class BatchResponse(BaseModel):
    accepted: int
    rejected: int

class NotificationPreviewResponse(BaseModel):
    user_id: str
    would_notify: bool
    message: str
    spike_detected: bool
    latest_score: int
    baseline_avg: float
