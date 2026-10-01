import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Brand,
    Campaign,
    CampaignContent,
    CampaignInsight,
    CampaignPerformance,
    CampaignLearningSource,
)
from ..schemas import (
    CampaignMemoryResponse,
    CampaignInsightResponse,
    CampaignPerformanceCreate,
    CampaignPerformanceResponse,
)
from ..services.memory_service import (
    get_current_campaign_memory,
    refresh_campaign_memory,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Campaign Memory & Learnings"])


@router.get("/api/memory", response_model=CampaignMemoryResponse)
def get_campaign_memory(db: Session = Depends(get_db)):
    """Retrieves current campaign memory state, active cross-campaign insights, and learning health."""
    try:
        return get_current_campaign_memory(db)
    except Exception as e:
        logger.error(f"Error fetching campaign memory: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch campaign memory: {str(e)}",
        )


@router.post("/api/memory/refresh", response_model=CampaignMemoryResponse)
def refresh_memory(db: Session = Depends(get_db)):
    """Idempotently re-analyzes all campaign data, governance patterns, reviewer revisions,
    and performance metrics to update persistent cross-campaign insights.
    """
    try:
        return refresh_campaign_memory(db)
    except Exception as e:
        logger.error(f"Error refreshing campaign memory: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh campaign memory: {str(e)}",
        )


@router.get("/api/memory/insights/{insight_id}", response_model=CampaignInsightResponse)
def get_memory_insight_detail(insight_id: str, db: Session = Depends(get_db)):
    """Retrieves an individual memory insight by ID, including all traceable evidence links."""
    insight = db.query(CampaignInsight).filter(CampaignInsight.id == insight_id).first()
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insight with ID '{insight_id}' not found.",
        )
    return insight


@router.get("/api/campaigns/{campaign_id}/memory", response_model=List[CampaignInsightResponse])
def get_memory_for_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Retrieves memory insights relevant to a specific campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID '{campaign_id}' not found.",
        )

    # First check if there are insights with learning sources pointing to this campaign
    sources = db.query(CampaignLearningSource).filter(CampaignLearningSource.campaign_id == campaign_id).all()
    insight_ids = list(set(s.insight_id for s in sources))

    if insight_ids:
        insights = db.query(CampaignInsight).filter(CampaignInsight.id.in_(insight_ids)).all()
        return insights

    # Otherwise return general active insights
    return db.query(CampaignInsight).filter(CampaignInsight.is_active == True).all()


@router.post("/api/campaigns/{campaign_id}/performance", response_model=CampaignPerformanceResponse, status_code=status.HTTP_201_CREATED)
def record_campaign_performance(
    campaign_id: str,
    perf_in: CampaignPerformanceCreate,
    db: Session = Depends(get_db),
):
    """Records performance metrics (impressions, reach, likes, saves, clicks, conversions)
    for a campaign or specific campaign content asset with strict validation.
    """
    from ..schemas import PerformanceEntryCreate
    from ..services.analytics_service import record_performance_data

    try:
        entry = PerformanceEntryCreate(
            platform=perf_in.platform,
            campaign_content_id=perf_in.campaign_content_id,
            impressions=perf_in.impressions,
            reach=perf_in.reach or perf_in.impressions,
            likes=perf_in.likes,
            comments=perf_in.comments,
            shares=perf_in.shares,
            saves=perf_in.saves,
            clicks=perf_in.clicks,
            conversions=perf_in.conversions,
        )

        perf = record_performance_data(
            db=db,
            campaign_id=campaign_id,
            payload=entry,
            campaign_content_id=perf_in.campaign_content_id,
        )
        try:
            refresh_campaign_memory(db)
        except Exception as e:
            logger.warning(f"Could not auto-refresh memory after performance entry: {e}")

        return perf
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Validation error: {str(e)}")




@router.get("/api/campaigns/{campaign_id}/performance", response_model=List[CampaignPerformanceResponse])
def get_campaign_performance(campaign_id: str, db: Session = Depends(get_db)):
    """Retrieves all recorded performance metrics for a specific campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID '{campaign_id}' not found.",
        )

    return db.query(CampaignPerformance).filter(CampaignPerformance.campaign_id == campaign_id).order_by(CampaignPerformance.recorded_at.desc()).all()
