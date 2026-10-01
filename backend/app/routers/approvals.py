import uuid
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    CampaignContent,
    ContentAudit,
    ContentRevision,
    ApprovalAction,
    ContentSchedule,
    PublishingEvent,
)
from ..schemas import (
    HumanApprovalResponse,
    RequestChangesRequest,
    RejectRequest,
    CreateRevisionRequest,
    ContentRevisionResponse,
    ApprovalActionResponse,
    ContentAuditResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Approvals"])


def _ensure_initial_revision_and_action(content: CampaignContent, db: Session):
    """Ensures Revision 1 and initial submission action exist for legacy or newly created content."""
    rev_count = db.query(ContentRevision).filter(ContentRevision.campaign_content_id == content.id).count()
    if rev_count == 0:
        rev1 = ContentRevision(
            campaign_content_id=content.id,
            revision_number=1,
            title=content.title,
            body=content.body,
            hook=content.hook,
            call_to_action=content.call_to_action,
            visual_concept=content.visual_concept,
            metadata_info=content.metadata_info or {},
            revision_reason="Original AI generation",
            created_at=content.created_at or datetime.utcnow(),
        )
        db.add(rev1)

    has_submitted = (
        db.query(ApprovalAction)
        .filter(
            ApprovalAction.campaign_content_id == content.id,
            ApprovalAction.action == "submitted",
        )
        .first()
    )
    if not has_submitted:
        act1 = ApprovalAction(
            campaign_content_id=content.id,
            action="submitted",
            feedback="Initial content generated and submitted for review",
            revision_number=1,
            created_at=content.created_at or datetime.utcnow(),
        )
        db.add(act1)

    db.flush()



def _build_approval_response(content: CampaignContent, db: Session) -> HumanApprovalResponse:
    """Builds a structured HumanApprovalResponse including current audit, revisions, and history."""
    _ensure_initial_revision_and_action(content, db)
    db.commit()
    db.refresh(content)

    # Load latest current audit
    latest_current_audit = (
        db.query(ContentAudit)
        .filter(ContentAudit.campaign_content_id == content.id, ContentAudit.is_current == True)
        .order_by(ContentAudit.created_at.desc())
        .first()
    )

    is_audit_current = latest_current_audit is not None
    latest_audit_status = latest_current_audit.overall_status if latest_current_audit else None
    latest_audit_response = ContentAuditResponse.model_validate(latest_current_audit) if latest_current_audit else None

    # Load revisions ordered by revision_number ascending
    revisions = (
        db.query(ContentRevision)
        .filter(ContentRevision.campaign_content_id == content.id)
        .order_by(ContentRevision.revision_number.asc())
        .all()
    )
    revision_responses = [ContentRevisionResponse.model_validate(r) for r in revisions]

    # Load approval history actions ordered by created_at ascending
    history = (
        db.query(ApprovalAction)
        .filter(ApprovalAction.campaign_content_id == content.id)
        .order_by(ApprovalAction.created_at.asc())
        .all()
    )
    history_responses = [ApprovalActionResponse.model_validate(a) for a in history]

    return HumanApprovalResponse(
        campaign_content_id=content.id,
        campaign_id=content.campaign_id,
        strategy_id=content.strategy_id,
        platform=content.platform,
        content_type=content.content_type,
        title=content.title,
        body=content.body,
        hook=content.hook,
        call_to_action=content.call_to_action,
        visual_concept=content.visual_concept,
        approval_status=content.approval_status or "pending_review",
        reviewer_feedback=content.reviewer_feedback,
        revision_number=content.revision_number or 1,
        approved_at=content.approved_at,
        latest_audit_status=latest_audit_status,
        is_audit_current=is_audit_current,
        latest_audit=latest_audit_response,
        revisions=revision_responses,
        approval_history=history_responses,
        created_at=content.created_at or datetime.utcnow(),
        updated_at=content.updated_at,
    )


@router.get(
    "/api/content/{content_id}/approval",
    response_model=HumanApprovalResponse,
    status_code=status.HTTP_200_OK,
)
def get_content_approval_state(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves full approval state, revisions, and history for a campaign content piece."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    return _build_approval_response(content, db)


@router.post(
    "/api/content/{content_id}/submit-review",
    response_model=HumanApprovalResponse,
    status_code=status.HTTP_200_OK,
)
def submit_content_for_review(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Submits or resets content to pending human review."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    content.approval_status = "pending_review"
    content.updated_at = datetime.utcnow()

    action = ApprovalAction(
        campaign_content_id=content.id,
        action="submitted",
        feedback="Submitted for human review",
        revision_number=content.revision_number or 1,
        created_at=datetime.utcnow(),
    )
    db.add(action)
    db.commit()
    db.refresh(content)

    return _build_approval_response(content, db)


@router.post(
    "/api/content/{content_id}/request-changes",
    response_model=HumanApprovalResponse,
    status_code=status.HTTP_200_OK,
)
def request_changes_endpoint(
    content_id: str,
    payload: RequestChangesRequest,
    db: Session = Depends(get_db),
):
    """Marks content as requiring changes and attaches required reviewer feedback."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    feedback_text = payload.feedback.strip()
    if not feedback_text:
        raise HTTPException(status_code=400, detail="Feedback is required when requesting changes.")

    content.approval_status = "changes_requested"
    content.reviewer_feedback = feedback_text
    content.updated_at = datetime.utcnow()

    action = ApprovalAction(
        campaign_content_id=content.id,
        action="changes_requested",
        feedback=feedback_text,
        revision_number=content.revision_number or 1,
        created_at=datetime.utcnow(),
    )
    db.add(action)
    db.commit()
    db.refresh(content)

    return _build_approval_response(content, db)


@router.post(
    "/api/content/{content_id}/approve",
    response_model=HumanApprovalResponse,
    status_code=status.HTTP_200_OK,
)
def approve_content_endpoint(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Approves a content piece. Enforces strict governance: blocks approval if audit failed or stale."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    # Check current audit
    latest_current_audit = (
        db.query(ContentAudit)
        .filter(ContentAudit.campaign_content_id == content.id, ContentAudit.is_current == True)
        .order_by(ContentAudit.created_at.desc())
        .first()
    )

    if not latest_current_audit:
        raise HTTPException(
            status_code=400,
            detail="Content cannot be approved without a current BrandGuard audit. Please run BrandGuard audit first.",
        )

    if latest_current_audit.overall_status == "fail":
        raise HTTPException(
            status_code=400,
            detail="Content cannot be approved while the latest BrandGuard audit has critical failures.",
        )

    content.approval_status = "approved"
    content.approved_at = datetime.utcnow()
    content.updated_at = datetime.utcnow()

    action = ApprovalAction(
        campaign_content_id=content.id,
        action="approved",
        feedback=f"Approved with BrandGuard audit status: {latest_current_audit.overall_status.upper()}",
        revision_number=content.revision_number or 1,
        created_at=datetime.utcnow(),
    )
    db.add(action)
    db.commit()
    db.refresh(content)

    return _build_approval_response(content, db)


@router.post(
    "/api/content/{content_id}/reject",
    response_model=HumanApprovalResponse,
    status_code=status.HTTP_200_OK,
)
def reject_content_endpoint(
    content_id: str,
    payload: Optional[RejectRequest] = None,
    db: Session = Depends(get_db),
):
    """Rejects a content piece with optional feedback reasoning."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    feedback_text = (payload.feedback.strip() if payload and payload.feedback else "Content rejected by reviewer.")

    content.approval_status = "rejected"
    content.reviewer_feedback = feedback_text
    content.approved_at = None
    content.updated_at = datetime.utcnow()

    action = ApprovalAction(
        campaign_content_id=content.id,
        action="rejected",
        feedback=feedback_text,
        revision_number=content.revision_number or 1,
        created_at=datetime.utcnow(),
    )
    db.add(action)
    db.commit()
    db.refresh(content)

    return _build_approval_response(content, db)


@router.post(
    "/api/content/{content_id}/revisions",
    response_model=HumanApprovalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_content_revision_endpoint(
    content_id: str,
    payload: CreateRevisionRequest,
    db: Session = Depends(get_db),
):
    """Saves a new revision for a content piece, updates current content, sets status to pending_review, and invalidates stale audits."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    body_text = payload.body.strip()
    if not body_text:
        raise HTTPException(status_code=400, detail="Content body cannot be empty.")

    reason_text = payload.revision_reason.strip()
    if not reason_text:
        raise HTTPException(status_code=400, detail="Revision reason is required to document changes.")

    _ensure_initial_revision_and_action(content, db)

    # Increment revision number
    new_rev_number = (content.revision_number or 1) + 1

    # Record new ContentRevision
    new_revision = ContentRevision(
        campaign_content_id=content.id,
        revision_number=new_rev_number,
        title=payload.title,
        body=body_text,
        hook=payload.hook,
        call_to_action=payload.call_to_action,
        visual_concept=payload.visual_concept,
        metadata_info=content.metadata_info or {},
        revision_reason=reason_text,
        created_at=datetime.utcnow(),
    )
    db.add(new_revision)

    # Update current CampaignContent fields
    content.title = payload.title
    content.body = body_text
    content.hook = payload.hook
    content.call_to_action = payload.call_to_action
    content.visual_concept = payload.visual_concept
    content.revision_number = new_rev_number
    content.approval_status = "pending_review"
    content.approved_at = None
    content.updated_at = datetime.utcnow()

    # AUDIT INVALIDATION: Previous audit is now stale for this revised content
    db.query(ContentAudit).filter(ContentAudit.campaign_content_id == content.id).update({"is_current": False})

    # SCHEDULE CANCELLATION (Revision Safety): Cancel any active schedules for this revised content
    now = datetime.utcnow()
    active_schedules = (
        db.query(ContentSchedule)
        .filter(
            ContentSchedule.campaign_content_id == content.id,
            ContentSchedule.status.in_(["scheduled", "draft", "publishing"]),
        )
        .all()
    )
    for sched in active_schedules:
        sched.status = "cancelled"
        sched.cancelled_at = now
        sched.failure_reason = "Content revised — previous schedule cancelled"
        sched.updated_at = now

        cancel_evt = PublishingEvent(
            id=str(uuid.uuid4()),
            schedule_id=sched.id,
            event_type="cancelled",
            message="Content revised — previous schedule cancelled. Re-audit and re-approval required.",
            created_at=now,
        )
        db.add(cancel_evt)

    # Record approval action
    action = ApprovalAction(
        campaign_content_id=content.id,
        action="revision_created",
        feedback=f"Revision {new_rev_number} created: {reason_text}",
        revision_number=new_rev_number,
        created_at=now,
    )
    db.add(action)

    db.commit()
    db.refresh(content)

    return _build_approval_response(content, db)
