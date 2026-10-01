from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db, seed_initial_brand_data
from ..models import Brand, Product
from ..schemas import (
    BrandResponse,
    BrandUpdate,
    ProductResponse,
    SystemSettingsResponse,
    SystemSettingsUpdate,
    GovernancePolicyInfo,
    PublishingChannelInfo,
)

router = APIRouter(prefix="/api/brands", tags=["Brands"])
system_router = APIRouter(prefix="/api/system", tags=["System Settings"])


@router.get("/current", response_model=BrandResponse)
def get_current_brand(db: Session = Depends(get_db)):
    """Fetch the active Brand DNA profile."""
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()
        if not brand:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No brand profile found")
    return brand


@router.put("/current", response_model=BrandResponse)
def update_current_brand(update_data: BrandUpdate, db: Session = Depends(get_db)):
    """Update active Brand DNA profile attributes."""
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(brand, key, value)

    db.commit()
    db.refresh(brand)
    return brand


@router.get("/current/products", response_model=List[ProductResponse])
def get_current_products(db: Session = Depends(get_db)):
    """Fetch products associated with the active brand."""
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()

    products = db.query(Product).filter(Product.brand_id == brand.id).all()
    return products


def _build_system_settings(brand: Brand) -> SystemSettingsResponse:
    return SystemSettingsResponse(
        brand=BrandResponse.model_validate(brand),
        database_engine="SQLite (Local File Storage)",
        database_file="backend/brandforge.db",
        backend_port=settings.PORT,
        ai_model="Google Gemini 2.5 Flash",
        fallback_active=bool(not settings.GEMINI_API_KEY),
        default_timezone="Asia/Kolkata",
        governance_policies=[
            GovernancePolicyInfo(
                id="brand_voice",
                name="Brand Voice Fidelity",
                description="Enforces brand tone descriptors, stylistic constraints, and messaging consistency.",
                engine="BrandGuard + Gemini 2.5 Flash",
                status="Active",
                rule_count=len(brand.voice_descriptors or []) + len(brand.voice_traits or []),
                strict_enforcement=True,
            ),
            GovernancePolicyInfo(
                id="claim_guard",
                name="ClaimGuard Truth & Accuracy",
                description="Flags unsupported metrics, absolute guarantees, and unverified product claims.",
                engine="ClaimGuard Verification Engine",
                status="Active",
                rule_count=8,
                strict_enforcement=True,
            ),
            GovernancePolicyInfo(
                id="do_dont",
                name="Do & Don't Guidelines",
                description="Strictly validates mandatory inclusion patterns and prohibits banned terminology.",
                engine="Deterministic Rule Matrix",
                status="Active",
                rule_count=len(brand.do_list or []) + len(brand.dont_list or []),
                strict_enforcement=True,
            ),
            GovernancePolicyInfo(
                id="environmental_claims",
                name="Environmental & Regulatory Claims",
                description="Scans for greenwashing, false eco certifications, and regulated terminology.",
                engine="ClaimGuard Policy Module",
                status="Active",
                rule_count=4,
                strict_enforcement=True,
            ),
        ],
        publishing_channels=[
            PublishingChannelInfo(
                id="instagram",
                name="Instagram",
                type_label="Visual Carousel & Reels Caption",
                status="Ready (Synthetic Driver)",
                is_simulator=True,
                description="Simulated Instagram Graph API delivery with media container formatting.",
            ),
            PublishingChannelInfo(
                id="linkedin",
                name="LinkedIn",
                type_label="Thought-Leadership Article / Post",
                status="Ready (Synthetic Driver)",
                is_simulator=True,
                description="Simulated LinkedIn UGC Posts API delivery with formatted whitespace.",
            ),
            PublishingChannelInfo(
                id="x",
                name="X (Twitter)",
                type_label="Mini-Thread / Single Post",
                status="Ready (Synthetic Driver)",
                is_simulator=True,
                description="Simulated X API v2 Tweet & Thread sequential publication dispatcher.",
            ),
            PublishingChannelInfo(
                id="youtube_shorts",
                name="YouTube Shorts",
                type_label="30-45s Vertical Video Script",
                status="Ready (Synthetic Driver)",
                is_simulator=True,
                description="Simulated YouTube Data API v3 staging and caption metadata dispatcher.",
            ),
        ],
    )


@system_router.get("/settings", response_model=SystemSettingsResponse)
def get_system_settings(db: Session = Depends(get_db)):
    """Fetch complete workspace system settings and governance configuration."""
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()
    return _build_system_settings(brand)


@system_router.put("/settings", response_model=SystemSettingsResponse)
def update_system_settings(update_data: SystemSettingsUpdate, db: Session = Depends(get_db)):
    """Update workspace parameters and brand metadata."""
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()

    if update_data.brand_name is not None:
        brand.name = update_data.brand_name
    if update_data.tagline is not None:
        brand.tagline = update_data.tagline
    if update_data.industry is not None:
        brand.industry = update_data.industry
    if update_data.stage is not None:
        brand.stage = update_data.stage
    if update_data.mission is not None:
        brand.mission = update_data.mission

    db.commit()
    db.refresh(brand)
    return _build_system_settings(brand)

