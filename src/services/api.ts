import type {
  BrandDNAData,
  Product,
  CampaignData,
  StrategyDirection,
  CampaignContent,
  ContentAudit,
  CampaignAuditResponse,
  HumanApprovalResponse,
  CampaignMemoryResponse,
  CampaignInsight,
  CampaignPerformance,
  ContentSchedule,
  PublishingEvent,
  CalendarOverviewResponse,
  GlobalAnalyticsResponse,
  CampaignAnalyticsResponse,
  ContentAnalyticsResponse,
  OptimizationRecommendation,
  PerformanceEntryPayload,
  RepurposeRequest,
  RepurposeResponse,
  SystemSettingsData,
  SystemSettingsUpdatePayload,
} from '../types/campaign'


const API_BASE = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`API Error [${response.status}] ${response.statusText}: ${errorBody}`)
  }

  return response.json()
}

export const api = {
  // Health
  checkHealth: () => request<{ status: string }>('/health'),

  // Brands
  getCurrentBrand: () => request<BrandDNAData>('/brands/current'),
  updateCurrentBrand: (data: Partial<BrandDNAData>) =>
    request<BrandDNAData>('/brands/current', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getProducts: () => request<Product[]>('/brands/current/products'),

  // Campaigns
  getCampaigns: () => request<CampaignData[]>('/campaigns'),

  createCampaign: (data: {
    name: string
    product_name: string
    objective: string
    audience?: string
    duration: string
    message?: string
    instructions?: string
    platforms: string[]
  }) =>
    request<CampaignData>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCampaign: (id: string) => request<CampaignData>(`/campaigns/${id}`),

  deleteCampaign: (campaignId: string) =>
    request<{ message: string; deleted_campaign_id: string }>(`/campaigns/${campaignId}`, {
      method: 'DELETE',
    }),

  // Strategy Generation
  generateStrategies: (campaignId: string) =>
    request<StrategyDirection[]>(`/campaigns/${campaignId}/generate-strategies`, {
      method: 'POST',
    }),

  getStrategies: (campaignId: string) =>
    request<StrategyDirection[]>(`/campaigns/${campaignId}/strategies`),

  selectStrategy: (campaignId: string, strategyId: string) =>
    request<StrategyDirection>(`/campaigns/${campaignId}/strategies/${strategyId}/select`, {
      method: 'PATCH',
      body: JSON.stringify({ is_selected: true }),
    }),

  // Platform Content Generation (Milestone 2A)
  generateContent: (campaignId: string, strategyId: string, platforms: string[]) =>
    request<CampaignContent[]>(`/campaigns/${campaignId}/content/generate`, {
      method: 'POST',
      body: JSON.stringify({ strategy_id: strategyId, platforms }),
    }),

  getContent: (campaignId: string, params?: { strategy_id?: string; platform?: string }) => {
    const query = new URLSearchParams()
    if (params?.strategy_id) query.append('strategy_id', params.strategy_id)
    if (params?.platform) query.append('platform', params.platform)
    const queryString = query.toString() ? `?${query.toString()}` : ''
    return request<CampaignContent[]>(`/campaigns/${campaignId}/content${queryString}`)
  },

  // BrandGuard & ClaimGuard Audits (Milestone 3A)
  auditContent: (contentId: string) =>
    request<ContentAudit>(`/content/${contentId}/audit`, {
      method: 'POST',
    }),

  getContentAudit: (contentId: string) =>
    request<ContentAudit>(`/content/${contentId}/audit`),

  auditCampaign: (campaignId: string, params?: { strategy_id?: string }) => {
    const query = new URLSearchParams()
    if (params?.strategy_id) query.append('strategy_id', params.strategy_id)
    const queryString = query.toString() ? `?${query.toString()}` : ''
    return request<CampaignAuditResponse>(`/campaigns/${campaignId}/audit${queryString}`, {
      method: 'POST',
    })
  },

  // Human Approval & Content Revision (Milestone 3C)
  getApprovalState: (contentId: string) =>
    request<HumanApprovalResponse>(`/content/${contentId}/approval`),

  submitForReview: (contentId: string) =>
    request<HumanApprovalResponse>(`/content/${contentId}/submit-review`, {
      method: 'POST',
    }),

  requestChanges: (contentId: string, feedback: string) =>
    request<HumanApprovalResponse>(`/content/${contentId}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  approveContent: (contentId: string) =>
    request<HumanApprovalResponse>(`/content/${contentId}/approve`, {
      method: 'POST',
    }),

  rejectContent: (contentId: string, feedback?: string) =>
    request<HumanApprovalResponse>(`/content/${contentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  createRevision: (
    contentId: string,
    revision: {
      title?: string
      body: string
      hook?: string
      call_to_action?: string
      visual_concept?: string
      revision_reason: string
    }
  ) =>
    request<HumanApprovalResponse>(`/content/${contentId}/revisions`, {
      method: 'POST',
      body: JSON.stringify(revision),
    }),

  // Campaign Memory & Learnings (Milestone 4)
  getCampaignMemory: () => request<CampaignMemoryResponse>('/memory'),

  refreshCampaignMemory: () =>
    request<CampaignMemoryResponse>('/memory/refresh', {
      method: 'POST',
    }),

  getMemoryInsight: (insightId: string) =>
    request<CampaignInsight>(`/memory/insights/${insightId}`),

  getCampaignMemoryForCampaign: (campaignId: string) =>
    request<CampaignInsight[]>(`/campaigns/${campaignId}/memory`),

  recordPerformance: (
    campaignId: string,
    data: {
      campaign_content_id?: string
      platform: string
      impressions?: number
      reach?: number
      likes?: number
      comments?: number
      shares?: number
      saves?: number
      clicks?: number
      conversions?: number
      engagement_rate?: number
      conversion_rate?: number
    }
  ) =>
    request<CampaignPerformance>(`/campaigns/${campaignId}/performance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPerformance: (campaignId: string) =>
    request<CampaignPerformance[]>(`/campaigns/${campaignId}/performance`),

  // Content Calendar Scheduling & Publishing (Milestone 5)
  scheduleContent: (
    contentId: string,
    data: {
      platform: string
      scheduled_at: string
      timezone?: string
    }
  ) =>
    request<ContentSchedule>(`/content/${contentId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getContentSchedule: (contentId: string) =>
    request<ContentSchedule[]>(`/content/${contentId}/schedule`),

  getCampaignCalendar: (campaignId: string) =>
    request<ContentSchedule[]>(`/campaigns/${campaignId}/calendar`),

  getCalendar: (params?: {
    start_date?: string
    end_date?: string
    platform?: string
    status?: string
    campaign_id?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.start_date) query.append('start_date', params.start_date)
    if (params?.end_date) query.append('end_date', params.end_date)
    if (params?.platform) query.append('platform', params.platform)
    if (params?.status) query.append('status', params.status)
    if (params?.campaign_id) query.append('campaign_id', params.campaign_id)
    const queryString = query.toString() ? `?${query.toString()}` : ''
    return request<CalendarOverviewResponse>(`/calendar${queryString}`)
  },

  updateSchedule: (
    scheduleId: string,
    data: {
      platform?: string
      scheduled_at?: string
      timezone?: string
    }
  ) =>
    request<ContentSchedule>(`/schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancelSchedule: (scheduleId: string, reason?: string) => {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : ''
    return request<ContentSchedule>(`/schedules/${scheduleId}/cancel${query}`, {
      method: 'POST',
    })
  },

  getPublishingHistory: (scheduleId: string) =>
    request<PublishingEvent[]>(`/schedules/${scheduleId}/history`),

  publishDemo: (scheduleId: string, simulateFailure = false) => {
    const query = simulateFailure ? `?simulate_failure=true` : ''
    return request<ContentSchedule>(`/schedules/${scheduleId}/publish-demo${query}`, {
      method: 'POST',
    })
  },

  // Milestone 6 — Omnichannel Analytics & Continuous Optimization
  getAnalytics: (params?: { date_range?: string; platform?: string; metric?: string }) => {
    const query = new URLSearchParams()
    if (params?.date_range) query.append('date_range', params.date_range)
    if (params?.platform) query.append('platform', params.platform)
    if (params?.metric) query.append('metric', params.metric)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return request<GlobalAnalyticsResponse>(`/analytics${qs}`)
  },

  getCampaignAnalytics: (campaignId: string, params?: { date_range?: string; platform?: string; metric?: string }) => {
    const query = new URLSearchParams()
    if (params?.date_range) query.append('date_range', params.date_range)
    if (params?.platform) query.append('platform', params.platform)
    if (params?.metric) query.append('metric', params.metric)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return request<CampaignAnalyticsResponse>(`/campaigns/${campaignId}/analytics${qs}`)
  },

  getContentAnalytics: (contentId: string) =>
    request<ContentAnalyticsResponse>(`/content/${contentId}/analytics`),

  addCampaignPerformance: (campaignId: string, data: PerformanceEntryPayload) =>
    request<CampaignPerformance>(`/campaigns/${campaignId}/performance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addContentPerformance: (contentId: string, data: PerformanceEntryPayload) =>
    request<CampaignPerformance>(`/content/${contentId}/performance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  seedDemoAnalytics: (campaignId?: string) =>
    request<{ status: string; records_created: number; message: string; is_demo_data: boolean }>(`/analytics/demo-seed`, {
      method: 'POST',
      body: JSON.stringify({ campaign_id: campaignId, force_reseeding: true }),
    }),

  getOptimizationRecommendations: (campaignId?: string) => {
    const query = campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : ''
    return request<OptimizationRecommendation[]>(`/optimization/recommendations${query}`)
  },

  // Content Repurposing (Hero-to-Derivative Adaptation)
  repurposeContent: (payload: RepurposeRequest, campaignId?: string) => {
    const endpoint = campaignId
      ? `/campaigns/${campaignId}/content/repurpose`
      : '/content/repurpose'
    return request<RepurposeResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // System Settings & Governance Configuration
  getSystemSettings: () => request<SystemSettingsData>('/system/settings'),

  updateSystemSettings: (payload: SystemSettingsUpdatePayload) =>
    request<SystemSettingsData>('/system/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
}





