import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import (
    Campaign,
    CampaignContent,
    ContentAudit,
    ContentSchedule,
    PublishingEvent,
)
from ..schemas import (
    ContentScheduleResponse,
    PublishingEventResponse,
)

logger = logging.getLogger(__name__)


def validate_content_for_scheduling(
    db: Session,
    content_id: str,
    platform: Optional[str],
    scheduled_at: Optional[datetime],
) -> CampaignContent:
    """Validates that a content asset meets all governance prerequisites before scheduling.
    
    Rules:
    1. Content must exist.
    2. Content must have an approval state.
    3. Content approval status must be 'approved'.
    4. Current audit must exist.
    5. Current audit must have is_current == True.
    6. Current audit overall_status must NOT be 'fail'.
    7. Selected platform (if provided) must match the content's generated platform.
    8. Scheduled time must be provided and valid.
    9. Prevent duplicate active schedules for the same content.
    """
    # Rule 1: Content exists
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign content with ID '{content_id}' not found.",
        )

    # Rule 2 & 3: Human approval check
    if content.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule content: content must be approved before scheduling.",
        )

    # Rule 4 & 5: Current audit exists and is not stale
    curr_audit = (
        db.query(ContentAudit)
        .filter(ContentAudit.campaign_content_id == content.id, ContentAudit.is_current == True)
        .order_by(ContentAudit.created_at.desc())
        .first()
    )
    if not curr_audit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule content: cannot be scheduled without a current BrandGuard audit.",
        )

    # Rule 6: Current audit status is NOT fail
    if curr_audit.overall_status == "fail":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule content: BrandGuard / ClaimGuard audit failed. Resolve findings before scheduling.",
        )

    # Rule 7: Platform matching (if specified)
    if platform:
        norm_platform = platform.lower().replace(" ", "_")
        norm_content_platform = content.platform.lower().replace(" ", "_")
        if norm_platform != norm_content_platform:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected platform '{platform}' does not match content platform '{content.platform}'.",
            )

    # Rule 8: Valid scheduled time
    if not scheduled_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid scheduled time is required.",
        )

    # Rule 9: Check duplicate active schedules
    active_sched = (
        db.query(ContentSchedule)
        .filter(
            ContentSchedule.campaign_content_id == content.id,
            ContentSchedule.status.in_(["scheduled", "publishing"]),
        )
        .first()
    )
    if active_sched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content already has an active schedule. Use reschedule or cancel the existing schedule first.",
        )

    return content


def build_schedule_response(schedule: ContentSchedule, db: Session) -> ContentScheduleResponse:
    """Builds a rich ContentScheduleResponse with content and campaign metadata."""
    content = schedule.content
    campaign = schedule.campaign

    audit_status = None
    if content:
        curr_audit = (
            db.query(ContentAudit)
            .filter(ContentAudit.campaign_content_id == content.id, ContentAudit.is_current == True)
            .first()
        )
        if curr_audit:
            audit_status = curr_audit.overall_status

    events = [
        PublishingEventResponse.model_validate(e)
        for e in schedule.publishing_events
    ]

    return ContentScheduleResponse(
        id=schedule.id,
        campaign_content_id=schedule.campaign_content_id,
        campaign_id=schedule.campaign_id,
        platform=schedule.platform,
        scheduled_at=schedule.scheduled_at,
        timezone=schedule.timezone,
        status=schedule.status,
        publish_attempts=schedule.publish_attempts,
        published_at=schedule.published_at,
        cancelled_at=schedule.cancelled_at,
        failure_reason=schedule.failure_reason,
        external_post_id=schedule.external_post_id,
        content_title=content.title if content else None,
        content_body=content.body if content else None,
        content_hook=content.hook if content else None,
        content_cta=content.call_to_action if content else None,
        content_visual_concept=content.visual_concept if content else None,
        approval_status=content.approval_status if content else None,
        audit_status=audit_status,
        campaign_name=campaign.name if campaign else None,
        publishing_events=events,
        events=events,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


def create_schedule(
    db: Session,
    content_id: str,
    platform: Optional[str],
    scheduled_at: datetime,
    timezone_str: str = "Asia/Kolkata",
) -> ContentScheduleResponse:
    """Validates governance rules and creates a new persistent ContentSchedule record."""
    content = validate_content_for_scheduling(db, content_id, platform, scheduled_at)
    target_platform = (platform or content.platform).lower().replace(" ", "_")

    now = datetime.now(timezone.utc)
    new_schedule = ContentSchedule(
        id=str(uuid.uuid4()),
        campaign_content_id=content.id,
        campaign_id=content.campaign_id,
        platform=target_platform,
        scheduled_at=scheduled_at,
        timezone=timezone_str or "Asia/Kolkata",
        status="scheduled",
        publish_attempts=0,
        created_at=now,
        updated_at=now,
    )
    db.add(new_schedule)
    db.flush()

    # Log initial scheduling event
    event = PublishingEvent(
        id=str(uuid.uuid4()),
        schedule_id=new_schedule.id,
        event_type="scheduled",
        message=f"Content scheduled for {target_platform.title()} publication at {scheduled_at.isoformat()} ({timezone_str}).",
        created_at=now,
    )
    db.add(event)

    db.commit()
    db.refresh(new_schedule)

    return build_schedule_response(new_schedule, db)


def update_schedule(
    db: Session,
    schedule_id: str,
    scheduled_at: Optional[datetime] = None,
    platform: Optional[str] = None,
    timezone_str: Optional[str] = None,
) -> ContentScheduleResponse:
    """Updates an existing schedule (e.g. rescheduling) and logs the event."""
    schedule = db.query(ContentSchedule).filter(ContentSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content schedule with ID '{schedule_id}' not found.",
        )

    if schedule.status in ["published", "cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reschedule content with status '{schedule.status}'.",
        )

    content = schedule.content
    if not content or content.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule content: content must be approved.",
        )

    now = datetime.now(timezone.utc)

    if platform:
        norm_platform = platform.lower().replace(" ", "_")
        if norm_platform != content.platform.lower().replace(" ", "_"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected platform '{platform}' does not match content platform '{content.platform}'.",
            )
        schedule.platform = norm_platform

    if scheduled_at:
        schedule.scheduled_at = scheduled_at

    if timezone_str:
        schedule.timezone = timezone_str

    schedule.status = "scheduled"
    schedule.updated_at = now

    event = PublishingEvent(
        id=str(uuid.uuid4()),
        schedule_id=schedule.id,
        event_type="rescheduled",
        message=f"Rescheduled for {schedule.platform.title()} at {schedule.scheduled_at.isoformat()} ({schedule.timezone}).",
        created_at=now,
    )
    db.add(event)

    db.commit()
    db.refresh(schedule)

    return build_schedule_response(schedule, db)


def cancel_schedule(
    db: Session,
    schedule_id: str,
    reason: str = "User cancelled schedule",
) -> ContentScheduleResponse:
    """Cancels a scheduled publication and logs the cancellation event."""
    schedule = db.query(ContentSchedule).filter(ContentSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content schedule with ID '{schedule_id}' not found.",
        )

    if schedule.status in ["published", "cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel schedule with status '{schedule.status}'.",
        )

    now = datetime.now(timezone.utc)
    schedule.status = "cancelled"
    schedule.cancelled_at = now
    schedule.failure_reason = reason
    schedule.updated_at = now

    event = PublishingEvent(
        id=str(uuid.uuid4()),
        schedule_id=schedule.id,
        event_type="cancelled",
        message=f"Schedule cancelled: {reason}",
        created_at=now,
    )
    db.add(event)

    db.commit()
    db.refresh(schedule)

    return build_schedule_response(schedule, db)


def publish_demo(
    db: Session,
    schedule_id: str,
    simulate_failure: bool = False,
) -> ContentScheduleResponse:
    """Simulates immediate execution of a scheduled item through the demo publishing provider."""
    schedule = db.query(ContentSchedule).filter(ContentSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content schedule with ID '{schedule_id}' not found.",
        )

    if schedule.status not in ["scheduled", "failed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish content with status '{schedule.status}'. Only 'scheduled' or 'failed' content can be published.",
        )

    content = schedule.content
    if not content or content.approval_status != "approved":
        schedule.status = "failed"
        schedule.failure_reason = "Publishing blocked: human approval is required."
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish content: human approval is required.",
        )

    curr_audit = (
        db.query(ContentAudit)
        .filter(ContentAudit.campaign_content_id == content.id, ContentAudit.is_current == True)
        .first()
    )
    if not curr_audit or curr_audit.overall_status == "fail":
        schedule.status = "failed"
        schedule.failure_reason = "Publishing blocked: current BrandGuard audit is stale or failed."
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish content: current BrandGuard audit is stale or failed.",
        )

    now = datetime.now(timezone.utc)
    schedule.publish_attempts = (schedule.publish_attempts or 0) + 1

    # Record publish started event
    start_event = PublishingEvent(
        id=str(uuid.uuid4()),
        schedule_id=schedule.id,
        event_type="publish_started",
        message=f"Demo publication initiated for {schedule.platform.title()}.",
        created_at=now,
    )
    db.add(start_event)

    if simulate_failure:
        schedule.status = "failed"
        schedule.failure_reason = "Demo publishing failed: simulated provider failure."
        schedule.updated_at = now

        fail_event = PublishingEvent(
            id=str(uuid.uuid4()),
            schedule_id=schedule.id,
            event_type="publish_failed",
            message=f"Demo publishing failed on {schedule.platform.title()}: simulated provider failure.",
            created_at=now,
        )
        db.add(fail_event)
    else:
        schedule.status = "published"
        schedule.published_at = now
        synthetic_post_id = f"demo_{schedule.platform.lower()}_{uuid.uuid4().hex[:10]}"
        schedule.external_post_id = synthetic_post_id
        schedule.failure_reason = None
        schedule.updated_at = now

        succ_event = PublishingEvent(
            id=str(uuid.uuid4()),
            schedule_id=schedule.id,
            event_type="publish_succeeded",
            message=f"Demo publication completed for {schedule.platform.title()}. Synthetic post ID: {synthetic_post_id}",
            created_at=now,
        )
        db.add(succ_event)

    db.commit()
    db.refresh(schedule)

    return build_schedule_response(schedule, db)
