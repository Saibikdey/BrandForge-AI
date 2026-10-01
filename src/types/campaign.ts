export interface Product {
  id: string
  brand_id: string
  name: string
  product_type: string
  price: string
  description?: string
}

export interface VoiceTrait {
  trait: string
  opposite: string
  value: number
}

export interface MessagingPillar {
  title: string
  desc: string
}

export interface TargetAudienceSegment {
  label: string
  name: string
  age: string
  role: string
  pain: string
}

export interface VisualColor {
  name: string
  hex: string
  role: string
}

export interface VisualIdentity {
  colors: VisualColor[]
  typography: {
    display: { font: string; usage: string }
    body: { font: string; usage: string }
  }
}

export interface BrandDNAData {
  id: string
  name: string
  industry?: string
  founded?: string
  stage?: string
  tagline?: string
  mission?: string
  completeness: number
  values: string[]
  voice_traits: VoiceTrait[]
  voice_descriptors: string[]
  messaging_pillars: MessagingPillar[]
  do_list: string[]
  dont_list: string[]
  target_audience: TargetAudienceSegment[]
  visual_identity: VisualIdentity
  products?: Product[]
}

export interface CampaignData {
  id: string
  brand_id?: string
  name: string
  product_name: string
  objective: string
  audience?: string
  duration: string
  message?: string
  instructions?: string
  platforms: string[]
  status: string
}

export interface TimelinePhase {
  week: string
  phase: string
  desc: string
  pieces: number
}

export interface StrategyDirection {
  id: string
  campaign_id: string
  strategy_type: 'product' | 'story' | 'community'
  label: 'Product-Led' | 'Story-Led' | 'Community-Led'
  tagline: string
  desc: string
  core_message?: string
  audience_insight?: string
  audience_tags: string[]
  pillars: string[]
  narrative?: string
  tone?: string
  best: string[]
  color: string
  recommended: boolean
  timeline: TimelinePhase[]
  total_pieces: number
  is_selected: boolean
}

export interface CampaignContent {
  id: string
  campaign_id: string
  strategy_id: string
  platform: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
  content_type: string
  title?: string
  body: string
  hook?: string
  call_to_action?: string
  visual_concept?: string
  metadata_info?: Record<string, any>
  approval_status?: 'pending_review' | 'changes_requested' | 'approved' | 'rejected'
  reviewer_feedback?: string | null
  revision_number?: number
  approved_at?: string | null
  created_at: string
  updated_at?: string | null
}

export interface AuditFinding {
  id: string
  audit_id: string
  guard_type: 'brandguard' | 'claimguard'
  category: string
  severity: 'critical' | 'warning' | 'info'
  status: 'pass' | 'warning' | 'fail'
  title: string
  evidence?: string | null
  explanation: string
  suggestion?: string | null
  created_at: string
}

export interface ContentAudit {
  id: string
  campaign_content_id: string
  overall_status: 'pass' | 'warning' | 'fail'
  summary?: string | null
  is_current: boolean
  findings: AuditFinding[]
  created_at: string
}

export interface CampaignAuditResponse {
  campaign_id: string
  overall_status: 'pass' | 'warning' | 'fail'
  total_audited: number
  audits: ContentAudit[]
}

export interface ContentRevision {
  id: string
  campaign_content_id: string
  revision_number: number
  title?: string | null
  body: string
  hook?: string | null
  call_to_action?: string | null
  visual_concept?: string | null
  metadata_info?: Record<string, any>
  revision_reason?: string | null
  created_at: string
}

export interface ApprovalAction {
  id: string
  campaign_content_id: string
  action: 'submitted' | 'changes_requested' | 'approved' | 'rejected' | 'revision_created'
  feedback?: string | null
  revision_number: number
  created_at: string
}

export interface HumanApprovalResponse {
  campaign_content_id: string
  campaign_id: string
  strategy_id: string
  platform: string
  content_type: string
  title?: string | null
  body: string
  hook?: string | null
  call_to_action?: string | null
  visual_concept?: string | null
  approval_status: 'pending_review' | 'changes_requested' | 'approved' | 'rejected'
  reviewer_feedback?: string | null
  revision_number: number
  approved_at?: string | null
  latest_audit_status?: 'pass' | 'warning' | 'fail' | null
  is_audit_current: boolean
  latest_audit?: ContentAudit | null
  revisions: ContentRevision[]
  approval_history: ApprovalAction[]
  created_at: string
  updated_at?: string | null
}

// Milestone 4 — Campaign Memory & Cross-Campaign Learnings
export interface CampaignLearningSource {
  id: string
  insight_id: string
  campaign_id: string
  campaign_content_id?: string | null
  source_type: string
  metric_name?: string | null
  metric_value?: string | null
  context?: string | null
  created_at: string
}

export interface CampaignInsight {
  id: string
  brand_id?: string | null
  category: 'strategy' | 'platform' | 'content_format' | 'messaging' | 'cta' | 'audience' | 'claim_risk' | 'approval_pattern' | 'performance' | 'general'
  title: string
  insight: string
  recommendation: string
  evidence_summary?: string | null
  confidence: 'low' | 'medium' | 'high'
  source_count: number
  is_active: boolean
  learning_sources: CampaignLearningSource[]
  created_at: string
  updated_at?: string | null
}

export interface CampaignPerformance {
  id: string
  campaign_id: string
  campaign_content_id?: string | null
  platform: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  conversions: number
  engagement_rate: number
  conversion_rate: number
  recorded_at: string
  created_at: string
}

export interface MemoryHealth {
  total_campaigns_analyzed: number
  total_insights: number
  high_confidence_count: number
  total_data_points: number
  last_learned_at?: string | null
}

export interface GovernanceLearningItem {
  guard_type: string
  category: string
  frequency: number
  common_violation: string
  recommendation: string
}

export interface ApprovalLearningItem {
  pattern_type: string
  frequency: number
  detail: string
  recommendation: string
}

export interface PerformanceLearningItem {
  signal_type: 'strategy' | 'platform' | 'content_format' | 'conversion'
  category: string
  evidence_count: number
  observation: string
  recommendation: string
  confidence: 'low' | 'medium' | 'high'
}

export interface CampaignMemoryResponse {
  health: MemoryHealth
  insights: CampaignInsight[]
  governance_learnings: GovernanceLearningItem[]
  approval_learnings: ApprovalLearningItem[]
  performance_learnings?: PerformanceLearningItem[]
  last_learned_at?: string | null
}

// Milestone 5 — Multi-Channel Publishing & Content Calendar Scheduling
export type ScheduleStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'

export type PublishingEventType =
  | 'scheduled'
  | 'publish_started'
  | 'publish_succeeded'
  | 'publish_failed'
  | 'cancelled'
  | 'rescheduled'

export interface PublishingEvent {
  id: string
  schedule_id: string
  event_type: PublishingEventType
  message: string
  created_at: string
}

export interface ContentSchedule {
  id: string
  campaign_content_id: string
  campaign_id: string
  platform: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
  scheduled_at: string
  timezone: string
  status: ScheduleStatus
  publish_attempts: number
  published_at?: string | null
  cancelled_at?: string | null
  failure_reason?: string | null
  external_post_id?: string | null
  content_title?: string | null
  content_body?: string | null
  content_hook?: string | null
  content_cta?: string | null
  content_visual_concept?: string | null
  approval_status?: string | null
  audit_status?: string | null
  campaign_name?: string | null
  publishing_events: PublishingEvent[]
  created_at: string
  updated_at?: string | null
}

export interface CalendarOverviewResponse {
  total_scheduled: number
  total_published: number
  total_failed: number
  total_cancelled: number
  items: ContentSchedule[]
}

// --- Milestone 6: Omnichannel Analytics & Continuous Optimization ---

export interface PerformanceEntryPayload {
  platform?: string
  campaign_content_id?: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  conversions: number
  recorded_at?: string
}

export interface PerformanceTrendPoint {
  date: string
  impressions: number
  reach: number
  engagement: number
  clicks: number
  conversions: number
  engagement_rate: number
  conversion_rate: number
}

export interface PlatformPerformanceSummary {
  platform: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts' | string
  content_count: number
  impressions: number
  reach: number
  engagement: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  conversions: number
  engagement_rate: number
  conversion_rate: number
  click_through_rate: number
  save_rate: number
  share_rate: number
  contextual_note?: string | null
}

export interface ContentLeaderboardItem {
  id: string
  campaign_id: string
  title?: string | null
  platform: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts' | string
  content_type: string
  strategy_id?: string | null
  strategy_label?: string | null
  approval_status: string
  publishing_status?: string | null
  external_post_id?: string | null
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  conversions: number
  engagement_rate: number
  conversion_rate: number
  click_through_rate: number
  save_rate: number
  share_rate: number
}

export interface AnalyticsInsight {
  type: string
  title: string
  observation: string
  interpretation: string
  recommendation: string
  confidence: 'low' | 'medium' | 'high'
  supporting_metric?: string | null
}

export interface OptimizationRecommendation {
  id: string
  title: string
  recommendation: string
  reason: string
  evidence: string
  confidence: 'low' | 'medium' | 'high'
  category: 'strategy' | 'platform' | 'messaging' | 'cta' | 'governance'
  target_strategy?: string | null
  target_platform?: string | null
  suggested_instructions?: string | null
}

export interface AnalyticsKPISummary {
  total_impressions: number
  total_reach: number
  total_likes: number
  total_comments: number
  total_shares: number
  total_saves: number
  total_clicks: number
  total_conversions: number
  avg_engagement_rate: number
  avg_conversion_rate: number
  avg_click_through_rate: number
  published_count: number
  scheduled_count: number
  failed_count: number
  total_campaigns: number
}

export interface CampaignSummaryCard {
  id: string
  name: string
  objective: string
  status: string
  published_count: number
  total_reach: number
  avg_engagement_rate: number
  total_conversions: number
  created_at: string
}

export interface CampaignAnalyticsResponse {
  campaign_id: string
  campaign_name: string
  kpis: AnalyticsKPISummary
  platforms: PlatformPerformanceSummary[]
  leaderboard: ContentLeaderboardItem[]
  trends: PerformanceTrendPoint[]
  insights: AnalyticsInsight[]
  recommendations: OptimizationRecommendation[]
  is_demo_data: boolean
  has_sufficient_data: boolean
  notice_message?: string | null
}

export interface GlobalAnalyticsResponse {
  kpis: AnalyticsKPISummary
  platforms: PlatformPerformanceSummary[]
  leaderboard: ContentLeaderboardItem[]
  trends: PerformanceTrendPoint[]
  insights: AnalyticsInsight[]
  recommendations: OptimizationRecommendation[]
  campaigns_summary: CampaignSummaryCard[]
  is_demo_data: boolean
  has_sufficient_data: boolean
  notice_message?: string | null
}

export interface CalculatedRates {
  engagement_rate: number
  click_through_rate: number
  conversion_rate: number
  save_rate: number
  share_rate: number
}

export interface ContentAnalyticsResponse {
  content_id: string
  campaign_id: string
  campaign_name?: string | null
  title?: string | null
  platform: string
  content_type: string
  strategy_label?: string | null
  approval_status: string
  publishing_status?: string | null
  external_post_id?: string | null
  performance?: CampaignPerformance | null
  calculated_rates: CalculatedRates
  audit_status?: string | null
  revision_count: number
  is_demo_data: boolean
}

// Content Repurposing Types
export interface RepurposeRequest {
  source_content_id?: string
  source_text?: string
  source_title?: string
  source_platform?: string
  target_platforms: string[]
  campaign_id?: string
  strategy_id?: string
  save_to_campaign?: boolean
}

export interface RepurposeResponse {
  source_title?: string
  source_platform?: string
  items: CampaignContent[]
}

// System Settings Types
export interface GovernancePolicyInfo {
  id: string
  name: string
  description: string
  engine: string
  status: string
  rule_count: number
  strict_enforcement: boolean
}

export interface PublishingChannelInfo {
  id: string
  name: string
  type_label: string
  status: string
  is_simulator: boolean
  description: string
}

export interface SystemSettingsData {
  brand: BrandDNAData
  database_engine: string
  database_file: string
  backend_port: number
  ai_model: string
  fallback_active: boolean
  default_timezone: string
  governance_policies: GovernancePolicyInfo[]
  publishing_channels: PublishingChannelInfo[]
}

export interface SystemSettingsUpdatePayload {
  brand_name?: string
  tagline?: string
  industry?: string
  stage?: string
  mission?: string
  default_timezone?: string
}






