import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base


class Brand(Base):
    __tablename__ = "brands"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    industry = Column(String(255), nullable=True)
    founded = Column(String(50), nullable=True)
    stage = Column(String(50), nullable=True)
    tagline = Column(String(255), nullable=True)
    mission = Column(Text, nullable=True)
    completeness = Column(Integer, default=80)

    values = Column(JSON, default=list)  # list of strings
    voice_traits = Column(JSON, default=list)  # list of {trait, opposite, value}
    voice_descriptors = Column(JSON, default=list)  # list of strings
    messaging_pillars = Column(JSON, default=list)  # list of {title, desc}
    do_list = Column(JSON, default=list)  # list of strings
    dont_list = Column(JSON, default=list)  # list of strings
    target_audience = Column(JSON, default=list)  # list of segments
    visual_identity = Column(JSON, default=dict)  # colors and typography

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products = relationship("Product", back_populates="brand", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="brand", cascade="all, delete-orphan")
    insights = relationship("CampaignInsight", back_populates="brand", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    brand_id = Column(String(36), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    product_type = Column(String(100), default="Core Product")
    price = Column(String(50), default="$0")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    brand = relationship("Brand", back_populates="products")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    brand_id = Column(String(36), ForeignKey("brands.id", ondelete="CASCADE"), nullable=True)
    product_name = Column(String(255), nullable=False, default="Arkiva Pro Suite")
    name = Column(String(255), nullable=False)
    objective = Column(String(100), nullable=False)
    audience = Column(Text, nullable=True)
    duration = Column(String(50), default="3 weeks")
    message = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    platforms = Column(JSON, default=list)  # list of platform strings
    status = Column(String(50), default="draft")  # draft, generating, ready

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    brand = relationship("Brand", back_populates="campaigns")
    strategies = relationship("CampaignStrategy", back_populates="campaign", cascade="all, delete-orphan")
    contents = relationship("CampaignContent", back_populates="campaign", cascade="all, delete-orphan")
    performances = relationship("CampaignPerformance", back_populates="campaign", cascade="all, delete-orphan")
    learning_sources = relationship("CampaignLearningSource", back_populates="campaign", cascade="all, delete-orphan")
    schedules = relationship("ContentSchedule", back_populates="campaign", cascade="all, delete-orphan")


class CampaignStrategy(Base):
    __tablename__ = "campaign_strategies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    strategy_type = Column(String(50), nullable=False)  # "product", "story", "community"
    label = Column(String(100), nullable=False)  # "Product-Led", "Story-Led", "Community-Led"
    tagline = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    core_message = Column(Text, nullable=True)
    audience_insight = Column(Text, nullable=True)
    audience_tags = Column(JSON, default=list)  # list of tags e.g. ["TIME-CONSCIOUS", ...]
    content_pillars = Column(JSON, default=list)  # list of strings
    narrative = Column(Text, nullable=True)
    tone = Column(Text, nullable=True)
    best_platforms = Column(JSON, default=list)  # list of platform strings
    color = Column(String(20), default="#C4813A")
    recommended = Column(Boolean, default=False)
    timeline = Column(JSON, default=list)  # list of {week, phase, desc, pieces}
    total_pieces = Column(Integer, default=32)
    is_selected = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="strategies")
    contents = relationship("CampaignContent", back_populates="strategy", cascade="all, delete-orphan")

    @property
    def desc(self) -> str:
        return self.description or ""

    @property
    def pillars(self) -> list:
        return self.content_pillars or []

    @property
    def best(self) -> list:
        return self.best_platforms or []


class CampaignContent(Base):
    __tablename__ = "campaign_contents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    strategy_id = Column(String(36), ForeignKey("campaign_strategies.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(50), nullable=False)  # "instagram", "linkedin", "x", "youtube_shorts"
    content_type = Column(String(50), default="post")  # "post", "caption", "script", "thread"
    title = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    hook = Column(Text, nullable=True)
    call_to_action = Column(Text, nullable=True)
    visual_concept = Column(Text, nullable=True)
    metadata_info = Column(JSON, default=dict)  # hashtags, format notes, etc.

    approval_status = Column(String(50), default="pending_review")  # "pending_review", "changes_requested", "approved", "rejected"
    reviewer_feedback = Column(Text, nullable=True)
    revision_number = Column(Integer, default=1)
    approved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="contents")
    strategy = relationship("CampaignStrategy", back_populates="contents")
    audits = relationship("ContentAudit", back_populates="content", cascade="all, delete-orphan")
    revisions = relationship("ContentRevision", back_populates="content", cascade="all, delete-orphan", order_by="ContentRevision.revision_number.asc()")
    approval_actions = relationship("ApprovalAction", back_populates="content", cascade="all, delete-orphan", order_by="ApprovalAction.created_at.asc()")
    performances = relationship("CampaignPerformance", back_populates="content", cascade="all, delete-orphan")
    learning_sources = relationship("CampaignLearningSource", back_populates="content", cascade="all, delete-orphan")
    schedules = relationship("ContentSchedule", back_populates="content", cascade="all, delete-orphan", order_by="ContentSchedule.created_at.desc()")


class ContentRevision(Base):
    __tablename__ = "content_revisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_content_id = Column(String(36), ForeignKey("campaign_contents.id", ondelete="CASCADE"), nullable=False)
    revision_number = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    hook = Column(Text, nullable=True)
    call_to_action = Column(Text, nullable=True)
    visual_concept = Column(Text, nullable=True)
    metadata_info = Column(JSON, default=dict)
    revision_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    content = relationship("CampaignContent", back_populates="revisions")


class ApprovalAction(Base):
    __tablename__ = "approval_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_content_id = Column(String(36), ForeignKey("campaign_contents.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)  # "submitted", "changes_requested", "approved", "rejected", "revision_created"
    feedback = Column(Text, nullable=True)
    revision_number = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    content = relationship("CampaignContent", back_populates="approval_actions")



class ContentAudit(Base):
    __tablename__ = "content_audits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_content_id = Column(String(36), ForeignKey("campaign_contents.id", ondelete="CASCADE"), nullable=False)
    overall_status = Column(String(20), nullable=False, default="pass")  # "pass", "warning", "fail"
    summary = Column(Text, nullable=True)
    is_current = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    content = relationship("CampaignContent", back_populates="audits")
    findings = relationship("AuditFinding", back_populates="audit", cascade="all, delete-orphan")


class AuditFinding(Base):
    __tablename__ = "audit_findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    audit_id = Column(String(36), ForeignKey("content_audits.id", ondelete="CASCADE"), nullable=False)
    guard_type = Column(String(20), nullable=False)  # "brandguard", "claimguard"
    category = Column(String(50), nullable=False)  # "voice", "messaging_pillar", "do_dont_rule", "unsupported_claim", "absolute_claim", "superlative", "numerical_claim", "environmental_claim", "positioning", "visual_concept", "performance_claim"
    severity = Column(String(20), nullable=False, default="info")  # "critical", "warning", "info"
    status = Column(String(20), nullable=False, default="pass")  # "pass", "warning", "fail"
    title = Column(String(255), nullable=False)
    evidence = Column(Text, nullable=True)
    explanation = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    audit = relationship("ContentAudit", back_populates="findings")


class CampaignInsight(Base):
    __tablename__ = "campaign_insights"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    brand_id = Column(String(36), ForeignKey("brands.id", ondelete="CASCADE"), nullable=True)
    category = Column(String(50), nullable=False)  # "strategy", "platform", "content_format", "messaging", "cta", "audience", "claim_risk", "approval_pattern", "performance", "general"
    title = Column(String(255), nullable=False)
    insight = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    evidence_summary = Column(Text, nullable=True)
    confidence = Column(String(20), default="medium")  # "low", "medium", "high"
    source_count = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    brand = relationship("Brand", back_populates="insights")
    learning_sources = relationship("CampaignLearningSource", back_populates="insight", cascade="all, delete-orphan")


class CampaignLearningSource(Base):
    __tablename__ = "campaign_learning_sources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    insight_id = Column(String(36), ForeignKey("campaign_insights.id", ondelete="CASCADE"), nullable=False)
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    campaign_content_id = Column(String(36), ForeignKey("campaign_contents.id", ondelete="SET NULL"), nullable=True)
    source_type = Column(String(50), nullable=False)  # "strategy", "audit_finding", "approval_action", "performance", "revision"
    metric_name = Column(String(100), nullable=True)
    metric_value = Column(String(100), nullable=True)
    context = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    insight = relationship("CampaignInsight", back_populates="learning_sources")
    campaign = relationship("Campaign", back_populates="learning_sources")
    content = relationship("CampaignContent", back_populates="learning_sources")


class CampaignPerformance(Base):
    __tablename__ = "campaign_performances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    campaign_content_id = Column(String(36), ForeignKey("campaign_contents.id", ondelete="CASCADE"), nullable=True)
    platform = Column(String(50), nullable=False)
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="performances")
    content = relationship("CampaignContent", back_populates="performances")


class ContentSchedule(Base):
    __tablename__ = "content_schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_content_id = Column(String(36), ForeignKey("campaign_contents.id", ondelete="CASCADE"), nullable=False)
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(50), nullable=False)  # "instagram", "linkedin", "x", "youtube_shorts"
    scheduled_at = Column(DateTime, nullable=False)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    status = Column(String(50), default="scheduled", nullable=False)  # "draft", "scheduled", "publishing", "published", "failed", "cancelled"
    publish_attempts = Column(Integer, default=0)
    published_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    external_post_id = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    content = relationship("CampaignContent", back_populates="schedules")
    campaign = relationship("Campaign", back_populates="schedules")
    publishing_events = relationship("PublishingEvent", back_populates="schedule", cascade="all, delete-orphan", order_by="PublishingEvent.created_at.asc()")


class PublishingEvent(Base):
    __tablename__ = "publishing_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id = Column(String(36), ForeignKey("content_schedules.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)  # "scheduled", "publish_started", "publish_succeeded", "publish_failed", "cancelled", "rescheduled"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    schedule = relationship("ContentSchedule", back_populates="publishing_events")



