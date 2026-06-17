from datetime import date, datetime
from typing import List, Literal, Optional, Tuple

from pydantic import BaseModel, Field, field_validator

from app.models.common import MongoModelConfig, PyObjectId

SoilType = Literal["CLAY", "SANDY", "LOAM", "SILT"]


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: List[List[Tuple[float, float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, value: List[List[Tuple[float, float]]]) -> List[List[Tuple[float, float]]]:
        if not value:
            raise ValueError("Polygon coordinates cannot be empty")
        for ring in value:
            if len(ring) < 4:
                raise ValueError("Polygon ring must have at least 4 coordinate pairs")
            for lon, lat in ring:
                if not (-180 <= lon <= 180):
                    raise ValueError("Longitude must be between -180 and 180")
                if not (-90 <= lat <= 90):
                    raise ValueError("Latitude must be between -90 and 90")
            if ring[0] != ring[-1]:
                raise ValueError("Polygon ring must be closed (first and last points must match)")
        return value


class OnboardingSchema(BaseModel):
    crop_type: str = Field(..., min_length=1, max_length=50)
    state: str = Field(..., min_length=1, max_length=50)
    district: str = Field(..., min_length=1, max_length=50)
    sowing_date: date
    farm_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    soil_type: Optional[SoilType] = None
    boundary: Optional[GeoJSONPolygon] = None

    @field_validator("sowing_date")
    @classmethod
    def validate_sowing_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Sowing date cannot be in the future")
        return value


class FarmInDB(BaseModel):
    model_config = MongoModelConfig

    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    name: str
    state: str
    district: str
    boundary: Optional[dict] = None
    soil_type: Optional[str] = None
    created_at: datetime


class CropCycleInDB(BaseModel):
    model_config = MongoModelConfig

    id: PyObjectId = Field(alias="_id")
    farm_id: PyObjectId
    crop_type: str
    sowing_date: datetime
    current_gdd: float = 0.0
    status: Literal["ACTIVE", "HARVESTED"] = "ACTIVE"
    updated_at: datetime


class OnboardingResponse(BaseModel):
    status: str = "onboarded"
    farm_id: str
    crop_cycle_id: str
    onboarding_completed: bool = True


class FarmProfileResponse(BaseModel):
    farm_id: str
    farm_name: str
    state: str
    district: str
    soil_type: Optional[str] = None
    boundary: Optional[dict] = None
    crop_cycle_id: Optional[str] = None
    crop_type: Optional[str] = None
    sowing_date: Optional[date] = None
