import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Campaign, CampaignContent, CampaignPerformance
from ..schemas import (
    PerformanceEntryCreate,
    CampaignPerformanceResponse,
    GlobalAnalyticsResponse,
    CampaignAnalyticsResponse,
    ContentAnalyticsResponse,
    OptimizationRecommendation,
    DemoSeedRequest,
)
from ..services.analytics_service import (
    get_global_analytics,
    get_campaign_analytics,
    get_content_analytics,
    record_performance_data,
    seed_demo_performance_data,
)
from ..services.optimization_service import generate_optimization_recommendations
from ..services.memory_service import refresh_campaign_memory

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Omnichannel Analytics & Optimization"])


@router.get("/api/analytics", response_model=GlobalAnalyticsResponse)
def get_global_analytics_endpoint(
    date_range: str = Query("all", description="Date range: '7d', '30d', '90d', 'all'"),
    platform: Optional[str] = Query(None, description="Platform filter: 'instagram', 'linkedin', 'x', 'youtube_shorts'"),
    metric: str = Query("engagement_rate", description="Sorting metric: 'engagement_rate', 'clicks', 'conversions', 'saves', 'shares', 'impressions'"),
    db: Session = Depends(get_db),
):
    """Retrieves global omnichannel analytics, platform breakdowns, content leaderboards,
    trend curves, and AI performance insights.
    """
    try:
        return get_global_analytics(
            db=db,
            date_range=date_range,
            platform=platform,
            metric_sort=metric,
        )
    except Exception as e:
        logger.error(f"Error fetching global analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate global analytics: {str(e)}",
        )


@router.get("/api/campaigns/{campaign_id}/analytics", response_model=CampaignAnalyticsResponse)
def get_campaign_analytics_endpoint(
    campaign_id: str,
    date_range: str = Query("all", description="Date range: '7d', '30d', '90d', 'all'"),
    platform: Optional[str] = Query(None, description="Platform filter: 'instagram', 'linkedin', 'x', 'youtube_shorts'"),
    metric: str = Query("engagement_rate", description="Sorting metric: 'engagement_rate', 'clicks', 'conversions', 'saves', 'shares', 'impressions'"),
    db: Session = Depends(get_db),
):
    """Retrieves campaign-scoped analytics, platform performance, content leaderboard,
    trend timeline, and continuous optimization recommendations.
    """
    try:
        return get_campaign_analytics(
            db=db,
            campaign_id=campaign_id,
            date_range=date_range,
            platform=platform,
            metric_sort=metric,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching campaign analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate campaign analytics: {str(e)}",
        )


@router.get("/api/content/{content_id}/analytics", response_model=ContentAnalyticsResponse)
def get_content_analytics_endpoint(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves deep analytics and calculated performance rates for an individual content asset."""
    try:
        return get_content_analytics(db=db, content_id=content_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching content analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch content analytics: {str(e)}",
        )


@router.post("/api/campaigns/{campaign_id}/performance", response_model=CampaignPerformanceResponse, status_code=status.HTTP_201_CREATED)
def add_campaign_performance_endpoint(
    campaign_id: str,
    payload: PerformanceEntryCreate,
    db: Session = Depends(get_db),
):
    """Records manual/demo performance data for a campaign. Automatically triggers
    analytics recalculation and Campaign Memory update.
    """
    try:
        perf = record_performance_data(
            db=db,
            campaign_id=campaign_id,
            payload=payload,
        )
        # Refresh Campaign Memory in background of this request
        try:
            refresh_campaign_memory(db)
        except Exception as e:
            logger.warning(f"Note: Campaign Memory refresh deferred: {e}")

        return perf
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding performance data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record performance data: {str(e)}",
        )


@router.post("/api/content/{content_id}/performance", response_model=CampaignPerformanceResponse, status_code=status.HTTP_201_CREATED)
def add_content_performance_endpoint(
    content_id: str,
    payload: PerformanceEntryCreate,
    db: Session = Depends(get_db),
):
    """Records manual/demo performance data for a specific content asset."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Content '{content_id}' not found.")

    try:
        perf = record_performance_data(
            db=db,
            campaign_id=content.campaign_id,
            payload=payload,
            campaign_content_id=content_id,
        )
        try:
            refresh_campaign_memory(db)
        except Exception as e:
            logger.warning(f"Note: Campaign Memory refresh deferred: {e}")

        return perf
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding content performance data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record performance data: {str(e)}",
        )


@router.post("/api/analytics/demo-seed")
def seed_demo_data_endpoint(
    payload: DemoSeedRequest = DemoSeedRequest(),
    db: Session = Depends(get_db),
):
    """Seeds deterministic demo performance metrics for campaigns to demonstrate analytics."""
    try:
        created = seed_demo_performance_data(db, campaign_id=payload.campaign_id)
        if created:
            try:
                refresh_campaign_memory(db)
            except Exception as e:
                logger.warning(f"Note: Memory refresh deferred: {e}")

        return {
            "status": "success",
            "records_created": len(created),
            "message": f"Successfully seeded {len(created)} demo performance records.",
            "is_demo_data": True,
        }
    except Exception as e:
        logger.error(f"Error seeding demo data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed demo performance data: {str(e)}",
        )


@router.get("/api/optimization/recommendations", response_model=List[OptimizationRecommendation])
def get_optimization_recommendations_endpoint(
    campaign_id: Optional[str] = Query(None, description="Optional target campaign ID"),
    db: Session = Depends(get_db),
):
    """Retrieves AI continuous optimization recommendations for next campaign planning."""
    try:
        return generate_optimization_recommendations(db=db, campaign_id=campaign_id)
    except Exception as e:
        logger.error(f"Error generating optimization recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}",
        )
