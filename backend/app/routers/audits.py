import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Brand, Product, Campaign, CampaignStrategy, CampaignContent, ContentAudit, AuditFinding
from ..schemas import ContentAuditResponse, CampaignAuditResponse
from ..services.audit_service import audit_content_item, compute_overall_audit_status

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audits"])


def _audit_single_content(content: CampaignContent, db: Session) -> ContentAudit:
    """Helper to run audit on a single CampaignContent, persist to DB, and return the ContentAudit model."""
    campaign = db.query(Campaign).filter(Campaign.id == content.campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    strategy = db.query(CampaignStrategy).filter(CampaignStrategy.id == content.strategy_id).first()
    
    # Load Brand
    brand = None
    if campaign.brand_id:
        brand = db.query(Brand).filter(Brand.id == campaign.brand_id).first()
    if not brand:
        brand = db.query(Brand).first()

    # Load Product
    product = None
    if brand and campaign.product_name:
        product = db.query(Product).filter(
            Product.brand_id == brand.id,
            Product.name.ilike(f"%{campaign.product_name}%"),
        ).first()
    if not product and brand:
        product = db.query(Product).filter(Product.brand_id == brand.id).first()

    # Serialize data for audit service
    brand_data = {
        "name": brand.name if brand else "Arkiva Studio",
        "tagline": brand.tagline if brand else "",
        "mission": brand.mission if brand else "",
        "values": brand.values if brand else [],
        "voice_traits": brand.voice_traits if brand else [],
        "voice_descriptors": brand.voice_descriptors if brand else [],
        "messaging_pillars": brand.messaging_pillars if brand else [],
        "do_list": brand.do_list if brand else [],
        "dont_list": brand.dont_list if brand else [],
        "target_audience": brand.target_audience if brand else [],
        "visual_identity": brand.visual_identity if brand else {},
    }

    campaign_data = {
        "id": campaign.id,
        "name": campaign.name,
        "product_name": campaign.product_name,
        "objective": campaign.objective,
        "audience": campaign.audience,
        "duration": campaign.duration,
        "message": campaign.message,
        "instructions": campaign.instructions,
    }

    strategy_data = {
        "id": strategy.id if strategy else "",
        "strategy_type": strategy.strategy_type if strategy else "",
        "label": strategy.label if strategy else "",
        "tagline": strategy.tagline if strategy else "",
        "description": strategy.description if strategy else "",
        "content_pillars": strategy.content_pillars if strategy else [],
        "tone": strategy.tone if strategy else "",
    }

    product_data = {
        "name": product.name if product else campaign.product_name,
        "price": product.price if product else "$0",
        "description": product.description if product else "",
        "product_type": product.product_type if product else "Core Product",
    }

    content_data = {
        "id": content.id,
        "platform": content.platform,
        "content_type": content.content_type,
        "title": content.title,
        "hook": content.hook,
        "body": content.body,
        "call_to_action": content.call_to_action,
        "visual_concept": content.visual_concept,
        "metadata_info": content.metadata_info,
    }

    # Run audit
    audit_output = audit_content_item(
        content_data=content_data,
        brand_data=brand_data,
        campaign_data=campaign_data,
        strategy_data=strategy_data,
        product_data=product_data,
    )

    # Compute deterministic overall status
    overall_status = compute_overall_audit_status(audit_output.findings)

    # Clear prior audits for this content item to maintain freshness
    db.query(ContentAudit).filter(ContentAudit.campaign_content_id == content.id).delete()
    db.flush()

    # Create new ContentAudit
    audit_model = ContentAudit(
        campaign_content_id=content.id,
        overall_status=overall_status,
        summary=audit_output.summary,
        is_current=True,
    )
    db.add(audit_model)
    db.flush()

    # Create AuditFinding records
    for f in audit_output.findings:
        finding_model = AuditFinding(
            audit_id=audit_model.id,
            guard_type=f.guard_type,
            category=f.category,
            severity=f.severity,
            status=f.status,
            title=f.title,
            evidence=f.evidence,
            explanation=f.explanation,
            suggestion=f.suggestion,
        )
        db.add(finding_model)

    db.commit()
    db.refresh(audit_model)
    return audit_model


@router.post(
    "/api/content/{content_id}/audit",
    response_model=ContentAuditResponse,
    status_code=status.HTTP_200_OK,
)
def audit_content_endpoint(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Audits an individual content piece against Brand DNA and Product Knowledge."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    audit_model = _audit_single_content(content, db)
    return audit_model


@router.get(
    "/api/content/{content_id}/audit",
    response_model=ContentAuditResponse,
    status_code=status.HTTP_200_OK,
)
def get_content_audit_endpoint(
    content_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves the latest audit for a specific content item."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Campaign content not found")

    audit_model = (
        db.query(ContentAudit)
        .filter(ContentAudit.campaign_content_id == content_id, ContentAudit.is_current == True)
        .order_by(ContentAudit.created_at.desc())
        .first()
    )

    if not audit_model:
        # If not yet audited, run audit on demand
        audit_model = _audit_single_content(content, db)

    return audit_model


@router.post(
    "/api/campaigns/{campaign_id}/audit",
    response_model=CampaignAuditResponse,
    status_code=status.HTTP_200_OK,
)
def audit_campaign_endpoint(
    campaign_id: str,
    strategy_id: Optional[str] = Query(None, description="Filter by strategy ID or strategy type"),
    db: Session = Depends(get_db),
):
    """Audits all content pieces for a campaign (or specific strategy) and computes overall compliance."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(CampaignContent).filter(CampaignContent.campaign_id == campaign_id)

    if strategy_id:
        # Check if strategy_id is a UUID or a strategy_type ("product", "story", "community")
        strat = db.query(CampaignStrategy).filter(
            CampaignStrategy.campaign_id == campaign_id,
            (CampaignStrategy.id == strategy_id) | (CampaignStrategy.strategy_type == strategy_id),
        ).first()
        if strat:
            query = query.filter(CampaignContent.strategy_id == strat.id)
        else:
            query = query.filter(CampaignContent.strategy_id == strategy_id)

    contents = query.all()
    if not contents:
        raise HTTPException(
            status_code=400,
            detail="No content items found for this campaign to audit. Please generate content first.",
        )

    audits: List[ContentAudit] = []
    for content in contents:
        audit_model = _audit_single_content(content, db)
        audits.append(audit_model)

    # Compute campaign overall status
    statuses = [a.overall_status for a in audits]
    if "fail" in statuses:
        campaign_overall = "fail"
    elif "warning" in statuses:
        campaign_overall = "warning"
    else:
        campaign_overall = "pass"

    return CampaignAuditResponse(
        campaign_id=campaign_id,
        overall_status=campaign_overall,
        total_audited=len(audits),
        audits=audits,
    )
