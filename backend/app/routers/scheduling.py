import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Campaign,
    CampaignContent,
    ContentSchedule,
    PublishingEvent,
)
from ..schemas import (
    ContentScheduleCreate,
    ContentScheduleUpdate,
    CancelScheduleRequest,
    ContentScheduleResponse,
    PublishingEventResponse,
    CalendarOverviewResponse,
)
from ..services.publishing_service import (
    create_schedule,
    update_schedule,
    cancel_schedule,
    publish_demo,
    build_schedule_response,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Content Scheduling & Publishing"])


@router.post(
    "/api/content/{content_id}/schedule",
    response_model=ContentScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
def schedule_content_endpoint(
    content_id: str,
    payload: ContentScheduleCreate,
    db: Session = Depends(get_db),
):
    """Schedules an approved content piece with strict governance verification."""
    return create_schedule(
        db=db,
        content_id=content_id,
        platform=payload.platform,
        scheduled_at=payload.scheduled_at,
        timezone_str=payload.timezone,
    )


@router.get(
    "/api/content/{content_id}/schedule",
    response_model=List[ContentScheduleResponse],
)
def get_content_schedules_endpoint(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves all schedule records for a specific content asset."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign content with ID '{content_id}' not found.",
        )

    schedules = (
        db.query(ContentSchedule)
        .filter(ContentSchedule.campaign_content_id == content_id)
        .order_by(ContentSchedule.scheduled_at.asc())
        .all()
    )
    return [build_schedule_response(s, db) for s in schedules]


@router.get(
    "/api/campaigns/{campaign_id}/calendar",
    response_model=List[ContentScheduleResponse],
)
def get_campaign_calendar_endpoint(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves all scheduled calendar items for a specific campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID '{campaign_id}' not found.",
        )

    schedules = (
        db.query(ContentSchedule)
        .filter(ContentSchedule.campaign_id == campaign_id)
        .order_by(ContentSchedule.scheduled_at.asc())
        .all()
    )
    return [build_schedule_response(s, db) for s in schedules]


@router.get(
    "/api/calendar",
    response_model=CalendarOverviewResponse,
)
def get_global_calendar_endpoint(
    start_date: Optional[str] = Query(None, description="Filter from start date (ISO string)"),
    end_date: Optional[str] = Query(None, description="Filter to end date (ISO string)"),
    platform: Optional[str] = Query(None, description="Filter by platform (e.g. instagram, linkedin, x, youtube_shorts)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (scheduled, published, failed, cancelled)"),
    campaign_id: Optional[str] = Query(None, description="Filter by campaign ID"),
    db: Session = Depends(get_db),
):
    """Retrieves omnichannel publishing calendar items with optional filters and summary stats."""
    query = db.query(ContentSchedule)

    if campaign_id:
        query = query.filter(ContentSchedule.campaign_id == campaign_id)

    if platform and platform.lower() != "all":
        query = query.filter(ContentSchedule.platform == platform.lower())

    if status_filter and status_filter.lower() != "all":
        query = query.filter(ContentSchedule.status == status_filter.lower())

    if start_date:
        try:
            st = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(ContentSchedule.scheduled_at >= st)
        except Exception:
            pass

    if end_date:
        try:
            et = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(ContentSchedule.scheduled_at <= et)
        except Exception:
            pass

    schedules = query.order_by(ContentSchedule.scheduled_at.asc()).all()

    # Calculate global counts across all schedules
    all_schedules = db.query(ContentSchedule).all()
    total_sched = len([s for s in all_schedules if s.status in ["scheduled", "draft", "publishing"]])
    total_pub = len([s for s in all_schedules if s.status == "published"])
    total_fail = len([s for s in all_schedules if s.status == "failed"])
    total_canc = len([s for s in all_schedules if s.status == "cancelled"])

    return CalendarOverviewResponse(
        total_scheduled=total_sched,
        total_published=total_pub,
        total_failed=total_fail,
        total_cancelled=total_canc,
        items=[build_schedule_response(s, db) for s in schedules],
    )


@router.patch(
    "/api/schedules/{schedule_id}",
    response_model=ContentScheduleResponse,
)
def update_schedule_endpoint(
    schedule_id: str,
    payload: ContentScheduleUpdate,
    db: Session = Depends(get_db),
):
    """Reschedules or updates parameters of a scheduled publication."""
    return update_schedule(
        db=db,
        schedule_id=schedule_id,
        scheduled_at=payload.scheduled_at,
        platform=payload.platform,
        timezone_str=payload.timezone,
    )


@router.post(
    "/api/schedules/{schedule_id}/cancel",
    response_model=ContentScheduleResponse,
)
def cancel_schedule_endpoint(
    schedule_id: str,
    payload: Optional[CancelScheduleRequest] = None,
    reason: Optional[str] = Query(None, description="Reason for cancellation"),
    db: Session = Depends(get_db),
):
    """Cancels a scheduled publication."""
    effective_reason = (payload.reason if payload and payload.reason else None) or reason or "User cancelled schedule"
    return cancel_schedule(
        db=db,
        schedule_id=schedule_id,
        reason=effective_reason,
    )


@router.get(
    "/api/schedules/{schedule_id}/history",
    response_model=List[PublishingEventResponse],
)
def get_schedule_history_endpoint(
    schedule_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves chronological publishing history and state transition events for a schedule."""
    schedule = db.query(ContentSchedule).filter(ContentSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content schedule with ID '{schedule_id}' not found.",
        )

    events = (
        db.query(PublishingEvent)
        .filter(PublishingEvent.schedule_id == schedule_id)
        .order_by(PublishingEvent.created_at.asc())
        .all()
    )
    return events


@router.post(
    "/api/schedules/{schedule_id}/publish-demo",
    response_model=ContentScheduleResponse,
)
def publish_demo_endpoint(
    schedule_id: str,
    simulate_failure: bool = Query(False, description="Set True to simulate a provider failure"),
    db: Session = Depends(get_db),
):
    """Executes a simulated demo publication through the simulated provider layer."""
    return publish_demo(
        db=db,
        schedule_id=schedule_id,
        simulate_failure=simulate_failure,
    )
