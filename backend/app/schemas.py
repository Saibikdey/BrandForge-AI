from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# --- Product Schemas ---
class ProductBase(BaseModel):
    name: str
    product_type: str = "Core Product"
    price: str = "$0"
    description: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: str
    brand_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Brand Schemas ---
class BrandBase(BaseModel):
    name: str
    industry: Optional[str] = None
    founded: Optional[str] = None
    stage: Optional[str] = None
    tagline: Optional[str] = None
    mission: Optional[str] = None
    completeness: int = 80
    values: List[str] = Field(default_factory=list)
    voice_traits: List[Dict[str, Any]] = Field(default_factory=list)
    voice_descriptors: List[str] = Field(default_factory=list)
    messaging_pillars: List[Dict[str, str]] = Field(default_factory=list)
    do_list: List[str] = Field(default_factory=list)
    dont_list: List[str] = Field(default_factory=list)
    target_audience: List[Dict[str, Any]] = Field(default_factory=list)
    visual_identity: Dict[str, Any] = Field(default_factory=dict)


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    founded: Optional[str] = None
    stage: Optional[str] = None
    tagline: Optional[str] = None
    mission: Optional[str] = None
    completeness: Optional[int] = None
    values: Optional[List[str]] = None
    voice_traits: Optional[List[Dict[str, Any]]] = None
    voice_descriptors: Optional[List[str]] = None
    messaging_pillars: Optional[List[Dict[str, str]]] = None
    do_list: Optional[List[str]] = None
    dont_list: Optional[List[str]] = None
    target_audience: Optional[List[Dict[str, Any]]] = None
    visual_identity: Optional[Dict[str, Any]] = None


class BrandResponse(BrandBase):
    id: str
    products: List[ProductResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Strategy & Timeline Schemas ---
class TimelineItem(BaseModel):
    week: str
    phase: str
    desc: str
    pieces: int


class StrategyBase(BaseModel):
    id: Optional[str] = None
    strategy_type: str  # "product" | "story" | "community"
    label: str  # "Product-Led" | "Story-Led" | "Community-Led"
    tagline: str
    desc: Optional[str] = None
    description: Optional[str] = None
    core_message: Optional[str] = None
    audience_insight: Optional[str] = None
    audience_tags: List[str] = Field(default_factory=list)
    pillars: List[str] = Field(default_factory=list)
    content_pillars: List[str] = Field(default_factory=list)
    narrative: Optional[str] = None
    tone: Optional[str] = None
    best: List[str] = Field(default_factory=list)
    best_platforms: List[str] = Field(default_factory=list)
    color: str = "#C4813A"
    recommended: bool = False
    timeline: List[TimelineItem] = Field(default_factory=list)
    total_pieces: int = 32
    is_selected: bool = False


class StrategyResponse(StrategyBase):
    id: str
    campaign_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class StrategySelectionUpdate(BaseModel):
    is_selected: bool = True


# --- Campaign Schemas ---
class CampaignCreate(BaseModel):
    name: str
    product_name: str = "Arkiva Pro Suite"
    objective: str
    audience: Optional[str] = ""
    duration: str = "3 weeks"
    message: Optional[str] = ""
    instructions: Optional[str] = ""
    platforms: List[str] = Field(default_factory=list)


class CampaignResponse(BaseModel):
    id: str
    brand_id: Optional[str] = None
    name: str
    product_name: str
    objective: str
    audience: Optional[str] = None
    duration: str
    message: Optional[str] = None
    instructions: Optional[str] = None
    platforms: List[str] = Field(default_factory=list)
    status: str
    strategies: List[StrategyResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- LLM Structured Schema for 3 Strategies ---
class LLMStrategyItem(BaseModel):
    strategy_type: str = Field(description="Must be one of: 'product', 'story', 'community'")
    label: str = Field(description="Must be one of: 'Product-Led', 'Story-Led', 'Community-Led'")
    tagline: str = Field(description="Punchy, memorable 1-line strategy tagline")
    description: str = Field(description="2-3 sentence strategic direction explanation")
    core_message: str = Field(description="Core headline message to resonate with target audience")
    audience_insight: str = Field(description="Deep qualitative behavioral insight about the audience")
    audience_tags: List[str] = Field(description="3-4 short uppercase tags e.g. ['TIME-CONSCIOUS', 'CRAFT-FOCUSED']")
    content_pillars: List[str] = Field(description="3 distinct thematic content pillars")
    narrative: str = Field(description="Overarching creative narrative arc")
    tone: str = Field(description="Tone and voice direction")
    best_platforms: List[str] = Field(description="2-3 primary platforms best suited for this strategy")
    color: str = Field(description="'#5B9BC4' for product, '#C4813A' for story, '#5BA373' for community")
    recommended: bool = Field(description="True for the most balanced direction, otherwise False")
    timeline: List[TimelineItem] = Field(description="Phase-by-phase timeline rollout based on campaign duration")
    total_pieces: int = Field(default=32, description="Calculated total content assets across rollout")


class LLMStrategiesOutput(BaseModel):
    product_led: LLMStrategyItem
    story_led: LLMStrategyItem
    community_led: LLMStrategyItem


# --- Campaign Content Schemas ---
SUPPORTED_PLATFORMS = {"instagram", "linkedin", "x", "youtube_shorts"}


class GenerateContentRequest(BaseModel):
    strategy_id: str
    platforms: List[str] = Field(
        default_factory=lambda: ["instagram", "linkedin", "x", "youtube_shorts"],
        description="List of target platforms: 'instagram', 'linkedin', 'x', 'youtube_shorts'",
    )


class CampaignContentBase(BaseModel):
    platform: str
    content_type: str = "post"
    title: Optional[str] = None
    body: str
    hook: Optional[str] = None
    call_to_action: Optional[str] = None
    visual_concept: Optional[str] = None
    metadata_info: Dict[str, Any] = Field(default_factory=dict)


class CampaignContentResponse(CampaignContentBase):
    id: str
    campaign_id: str
    strategy_id: str
    approval_status: str = "pending_review"
    reviewer_feedback: Optional[str] = None
    revision_number: int = 1
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- LLM Structured Schema for Platform Content Generation ---
class PlatformContentItem(BaseModel):
    platform: str = Field(description="Must be one of: 'instagram', 'linkedin', 'x', 'youtube_shorts'")
    content_type: str = Field(description="e.g. 'caption', 'post', 'thread', 'script'")
    title: str = Field(description="Title, concept headline, or hook topic")
    hook: str = Field(description="Attention-grabbing opening line, question, or visual hook")
    body: str = Field(description="Full text body, script dialogue with scene cues, caption, or thread content adapted natively to the platform")
    call_to_action: str = Field(description="Platform-appropriate call to action")
    visual_concept: Optional[str] = Field(default=None, description="Visual description, image concept, or video staging direction")


class LLMContentGenerationOutput(BaseModel):
    items: List[PlatformContentItem]


# --- Audit Schemas (Milestone 3A) ---
class AuditFindingBase(BaseModel):
    guard_type: str  # "brandguard" | "claimguard"
    category: str  # "voice", "messaging_pillar", "do_dont_rule", "unsupported_claim", "absolute_claim", "superlative", "numerical_claim", "environmental_claim", "positioning", "visual_concept", "performance_claim"
    severity: str  # "critical" | "warning" | "info"
    status: str  # "pass" | "warning" | "fail"
    title: str
    evidence: Optional[str] = None
    explanation: str
    suggestion: Optional[str] = None


class AuditFindingResponse(AuditFindingBase):
    id: str
    audit_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ContentAuditResponse(BaseModel):
    id: str
    campaign_content_id: str
    overall_status: str  # "pass" | "warning" | "fail"
    summary: Optional[str] = None
    is_current: bool = True
    findings: List[AuditFindingResponse] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignAuditResponse(BaseModel):
    campaign_id: str
    overall_status: str  # "pass" | "warning" | "fail"
    total_audited: int
    audits: List[ContentAuditResponse] = Field(default_factory=list)


# --- LLM Structured Schema for Auditing ---
class AuditFindingItem(BaseModel):
    guard_type: str = Field(description="Must be 'brandguard' or 'claimguard'")
    category: str = Field(description="e.g. 'voice', 'messaging_pillar', 'do_dont_rule', 'positioning', 'visual_concept', 'unsupported_claim', 'absolute_claim', 'superlative', 'numerical_claim', 'environmental_claim', 'performance_claim'")
    severity: str = Field(description="Must be 'critical', 'warning', or 'info'")
    status: str = Field(description="Must be 'pass', 'warning', or 'fail'")
    title: str = Field(description="Concise finding title")
    evidence: Optional[str] = Field(default=None, description="Direct quote or snippet from content or rules")
    explanation: str = Field(description="Detailed reason for the status/finding. For unsupported claims, must state: 'Unsupported claim — evidence not found in the provided brand/product knowledge.'")
    suggestion: Optional[str] = Field(default=None, description="Actionable recommendation to resolve the finding")


class LLMAuditOutput(BaseModel):
    summary: str = Field(description="1-2 sentence overall audit summary")
    findings: List[AuditFindingItem]


# --- Human Approval & Content Revision Schemas (Milestone 3C) ---
class RequestChangesRequest(BaseModel):
    feedback: str = Field(..., min_length=1, description="Required feedback explanation for why changes are requested")


class RejectRequest(BaseModel):
    feedback: Optional[str] = Field(None, description="Optional rejection reasoning")


class CreateRevisionRequest(BaseModel):
    title: Optional[str] = None
    body: str = Field(..., min_length=1, description="Revised content body")
    hook: Optional[str] = None
    call_to_action: Optional[str] = None
    visual_concept: Optional[str] = None
    revision_reason: str = Field(..., min_length=1, description="Required reason for this revision")


class ContentRevisionResponse(BaseModel):
    id: str
    campaign_content_id: str
    revision_number: int
    title: Optional[str] = None
    body: str
    hook: Optional[str] = None
    call_to_action: Optional[str] = None
    visual_concept: Optional[str] = None
    metadata_info: Dict[str, Any] = Field(default_factory=dict)
    revision_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalActionResponse(BaseModel):
    id: str
    campaign_content_id: str
    action: str  # "submitted", "changes_requested", "approved", "rejected", "revision_created"
    feedback: Optional[str] = None
    revision_number: int
    created_at: datetime

    class Config:
        from_attributes = True


class HumanApprovalResponse(BaseModel):
    campaign_content_id: str
    campaign_id: str
    strategy_id: str
    platform: str
    content_type: str
    title: Optional[str] = None
    body: str
    hook: Optional[str] = None
    call_to_action: Optional[str] = None
    visual_concept: Optional[str] = None
    approval_status: str  # "pending_review", "changes_requested", "approved", "rejected"
    reviewer_feedback: Optional[str] = None
    revision_number: int
    approved_at: Optional[datetime] = None
    latest_audit_status: Optional[str] = None  # "pass", "warning", "fail", or None
    is_audit_current: bool = False
    latest_audit: Optional[ContentAuditResponse] = None
    revisions: List[ContentRevisionResponse] = Field(default_factory=list)
    approval_history: List[ApprovalActionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Campaign Memory & Cross-Campaign Learning Schemas (Milestone 4) ---
class CampaignLearningSourceResponse(BaseModel):
    id: str
    insight_id: str
    campaign_id: str
    campaign_content_id: Optional[str] = None
    source_type: str
    metric_name: Optional[str] = None
    metric_value: Optional[str] = None
    context: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignInsightResponse(BaseModel):
    id: str
    brand_id: Optional[str] = None
    category: str  # "strategy", "platform", "content_format", "messaging", "cta", "audience", "claim_risk", "approval_pattern", "performance", "general"
    title: str
    insight: str
    recommendation: str
    evidence_summary: Optional[str] = None
    confidence: str  # "low", "medium", "high"
    source_count: int
    is_active: bool
    learning_sources: List[CampaignLearningSourceResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignPerformanceCreate(BaseModel):
    campaign_content_id: Optional[str] = None
    platform: str
    impressions: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    clicks: int = 0
    conversions: int = 0
    engagement_rate: Optional[float] = None
    conversion_rate: Optional[float] = None


class CampaignPerformanceResponse(BaseModel):
    id: str
    campaign_id: str
    campaign_content_id: Optional[str] = None
    platform: str
    impressions: int
    reach: int
    likes: int
    comments: int
    shares: int
    saves: int
    clicks: int
    conversions: int
    engagement_rate: float
    conversion_rate: float
    recorded_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class MemoryHealthResponse(BaseModel):
    total_campaigns_analyzed: int
    total_insights: int
    high_confidence_count: int
    total_data_points: int
    last_learned_at: Optional[datetime] = None


class GovernanceLearningItem(BaseModel):
    guard_type: str
    category: str
    frequency: int
    common_violation: str
    recommendation: str


class ApprovalLearningItem(BaseModel):
    pattern_type: str
    frequency: int
    detail: str
    recommendation: str


class PerformanceLearningItem(BaseModel):
    signal_type: str  # "strategy", "platform", "content_format", "conversion"
    category: str
    evidence_count: int
    observation: str
    recommendation: str
    confidence: str = "medium"


class CampaignMemoryResponse(BaseModel):
    health: MemoryHealthResponse
    insights: List[CampaignInsightResponse] = Field(default_factory=list)
    governance_learnings: List[GovernanceLearningItem] = Field(default_factory=list)
    approval_learnings: List[ApprovalLearningItem] = Field(default_factory=list)
    performance_learnings: List[PerformanceLearningItem] = Field(default_factory=list)
    last_learned_at: Optional[datetime] = None


class LLMInsightItem(BaseModel):
    category: str = Field(description="Must be one of: 'strategy', 'platform', 'content_format', 'messaging', 'cta', 'audience', 'claim_risk', 'approval_pattern', 'performance', 'general'")
    title: str = Field(description="Action-oriented title")
    insight: str = Field(description="Concise synthesis of what was learned")
    recommendation: str = Field(description="Specific, actionable guideline for upcoming campaigns")
    confidence: str = Field(description="'low', 'medium', or 'high'")


class LLMMemoryOutput(BaseModel):
    insights: List[LLMInsightItem]


# --- Content Calendar Scheduling & Publishing Schemas (Milestone 5) ---
class ContentScheduleCreate(BaseModel):
    platform: Optional[str] = Field(None, description="Target platform: 'instagram', 'linkedin', 'x', 'youtube_shorts'")
    scheduled_at: datetime = Field(..., description="Scheduled publication timestamp in ISO 8601 format")
    timezone: str = Field(default="Asia/Kolkata", description="Timezone name, defaults to Asia/Kolkata")


class ContentScheduleUpdate(BaseModel):
    platform: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    timezone: Optional[str] = None


class CancelScheduleRequest(BaseModel):
    reason: Optional[str] = None


class PublishingEventResponse(BaseModel):
    id: str
    schedule_id: str
    event_type: str  # "scheduled", "publishing_started", "published", "publish_succeeded", "failed", "publish_failed", "cancelled", "rescheduled"
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class ContentScheduleResponse(BaseModel):
    id: str
    campaign_content_id: str
    campaign_id: str
    platform: str
    scheduled_at: datetime
    timezone: str
    status: str  # "draft", "scheduled", "publishing", "published", "failed", "cancelled"
    publish_attempts: int = 0
    published_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    external_post_id: Optional[str] = None
    content_title: Optional[str] = None
    content_body: Optional[str] = None
    content_hook: Optional[str] = None
    content_cta: Optional[str] = None
    content_visual_concept: Optional[str] = None
    approval_status: Optional[str] = None
    audit_status: Optional[str] = None
    campaign_name: Optional[str] = None
    publishing_events: List[PublishingEventResponse] = Field(default_factory=list)
    events: List[PublishingEventResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CalendarOverviewResponse(BaseModel):
    total_scheduled: int
    total_published: int
    total_failed: int
    total_cancelled: int
    items: List[ContentScheduleResponse] = Field(default_factory=list)


# --- Milestone 6: Omnichannel Analytics & Continuous Optimization Schemas ---

class PerformanceEntryCreate(BaseModel):
    platform: Optional[str] = None
    campaign_content_id: Optional[str] = None
    impressions: int = Field(default=0, ge=0, description="Total impressions (non-negative)")
    reach: int = Field(default=0, ge=0, description="Total unique reach (non-negative)")
    likes: int = Field(default=0, ge=0, description="Likes (non-negative)")
    comments: int = Field(default=0, ge=0, description="Comments (non-negative)")
    shares: int = Field(default=0, ge=0, description="Shares (non-negative)")
    saves: int = Field(default=0, ge=0, description="Saves / Bookmarks (non-negative)")
    clicks: int = Field(default=0, ge=0, description="Link / CTA Clicks (non-negative)")
    conversions: int = Field(default=0, ge=0, description="Signups / Purchases (non-negative)")
    recorded_at: Optional[datetime] = None


class PerformanceTrendPoint(BaseModel):
    date: str  # YYYY-MM-DD
    impressions: int = 0
    reach: int = 0
    engagement: int = 0
    clicks: int = 0
    conversions: int = 0
    engagement_rate: float = 0.0
    conversion_rate: float = 0.0


class PlatformPerformanceSummary(BaseModel):
    platform: str
    content_count: int = 0
    impressions: int = 0
    reach: int = 0
    engagement: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    clicks: int = 0
    conversions: int = 0
    engagement_rate: float = 0.0
    conversion_rate: float = 0.0
    click_through_rate: float = 0.0
    save_rate: float = 0.0
    share_rate: float = 0.0
    contextual_note: Optional[str] = None


class ContentLeaderboardItem(BaseModel):
    id: str
    campaign_id: str
    title: Optional[str] = None
    platform: str
    content_type: str
    strategy_id: Optional[str] = None
    strategy_label: Optional[str] = None
    approval_status: str = "pending_review"
    publishing_status: Optional[str] = None
    external_post_id: Optional[str] = None
    impressions: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    clicks: int = 0
    conversions: int = 0
    engagement_rate: float = 0.0
    conversion_rate: float = 0.0
    click_through_rate: float = 0.0
    save_rate: float = 0.0
    share_rate: float = 0.0


class AnalyticsInsight(BaseModel):
    type: str  # "strategy", "platform", "content_format", "conversion", "engagement"
    title: str
    observation: str
    interpretation: str
    recommendation: str
    confidence: str  # "low", "medium", "high"
    supporting_metric: Optional[str] = None


class OptimizationRecommendation(BaseModel):
    id: str
    title: str
    recommendation: str
    reason: str
    evidence: str
    confidence: str  # "low", "medium", "high"
    category: str  # "strategy", "platform", "messaging", "cta", "governance"
    target_strategy: Optional[str] = None
    target_platform: Optional[str] = None
    suggested_instructions: Optional[str] = None


class AnalyticsKPISummary(BaseModel):
    total_impressions: int = 0
    total_reach: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_saves: int = 0
    total_clicks: int = 0
    total_conversions: int = 0
    avg_engagement_rate: float = 0.0
    avg_conversion_rate: float = 0.0
    avg_click_through_rate: float = 0.0
    published_count: int = 0
    scheduled_count: int = 0
    failed_count: int = 0
    total_campaigns: int = 0


class CampaignSummaryCard(BaseModel):
    id: str
    name: str
    objective: str
    status: str
    published_count: int = 0
    total_reach: int = 0
    avg_engagement_rate: float = 0.0
    total_conversions: int = 0
    created_at: datetime


class CampaignAnalyticsResponse(BaseModel):
    campaign_id: str
    campaign_name: str
    kpis: AnalyticsKPISummary
    platforms: List[PlatformPerformanceSummary] = Field(default_factory=list)
    leaderboard: List[ContentLeaderboardItem] = Field(default_factory=list)
    trends: List[PerformanceTrendPoint] = Field(default_factory=list)
    insights: List[AnalyticsInsight] = Field(default_factory=list)
    recommendations: List[OptimizationRecommendation] = Field(default_factory=list)
    is_demo_data: bool = False
    has_sufficient_data: bool = True
    notice_message: Optional[str] = None


class GlobalAnalyticsResponse(BaseModel):
    kpis: AnalyticsKPISummary
    platforms: List[PlatformPerformanceSummary] = Field(default_factory=list)
    leaderboard: List[ContentLeaderboardItem] = Field(default_factory=list)
    trends: List[PerformanceTrendPoint] = Field(default_factory=list)
    insights: List[AnalyticsInsight] = Field(default_factory=list)
    recommendations: List[OptimizationRecommendation] = Field(default_factory=list)
    campaigns_summary: List[CampaignSummaryCard] = Field(default_factory=list)
    is_demo_data: bool = False
    has_sufficient_data: bool = True
    notice_message: Optional[str] = None


class CalculatedRates(BaseModel):
    engagement_rate: float = 0.0
    click_through_rate: float = 0.0
    conversion_rate: float = 0.0
    save_rate: float = 0.0
    share_rate: float = 0.0


class ContentAnalyticsResponse(BaseModel):
    content_id: str
    campaign_id: str
    campaign_name: Optional[str] = None
    title: Optional[str] = None
    platform: str
    content_type: str
    strategy_label: Optional[str] = None
    approval_status: str
    publishing_status: Optional[str] = None
    external_post_id: Optional[str] = None
    performance: Optional[CampaignPerformanceResponse] = None
    calculated_rates: CalculatedRates
    audit_status: Optional[str] = None
    revision_count: int = 1
    is_demo_data: bool = False


class DemoSeedRequest(BaseModel):
    campaign_id: Optional[str] = None
    force_reseeding: bool = False


# --- Content Repurposing Schemas ---
class RepurposeContentRequest(BaseModel):
    source_content_id: Optional[str] = None
    source_text: Optional[str] = None
    source_title: Optional[str] = None
    source_platform: Optional[str] = "hero_content"
    target_platforms: List[str] = Field(
        default_factory=lambda: ["instagram", "linkedin", "x", "youtube_shorts"],
        description="List of target platforms: 'instagram', 'linkedin', 'x', 'youtube_shorts'",
    )
    campaign_id: Optional[str] = None
    strategy_id: Optional[str] = None
    save_to_campaign: bool = True


class RepurposeContentResponse(BaseModel):
    source_title: Optional[str] = None
    source_platform: Optional[str] = None
    items: List[CampaignContentResponse] = Field(default_factory=list)


# --- System Settings Schemas ---
class GovernancePolicyInfo(BaseModel):
    id: str
    name: str
    description: str
    engine: str
    status: str
    rule_count: int
    strict_enforcement: bool


class PublishingChannelInfo(BaseModel):
    id: str
    name: str
    type_label: str
    status: str
    is_simulator: bool
    description: str


class SystemSettingsResponse(BaseModel):
    brand: BrandResponse
    database_engine: str
    database_file: str
    backend_port: int
    ai_model: str
    fallback_active: bool
    default_timezone: str
    governance_policies: List[GovernancePolicyInfo] = Field(default_factory=list)
    publishing_channels: List[PublishingChannelInfo] = Field(default_factory=list)


class SystemSettingsUpdate(BaseModel):
    brand_name: Optional[str] = None
    tagline: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    mission: Optional[str] = None
    default_timezone: Optional[str] = None






