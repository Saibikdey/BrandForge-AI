import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db, seed_initial_brand_data
from ..models import (
    Campaign,
    CampaignStrategy,
    CampaignContent,
    Brand,
    Product,
    ContentRevision,
    ApprovalAction,
    ContentAudit,
    AuditFinding,
    CampaignPerformance,
    ContentSchedule,
    PublishingEvent,
    CampaignLearningSource,
)
from ..schemas import (
    CampaignCreate,
    CampaignResponse,
    StrategyResponse,
    StrategySelectionUpdate,
    GenerateContentRequest,
    CampaignContentResponse,
    RepurposeContentRequest,
    RepurposeContentResponse,
    SUPPORTED_PLATFORMS,
)
from ..services.llm_service import (
    generate_campaign_strategies,
    generate_platform_content,
    repurpose_content_items,
)


router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])
content_router = APIRouter(prefix="/api/content", tags=["Content"])



@router.get("", response_model=List[CampaignResponse])
def list_campaigns(db: Session = Depends(get_db)):
    """Fetch all campaigns ordered by creation date descending."""
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(campaign_in: CampaignCreate, db: Session = Depends(get_db)):
    """Save a new campaign draft."""
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()

    campaign = Campaign(
        id=str(uuid.uuid4()),
        brand_id=brand.id if brand else None,
        name=campaign_in.name,
        product_name=campaign_in.product_name,
        objective=campaign_in.objective,
        audience=campaign_in.audience,
        duration=campaign_in.duration,
        message=campaign_in.message,
        instructions=campaign_in.instructions,
        platforms=campaign_in.platforms,
        status="draft",
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Fetch campaign details by ID."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found")
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK)
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Delete a campaign and safely cascade-delete all associated contents, strategies, audits, schedules, and metrics."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found")

    # 1. Collect content IDs and schedule IDs
    contents = db.query(CampaignContent).filter(CampaignContent.campaign_id == campaign_id).all()
    content_ids = [c.id for c in contents]

    schedules = db.query(ContentSchedule).filter(
        (ContentSchedule.campaign_id == campaign_id) | 
        (ContentSchedule.campaign_content_id.in_(content_ids) if content_ids else False)
    ).all()
    schedule_ids = [s.id for s in schedules]

    # 2. Delete publishing events
    if schedule_ids:
        db.query(PublishingEvent).filter(PublishingEvent.schedule_id.in_(schedule_ids)).delete(synchronize_session=False)

    # 3. Delete content schedules
    if schedule_ids:
        db.query(ContentSchedule).filter(ContentSchedule.id.in_(schedule_ids)).delete(synchronize_session=False)

    # 4. Delete audit findings and audits
    if content_ids:
        audits = db.query(ContentAudit).filter(ContentAudit.campaign_content_id.in_(content_ids)).all()
        audit_ids = [a.id for a in audits]
        if audit_ids:
            db.query(AuditFinding).filter(AuditFinding.audit_id.in_(audit_ids)).delete(synchronize_session=False)
        db.query(ContentAudit).filter(ContentAudit.campaign_content_id.in_(content_ids)).delete(synchronize_session=False)

        # 5. Delete revisions and approval actions
        db.query(ContentRevision).filter(ContentRevision.campaign_content_id.in_(content_ids)).delete(synchronize_session=False)
        db.query(ApprovalAction).filter(ApprovalAction.campaign_content_id.in_(content_ids)).delete(synchronize_session=False)

    # 6. Delete performance records
    db.query(CampaignPerformance).filter(
        (CampaignPerformance.campaign_id == campaign_id) |
        (CampaignPerformance.campaign_content_id.in_(content_ids) if content_ids else False)
    ).delete(synchronize_session=False)

    # 7. Delete learning sources
    db.query(CampaignLearningSource).filter(
        (CampaignLearningSource.campaign_id == campaign_id) |
        (CampaignLearningSource.campaign_content_id.in_(content_ids) if content_ids else False)
    ).delete(synchronize_session=False)

    # 8. Delete campaign contents
    if content_ids:
        db.query(CampaignContent).filter(CampaignContent.campaign_id == campaign_id).delete(synchronize_session=False)

    # 9. Delete strategies
    db.query(CampaignStrategy).filter(CampaignStrategy.campaign_id == campaign_id).delete(synchronize_session=False)

    # 10. Delete campaign
    db.delete(campaign)
    db.commit()

    return {
        "message": f"Campaign {campaign_id} deleted successfully",
        "deleted_campaign_id": campaign_id,
    }


@router.post("/{campaign_id}/generate-strategies", response_model=List[StrategyResponse])
def generate_strategies_for_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Trigger LLM generation of 3 strategies (Product-Led, Story-Led, Community-Led) for a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found")

    brand = db.query(Brand).filter(Brand.id == campaign.brand_id).first() if campaign.brand_id else db.query(Brand).first()
    brand_dict = {
        "name": brand.name if brand else "Arkiva Studio",
        "tagline": brand.tagline if brand else '"Design without limits."',
        "mission": brand.mission if brand else "Empower creative professionals with intelligent design tools.",
        "voice_descriptors": brand.voice_descriptors if brand else [],
        "do_list": brand.do_list if brand else [],
        "dont_list": brand.dont_list if brand else [],
    }

    campaign_dict = {
        "name": campaign.name,
        "product_name": campaign.product_name,
        "objective": campaign.objective,
        "audience": campaign.audience,
        "duration": campaign.duration,
        "message": campaign.message,
        "instructions": campaign.instructions,
        "platforms": campaign.platforms,
    }

    # Generate 3 structured strategies
    llm_output = generate_campaign_strategies(brand_dict, campaign_dict)

    # Clear prior strategies for this campaign if re-generating
    db.query(CampaignStrategy).filter(CampaignStrategy.campaign_id == campaign_id).delete()

    created_strategies = []
    for item in [llm_output.product_led, llm_output.story_led, llm_output.community_led]:
        timeline_serialized = [t.model_dump() for t in item.timeline]
        strat = CampaignStrategy(
            id=str(uuid.uuid4()),
            campaign_id=campaign_id,
            strategy_type=item.strategy_type,
            label=item.label,
            tagline=item.tagline,
            description=item.description,
            core_message=item.core_message,
            audience_insight=item.audience_insight,
            audience_tags=item.audience_tags,
            content_pillars=item.content_pillars,
            narrative=item.narrative,
            tone=item.tone,
            best_platforms=item.best_platforms,
            color=item.color,
            recommended=item.recommended,
            timeline=timeline_serialized,
            total_pieces=item.total_pieces,
            is_selected=item.recommended,  # default select recommended direction
        )
        db.add(strat)
        created_strategies.append(strat)

    campaign.status = "strategies_generated"
    db.commit()

    # Re-query and format for response
    strategies = db.query(CampaignStrategy).filter(CampaignStrategy.campaign_id == campaign_id).all()
    response_items = []
    for s in strategies:
        response_items.append(
            StrategyResponse(
                id=s.id,
                campaign_id=s.campaign_id,
                strategy_type=s.strategy_type,
                label=s.label,
                tagline=s.tagline,
                desc=s.description,
                core_message=s.core_message,
                audience_insight=s.audience_insight,
                audience_tags=s.audience_tags or [],
                pillars=s.content_pillars or [],
                narrative=s.narrative,
                tone=s.tone,
                best=s.best_platforms or [],
                color=s.color,
                recommended=s.recommended,
                timeline=s.timeline or [],
                total_pieces=s.total_pieces,
                is_selected=s.is_selected,
                created_at=s.created_at,
            )
        )
    return response_items


@router.get("/{campaign_id}/strategies", response_model=List[StrategyResponse])
def get_campaign_strategies(campaign_id: str, db: Session = Depends(get_db)):
    """Fetch the generated strategies for a campaign."""
    strategies = db.query(CampaignStrategy).filter(CampaignStrategy.campaign_id == campaign_id).all()
    if not strategies:
        # If no strategies generated yet, check if campaign exists
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found")
        return []

    response_items = []
    for s in strategies:
        response_items.append(
            StrategyResponse(
                id=s.id,
                campaign_id=s.campaign_id,
                strategy_type=s.strategy_type,
                label=s.label,
                tagline=s.tagline,
                desc=s.description,
                core_message=s.core_message,
                audience_insight=s.audience_insight,
                audience_tags=s.audience_tags or [],
                pillars=s.content_pillars or [],
                narrative=s.narrative,
                tone=s.tone,
                best=s.best_platforms or [],
                color=s.color,
                recommended=s.recommended,
                timeline=s.timeline or [],
                total_pieces=s.total_pieces,
                is_selected=s.is_selected,
                created_at=s.created_at,
            )
        )
    return response_items


@router.patch("/{campaign_id}/strategies/{strategy_id}/select", response_model=StrategyResponse)
def select_campaign_strategy(
    campaign_id: str,
    strategy_id: str,
    selection: StrategySelectionUpdate,
    db: Session = Depends(get_db),
):
    """Mark a specific strategy direction as selected for downstream execution."""
    # Reset selection on all strategies for this campaign
    db.query(CampaignStrategy).filter(CampaignStrategy.campaign_id == campaign_id).update({"is_selected": False})

    target_strat = db.query(CampaignStrategy).filter(
        CampaignStrategy.campaign_id == campaign_id,
        (CampaignStrategy.id == strategy_id) | (CampaignStrategy.strategy_type == strategy_id),
    ).first()

    if not target_strat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found")

    target_strat.is_selected = selection.is_selected
    db.commit()
    db.refresh(target_strat)

    return StrategyResponse(
        id=target_strat.id,
        campaign_id=target_strat.campaign_id,
        strategy_type=target_strat.strategy_type,
        label=target_strat.label,
        tagline=target_strat.tagline,
        desc=target_strat.description,
        core_message=target_strat.core_message,
        audience_insight=target_strat.audience_insight,
        audience_tags=target_strat.audience_tags or [],
        pillars=target_strat.content_pillars or [],
        narrative=target_strat.narrative,
        tone=target_strat.tone,
        best=target_strat.best_platforms or [],
        color=target_strat.color,
        recommended=target_strat.recommended,
        timeline=target_strat.timeline or [],
        total_pieces=target_strat.total_pieces,
        is_selected=target_strat.is_selected,
        created_at=target_strat.created_at,
    )


# ==============================================================================
# MILESTONE 2A: PLATFORM CONTENT ENDPOINTS
# ==============================================================================


@router.post(
    "/{campaign_id}/content/generate",
    response_model=List[CampaignContentResponse],
    status_code=status.HTTP_201_CREATED,
)
def generate_content_for_campaign(
    campaign_id: str,
    req: GenerateContentRequest,
    db: Session = Depends(get_db),
):
    """Generate platform-specific content (Instagram, LinkedIn, X, YouTube Shorts) for a campaign strategy."""
    # 1. Validate campaign exists
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    # 2. Validate strategy exists and belongs to this campaign (support both UUID and strategy_type)
    strategy = db.query(CampaignStrategy).filter(
        (CampaignStrategy.id == req.strategy_id) |
        ((CampaignStrategy.campaign_id == campaign_id) & (CampaignStrategy.strategy_type == req.strategy_id))
    ).first()
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy {req.strategy_id} not found",
        )
    if strategy.campaign_id != campaign_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Strategy {req.strategy_id} does not belong to campaign {campaign_id}",
        )

    # 3. Validate platforms list
    if not req.platforms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one platform must be requested",
        )

    normalized_platforms = []
    for p in req.platforms:
        clean_p = p.strip().lower().replace(" ", "_").replace("-", "_")
        if clean_p == "twitter":
            clean_p = "x"
        if clean_p not in SUPPORTED_PLATFORMS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform '{p}'. Supported platforms are: {', '.join(sorted(SUPPORTED_PLATFORMS))}",
            )
        if clean_p not in normalized_platforms:
            normalized_platforms.append(clean_p)

    # 4. Gather brand and product context
    brand = db.query(Brand).filter(Brand.id == campaign.brand_id).first() if campaign.brand_id else db.query(Brand).first()
    product = None
    if brand:
        product = db.query(Product).filter(
            Product.brand_id == brand.id,
            Product.name == campaign.product_name,
        ).first()

    product_info = {
        "name": product.name if product else campaign.product_name,
        "type": product.product_type if product else "Core Product",
        "price": product.price if product else "$49/mo",
        "description": product.description if product else "Intelligent design workspace.",
    }

    brand_dict = {
        "name": brand.name if brand else "Arkiva Studio",
        "tagline": brand.tagline if brand else '"Design without limits."',
        "mission": brand.mission if brand else "Empower creative professionals with intelligent design tools.",
        "industry": brand.industry if brand else "Design Software",
        "stage": brand.stage if brand else "Growth",
        "voice_descriptors": brand.voice_descriptors if brand else [],
        "voice_traits": brand.voice_traits if brand else [],
        "messaging_pillars": brand.messaging_pillars if brand else [],
        "do_list": brand.do_list if brand else [],
        "dont_list": brand.dont_list if brand else [],
        "product_info": product_info,
    }

    campaign_dict = {
        "name": campaign.name,
        "product_name": campaign.product_name,
        "objective": campaign.objective,
        "audience": campaign.audience,
        "duration": campaign.duration,
        "message": campaign.message,
        "instructions": campaign.instructions,
        "platforms": campaign.platforms,
    }

    strategy_dict = {
        "id": strategy.id,
        "label": strategy.label,
        "strategy_type": strategy.strategy_type,
        "tagline": strategy.tagline,
        "description": strategy.description,
        "core_message": strategy.core_message,
        "audience_insight": strategy.audience_insight,
        "audience_tags": strategy.audience_tags or [],
        "content_pillars": strategy.content_pillars or [],
        "narrative": strategy.narrative,
        "tone": strategy.tone,
        "timeline": strategy.timeline or [],
    }

    # 5. Generate content items via LLM engine
    llm_output = generate_platform_content(
        brand_data=brand_dict,
        campaign_data=campaign_dict,
        strategy_data=strategy_dict,
        platforms=normalized_platforms,
    )

    # 6. Delete previous content for this campaign + strategy + platform combination to prevent duplication
    db.query(CampaignContent).filter(
        CampaignContent.campaign_id == campaign_id,
        CampaignContent.strategy_id == strategy.id,
        CampaignContent.platform.in_(normalized_platforms),
    ).delete(synchronize_session=False)

    # 7. Persist generated content items
    saved_items = []
    for item in llm_output.items:
        content_row = CampaignContent(
            id=str(uuid.uuid4()),
            campaign_id=campaign_id,
            strategy_id=strategy.id,
            platform=item.platform,
            content_type=item.content_type,
            title=item.title,
            body=item.body,
            hook=item.hook,
            call_to_action=item.call_to_action,
            visual_concept=item.visual_concept,
            metadata_info={"strategy_label": strategy.label},
        )
        db.add(content_row)
        saved_items.append(content_row)

    db.commit()

    # Re-query saved content items for accurate response serialization
    contents = db.query(CampaignContent).filter(
        CampaignContent.campaign_id == campaign_id,
        CampaignContent.strategy_id == strategy.id,
        CampaignContent.platform.in_(normalized_platforms),
    ).order_by(CampaignContent.created_at.asc()).all()

    return contents


@router.get(
    "/{campaign_id}/content",
    response_model=List[CampaignContentResponse],
)
def get_campaign_content(
    campaign_id: str,
    strategy_id: Optional[str] = Query(default=None, description="Filter by strategy ID or strategy type"),
    platform: Optional[str] = Query(default=None, description="Filter by platform (e.g. instagram, linkedin, x, youtube_shorts)"),
    db: Session = Depends(get_db),
):
    """Retrieve previously generated content for a campaign, with optional strategy and platform filtering."""
    # Validate campaign exists
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    query = db.query(CampaignContent).filter(CampaignContent.campaign_id == campaign_id)

    if strategy_id:
        strat = db.query(CampaignStrategy).filter(
            (CampaignStrategy.id == strategy_id) |
            ((CampaignStrategy.campaign_id == campaign_id) & (CampaignStrategy.strategy_type == strategy_id))
        ).first()
        actual_strat_id = strat.id if strat else strategy_id
        query = query.filter(CampaignContent.strategy_id == actual_strat_id)

    if platform:
        clean_platform = platform.strip().lower().replace(" ", "_").replace("-", "_")
        if clean_platform == "twitter":
            clean_platform = "x"
        query = query.filter(CampaignContent.platform == clean_platform)

    contents = query.order_by(CampaignContent.created_at.asc()).all()
    return contents


def _handle_repurposing(
    req: RepurposeContentRequest,
    db: Session,
    url_campaign_id: Optional[str] = None,
) -> RepurposeContentResponse:
    """Internal helper to execute content repurposing and optionally persist derivatives."""
    source_title = req.source_title or "Hero Content"
    source_text = req.source_text or ""
    source_platform = req.source_platform or "hero_content"
    effective_campaign_id = url_campaign_id or req.campaign_id
    effective_strategy_id = req.strategy_id

    if req.source_content_id:
        src_row = db.query(CampaignContent).filter(CampaignContent.id == req.source_content_id).first()
        if src_row:
            source_title = req.source_title or src_row.title or f"Asset from {src_row.platform.capitalize()}"
            source_text = req.source_text or src_row.body
            source_platform = src_row.platform
            if not effective_campaign_id:
                effective_campaign_id = src_row.campaign_id
            if not effective_strategy_id:
                effective_strategy_id = src_row.strategy_id

    if not source_text or not source_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source content body cannot be empty. Please provide 'source_text' or a valid 'source_content_id'.",
        )

    if not req.target_platforms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one target platform must be specified.",
        )

    normalized_platforms = []
    for p in req.target_platforms:
        clean_p = p.strip().lower().replace(" ", "_").replace("-", "_")
        if clean_p == "twitter":
            clean_p = "x"
        if clean_p not in SUPPORTED_PLATFORMS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform '{p}'. Supported platforms are: {', '.join(sorted(SUPPORTED_PLATFORMS))}",
            )
        if clean_p not in normalized_platforms:
            normalized_platforms.append(clean_p)

    # Gather Brand & Strategy context
    brand = db.query(Brand).first()
    if not brand:
        seed_initial_brand_data(db)
        brand = db.query(Brand).first()

    brand_dict = {
        "name": brand.name if brand else "Arkiva Studio",
        "tagline": brand.tagline if brand else '"Design without limits."',
        "voice_descriptors": brand.voice_descriptors if brand else [],
        "voice_traits": brand.voice_traits if brand else [],
        "do_list": brand.do_list if brand else [],
        "dont_list": brand.dont_list if brand else [],
    }

    strategy_dict = None
    if effective_strategy_id:
        strat = db.query(CampaignStrategy).filter(
            (CampaignStrategy.id == effective_strategy_id) |
            ((CampaignStrategy.campaign_id == effective_campaign_id) & (CampaignStrategy.strategy_type == effective_strategy_id))
        ).first()
        if strat:
            effective_strategy_id = strat.id
            strategy_dict = {
                "id": strat.id,
                "label": strat.label,
                "tagline": strat.tagline,
                "tone": strat.tone,
                "core_message": strat.core_message,
            }

    # If saving to campaign is requested but strategy_id wasn't found, pick selected or first strategy
    if req.save_to_campaign and effective_campaign_id and not effective_strategy_id:
        strat = (
            db.query(CampaignStrategy)
            .filter(CampaignStrategy.campaign_id == effective_campaign_id)
            .order_by(CampaignStrategy.is_selected.desc())
            .first()
        )
        if strat:
            effective_strategy_id = strat.id
            strategy_dict = {
                "id": strat.id,
                "label": strat.label,
                "tagline": strat.tagline,
                "tone": strat.tone,
                "core_message": strat.core_message,
            }

    # Call LLM Repurposing Engine
    llm_output = repurpose_content_items(
        brand_data=brand_dict,
        source_title=source_title,
        source_text=source_text,
        source_platform=source_platform,
        target_platforms=normalized_platforms,
        strategy_data=strategy_dict,
    )

    items_to_return = []
    if req.save_to_campaign and effective_campaign_id and effective_strategy_id:
        for item in llm_output.items:
            content_row = CampaignContent(
                id=str(uuid.uuid4()),
                campaign_id=effective_campaign_id,
                strategy_id=effective_strategy_id,
                platform=item.platform,
                content_type=item.content_type,
                title=item.title,
                body=item.body,
                hook=item.hook,
                call_to_action=item.call_to_action,
                visual_concept=item.visual_concept,
                metadata_info={
                    "repurposed": True,
                    "source_platform": source_platform,
                    "source_title": source_title,
                    "source_content_id": req.source_content_id,
                    "strategy_label": strategy_dict.get("label") if strategy_dict else "Hero Repurposed",
                },
            )
            db.add(content_row)
            items_to_return.append(content_row)
        db.commit()
        for r in items_to_return:
            db.refresh(r)
    else:
        for item in llm_output.items:
            items_to_return.append(
                CampaignContent(
                    id=str(uuid.uuid4()),
                    campaign_id=effective_campaign_id or "ephemeral",
                    strategy_id=effective_strategy_id or "ephemeral",
                    platform=item.platform,
                    content_type=item.content_type,
                    title=item.title,
                    body=item.body,
                    hook=item.hook,
                    call_to_action=item.call_to_action,
                    visual_concept=item.visual_concept,
                    approval_status="pending_review",
                    revision_number=1,
                    created_at=datetime.now(timezone.utc),
                    metadata_info={
                        "repurposed": True,
                        "source_platform": source_platform,
                        "source_title": source_title,
                    },
                )
            )


    return RepurposeContentResponse(
        source_title=source_title,
        source_platform=source_platform,
        items=items_to_return,
    )


@content_router.post(
    "/repurpose",
    response_model=RepurposeContentResponse,
    status_code=status.HTTP_200_OK,
)
def repurpose_content_global(
    req: RepurposeContentRequest,
    db: Session = Depends(get_db),
):
    """Repurpose hero content or existing content into multi-channel derivative formats."""
    return _handle_repurposing(req, db)


@router.post(
    "/{campaign_id}/content/repurpose",
    response_model=RepurposeContentResponse,
    status_code=status.HTTP_200_OK,
)
def repurpose_content_for_campaign(
    campaign_id: str,
    req: RepurposeContentRequest,
    db: Session = Depends(get_db),
):
    """Repurpose content specifically within a campaign context."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )
    return _handle_repurposing(req, db, url_campaign_id=campaign_id)


