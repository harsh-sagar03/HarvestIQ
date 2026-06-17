from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

from app.models.common import MongoModelConfig, PyObjectId

AreaUnit = Literal["ACRE", "HECTARE", "SQM"]
CropCycleStatus = Literal["ACTIVE", "HARVESTED", "FAILED"]
ExpenseCategory = Literal[
    "SEEDS",
    "FERTILIZER",
    "PESTICIDES",
    "IRRIGATION_FUEL",
    "LABOR",
    "MACHINERY_RENT",
    "TRANSPORT",
    "LAND_RENT",
    "OTHER",
]


# --- Farmer Profile Schemas ---
class FarmerProfileSchema(BaseModel):
    id: str
    name: str
    preferred_language: str
    state: str
    district: str
    created_at: datetime


class FarmerProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    preferred_language: Optional[str] = Field(None, min_length=2, max_length=5)
    state: Optional[str] = Field(None, min_length=2, max_length=50)
    district: Optional[str] = Field(None, min_length=2, max_length=50)


# --- Farm Schemas ---
class FarmCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    area: float = Field(..., ge=0.0)
    area_unit: AreaUnit = "ACRE"
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class FarmSchema(BaseModel):
    id: str
    farmer_id: str
    name: str
    area: float
    area_unit: AreaUnit
    latitude: float
    longitude: float
    created_at: datetime


# --- Plot Schemas ---
class PlotCreateSchema(BaseModel):
    farm_id: str
    name: str = Field(..., min_length=1, max_length=100)
    area: float = Field(..., ge=0.0)
    area_unit: AreaUnit = "ACRE"


class PlotSchema(BaseModel):
    id: str
    farm_id: str
    name: str
    area: float
    area_unit: AreaUnit


# --- CropCycle Schemas ---
class CropCycleCreateSchemaNew(BaseModel):
    plot_id: str
    crop_type: str = Field(..., min_length=1, max_length=50)
    season: str = Field(..., min_length=1, max_length=50)
    sowing_date: date
    expected_harvest_date: date


class CropCycleSchema(BaseModel):
    id: str
    plot_id: str
    crop_type: str
    season: str
    sowing_date: date
    expected_harvest_date: date
    status: CropCycleStatus


# --- Expense Schemas ---
class ExpenseCreateSchema(BaseModel):
    crop_cycle_id: str
    category: ExpenseCategory
    amount: float = Field(..., ge=0.0)
    notes: Optional[str] = Field(None, max_length=500)
    expense_date: date


class ExpenseSchema(BaseModel):
    id: str
    crop_cycle_id: str
    category: ExpenseCategory
    amount: float
    notes: Optional[str]
    expense_date: date


# --- Harvest Schemas ---
class HarvestCreateSchema(BaseModel):
    crop_cycle_id: str
    yield_quantity: float = Field(..., ge=0.0)
    yield_unit: str = Field(..., min_length=1, max_length=20)
    revenue: float = Field(..., ge=0.0)
    harvest_date: date


class HarvestSchema(BaseModel):
    id: str
    crop_cycle_id: str
    yield_quantity: float
    yield_unit: str
    revenue: float
    harvest_date: date
