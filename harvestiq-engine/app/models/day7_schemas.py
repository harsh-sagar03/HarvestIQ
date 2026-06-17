from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SosTriggerRequest(BaseModel):
    farm_id: str
    emergency_type: str = "GENERAL"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    captured_at: Optional[str] = None


class SosTriggerResponse(BaseModel):
    action_id: str
    farm_id: str
    emergency_type: str
    checklist: List[str]
    plain_text_message: str
    delivery_status: str
    intelligence_snapshot_version: str
    triggered_at: datetime


class DemoInitializeResponse(BaseModel):
    demo_mode: bool = True
    version: str
    farms: List[Dict[str, Any]]
    description: str


class SyncOperation(BaseModel):
    client_id: str
    operation_type: str
    payload: Dict[str, Any]
    client_timestamp: datetime


class SyncBatchRequest(BaseModel):
    operations: List[SyncOperation] = Field(default_factory=list)


class SyncOperationResult(BaseModel):
    operation_type: str
    client_id: str
    server_id: Optional[str] = None
    status: str
    error: Optional[str] = None
    detail: Optional[str] = None


class SyncBatchResponse(BaseModel):
    processed: int
    results: List[SyncOperationResult]


class VerificationLogRequest(BaseModel):
    event_type: str
    environment: str
    status: str
    details: Dict[str, Any] = Field(default_factory=dict)


class VerificationLogResponse(BaseModel):
    log_id: str
    event_type: str
    status: str
    recorded_at: datetime
