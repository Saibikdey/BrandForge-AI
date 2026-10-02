import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  SparkleIcon,
  ArrowRightIcon,
  CheckIcon,
  RefreshIcon,
  ClockIcon,
  ShieldCheckIcon,
  CopyIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  CampaignData,
  GlobalAnalyticsResponse,
  CampaignAnalyticsResponse,
  PlatformPerformanceSummary,
  ContentLeaderboardItem,
  AnalyticsInsight,
  OptimizationRecommendation,
  PerformanceEntryPayload,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  activeCampaignId?: string | null
}

const S = {
  page: { padding: '44px 48px', maxWidth: 1180, margin: '0 auto' } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#6B6560',
  },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
}

const platformIcons: Record<string, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: '#C4813A' },
  linkedin: { label: 'LinkedIn', color: '#5B9BC4' },
  x: { label: 'X (Twitter)', color: '#EDE8DF' },
  youtube_shorts: { label: 'YouTube Shorts', color: '#C45858' },
}

export default function Analytics({ navigate, activeCampaignId }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(activeCampaignId || 'all')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [metricSort, setMetricSort] = useState<string>('engagement_rate')

  const [globalData, setGlobalData] = useState<GlobalAnalyticsResponse | null>(null)
  const [campaignData, setCampaignData] = useState<CampaignAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Performance Entry Modal State
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [submittingEntry, setSubmittingEntry] = useState(false)
  const [entryError, setEntryError] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState<PerformanceEntryPayload>({
    platform: 'instagram',
    impressions: 10000,
    reach: 7500,
    likes: 480,
    comments: 65,
    shares: 95,
    saves: 140,
    clicks: 260,
    conversions: 35,
  })

  // Sync incoming activeCampaignId prop
  useEffect(() => {
    if (activeCampaignId) {
      setSelectedCampaignId(activeCampaignId)
    }
  }, [activeCampaignId])

  // Load analytics whenever selection or filters change
  useEffect(() => {
    loadAnalyticsData()
  }, [selectedCampaignId, dateRange, platformFilter, metricSort])

  async function loadAnalyticsData() {
    setLoading(true)
    setErrorMessage(null)
    try {
      // 1. Fetch campaigns list to verify existence
      const list = await api.getCampaigns().catch(() => [])
      setCampaigns(list || [])

      // 2. Determine target campaign ID and verify it exists
      let targetId = selectedCampaignId

      if (targetId !== 'all') {
        const exists = list && list.some(c => c.id === targetId)
        if (!exists) {
          // Stale ID detected: clear from localStorage if matching
          if (typeof window !== 'undefined') {
            const storedId = localStorage.getItem('brandforge_active_campaign_id')
            if (storedId === targetId) {
              localStorage.removeItem('brandforge_active_campaign_id')
            }
          }

          // Select an existing campaign if one exists, otherwise fallback to global 'all'
          if (list && list.length > 0) {
            targetId = list[0].id
            if (typeof window !== 'undefined') {
              localStorage.setItem('brandforge_active_campaign_id', targetId)
            }
          } else {
            targetId = 'all'
          }

          setSelectedCampaignId(targetId)
        }
      }

      // 3. Request analytics based on verified targetId
      if (targetId === 'all') {
        const data = await api.getAnalytics({
          date_range: dateRange,
          platform: platformFilter === 'all' ? undefined : platformFilter,
          metric: metricSort,
        })
        setGlobalData(data)
        setCampaignData(null)
      } else {
        const data = await api.getCampaignAnalytics(targetId, {
          date_range: dateRange,
          platform: platformFilter === 'all' ? undefined : platformFilter,
          metric: metricSort,
        })
        setCampaignData(data)
        setGlobalData(null)
      }
    } catch (err: any) {
      console.error('Failed to load analytics:', err)
      setErrorMessage(err.message || 'Failed to fetch analytics data from server.')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleSeedDemoData = async () => {
    setLoading(true)
    try {
      const campId = selectedCampaignId === 'all' ? undefined : selectedCampaignId
      const res = await api.seedDemoAnalytics(campId)
      showToast(res.message || 'Deterministic demo metrics generated successfully.')
      await loadAnalyticsData()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate demo metrics.')
      setLoading(false)
    }
  }

  const handleApplyRecommendation = (rec: OptimizationRecommendation) => {
    // Store recommendation in session state for Create Campaign
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_recommendation', JSON.stringify(rec))
    }
    showToast(`Applied "${rec.title}" recommendation to Campaign Creator!`)
    setTimeout(() => {
      navigate('create-campaign')
    }, 400)
  }

  const handleSubmitPerformance = async (e: React.FormEvent) => {
    e.preventDefault()
    setEntryError(null)

    // Client-side validations
    if (entryForm.impressions < 0 || entryForm.reach < 0 || entryForm.clicks < 0 || entryForm.conversions < 0) {
      setEntryError('Metrics cannot be negative numbers.')
      return
    }
    if (entryForm.impressions > 0 && entryForm.clicks > entryForm.impressions) {
      setEntryError('Clicks cannot exceed impressions.')
      return
    }
    if (entryForm.clicks > 0 && entryForm.conversions > entryForm.clicks) {
      setEntryError('Conversions cannot exceed clicks.')
      return
    }
    if (entryForm.impressions > 0 && entryForm.reach > entryForm.impressions) {
      setEntryError('Reach cannot exceed impressions.')
      return
    }

    const targetCampId = selectedCampaignId !== 'all' ? selectedCampaignId : (campaigns[0]?.id || '')
    if (!targetCampId) {
      setEntryError('Please select or create a campaign first.')
      return
    }

    setSubmittingEntry(true)
    try {
      await api.addCampaignPerformance(targetCampId, entryForm)
      showToast('Performance data recorded. Campaign Memory & Analytics updated!')
      setShowEntryModal(false)
      await loadAnalyticsData()
    } catch (err: any) {
      console.error('Failed to submit performance:', err)
      setEntryError(err.message || 'Failed to save performance data.')
    } finally {
      setSubmittingEntry(false)
    }
  }

  // Active data source
  const currentKpis = selectedCampaignId === 'all' ? globalData?.kpis : campaignData?.kpis
  const currentPlatforms = selectedCampaignId === 'all' ? globalData?.platforms : campaignData?.platforms
  const currentLeaderboard = selectedCampaignId === 'all' ? globalData?.leaderboard : campaignData?.leaderboard
  const currentTrends = selectedCampaignId === 'all' ? globalData?.trends : campaignData?.trends
  const currentInsights = selectedCampaignId === 'all' ? globalData?.insights : campaignData?.insights
  const currentRecommendations = selectedCampaignId === 'all' ? globalData?.recommendations : campaignData?.recommendations
  const hasSufficientData = selectedCampaignId === 'all' ? globalData?.has_sufficient_data : campaignData?.has_sufficient_data
  const noticeMsg = selectedCampaignId === 'all' ? globalData?.notice_message : campaignData?.notice_message

  // Max value calculation for Trend Chart scaling
  const maxTrendVal = Math.max(
    ...(currentTrends?.map(t => Math.max(t.impressions, t.reach, t.clicks, t.engagement)) || [1000]),
    100
  )

  return (
    <div className="w-full max-w-[1180px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', background: '#181715', border: '1px solid #5BA373', borderRadius: 6, color: '#EDE8DF', fontSize: 13, zIndex: 100, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <CheckIcon size={14} style={{ color: '#5BA373' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-7">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={S.label}>CONTINUOUS OPTIMIZATION · MEASUREMENT & LEARNING</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(196,129,58,0.15)', color: '#C4813A', border: '1px solid rgba(196,129,58,0.3)' }}>
              DEMO PERFORMANCE ENGINE
            </span>
          </div>
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, color: '#EDE8DF', margin: '0 0 6px', letterSpacing: '-0.03em' }}
          >
            Campaign Analytics
          </h1>
          <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
            Measure what happened. Understand why. Improve what comes next.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2.5 items-center w-full sm:w-auto">
          <button
            onClick={() => setShowEntryModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', background: '#1E1D1B', border: '1px solid #3A3830',
              borderRadius: 6, color: '#EDE8DF', fontSize: 12, fontFamily: 'Inter, sans-serif',
              fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            + Add Performance Data
          </button>
          <button
            onClick={handleSeedDemoData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', background: 'rgba(196,129,58,0.12)', border: '1px solid rgba(196,129,58,0.35)',
              borderRadius: 6, color: '#C4813A', fontSize: 12, fontFamily: 'Inter, sans-serif',
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <SparkleIcon size={13} /> Seed Demo Metrics
          </button>
          <button
            onClick={loadAnalyticsData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', background: '#141312', border: '1px solid #252320',
              borderRadius: 6, color: '#8C857B', fontSize: 12, cursor: 'pointer',
            }}
          >
            <RefreshIcon size={12} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{ padding: '14px 18px', background: 'rgba(196,88,88,0.08)', border: '1px solid #C45858', borderRadius: 6, color: '#EDE8DF', fontSize: 13, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#C45858', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div style={{ ...S.card, padding: '16px 20px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Campaign Selector */}
          <div>
            <span style={{ ...S.label, marginRight: 8 }}>CAMPAIGN:</span>
            <select
              value={selectedCampaignId}
              onChange={e => setSelectedCampaignId(e.target.value)}
              style={{
                background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5,
                color: '#EDE8DF', padding: '6px 12px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            >
              <option value="all">All Campaigns ({campaigns.length})</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Platform Selector */}
          <div>
            <span style={{ ...S.label, marginRight: 8 }}>PLATFORM:</span>
            <select
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
              style={{
                background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5,
                color: '#EDE8DF', padding: '6px 12px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            >
              <option value="all">All Channels</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="x">X (Twitter)</option>
              <option value="youtube_shorts">YouTube Shorts</option>
            </select>
          </div>
        </div>

        {/* Date Range Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#0D0C0B', padding: 3, borderRadius: 6, border: '1px solid #1C1B19' }}>
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              style={{
                padding: '5px 12px', borderRadius: 4, border: 'none',
                background: dateRange === range ? '#1E1D1B' : 'transparent',
                color: dateRange === range ? '#EDE8DF' : '#6B6560',
                fontSize: 11, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {range === 'all' ? 'All Time' : range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-7">
        <div style={{ ...S.card, padding: '20px 22px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>TOTAL REACH</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#EDE8DF', letterSpacing: '-0.02em' }}>
            {currentKpis?.total_reach.toLocaleString() || '0'}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            {currentKpis?.total_impressions.toLocaleString() || '0'} impressions
          </div>
        </div>

        <div style={{ ...S.card, padding: '20px 22px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>AVG ENGAGEMENT RATE</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#C4813A', letterSpacing: '-0.02em' }}>
            {currentKpis?.avg_engagement_rate ? `${currentKpis.avg_engagement_rate}%` : '0.0%'}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            {(currentKpis?.total_likes || 0) + (currentKpis?.total_comments || 0) + (currentKpis?.total_shares || 0) + (currentKpis?.total_saves || 0)} interactions
          </div>
        </div>

        <div style={{ ...S.card, padding: '20px 22px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>TOTAL CLICKS</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#5B9BC4', letterSpacing: '-0.02em' }}>
            {currentKpis?.total_clicks.toLocaleString() || '0'}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            {currentKpis?.avg_click_through_rate ? `${currentKpis.avg_click_through_rate}%` : '0.0%'} CTR
          </div>
        </div>

        <div style={{ ...S.card, padding: '20px 22px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>TOTAL CONVERSIONS</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#5BA373', letterSpacing: '-0.02em' }}>
            {currentKpis?.total_conversions.toLocaleString() || '0'}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            {currentKpis?.avg_conversion_rate ? `${currentKpis.avg_conversion_rate}%` : '0.0%'} conversion rate
          </div>
        </div>

        <div style={{ ...S.card, padding: '20px 22px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>PUBLISHED ASSETS</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#EDE8DF', letterSpacing: '-0.02em' }}>
            {currentKpis?.published_count || 0}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            {currentKpis?.scheduled_count || 0} scheduled in queue
          </div>
        </div>
      </div>

      {/* Performance Trends Section */}
      <div style={{ ...S.card, padding: '24px 28px', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={S.label}>PERFORMANCE TIMELINE</div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '4px 0 0' }}>
              Multi-Channel Velocity & Engagement Trend
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EDE8DF' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C4813A' }} /> Reach
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5B9BC4' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5B9BC4' }} /> Clicks
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5BA373' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5BA373' }} /> Conversions
            </span>
          </div>
        </div>

        {/* SVG Trend Chart */}
        {currentTrends && currentTrends.length > 0 && hasSufficientData ? (
          <div style={{ height: 180, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 12, paddingTop: 20, paddingBottom: 20 }}>
            {currentTrends.map((point, idx) => {
              const reachHeight = Math.max(12, (point.reach / maxTrendVal) * 140)
              const clicksHeight = Math.max(6, (point.clicks / maxTrendVal) * 140)
              const convHeight = Math.max(4, (point.conversions / maxTrendVal) * 140)

              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', justifyContent: 'center' }}>
                    {/* Reach Bar */}
                    <div
                      title={`Reach: ${point.reach.toLocaleString()}`}
                      style={{
                        width: '30%', maxWidth: 20, height: `${reachHeight}px`,
                        background: '#C4813A', borderRadius: '3px 3px 0 0', opacity: 0.85,
                        transition: 'all 0.2s ease',
                      }}
                    />
                    {/* Clicks Bar */}
                    <div
                      title={`Clicks: ${point.clicks.toLocaleString()}`}
                      style={{
                        width: '30%', maxWidth: 20, height: `${clicksHeight}px`,
                        background: '#5B9BC4', borderRadius: '3px 3px 0 0', opacity: 0.9,
                        transition: 'all 0.2s ease',
                      }}
                    />
                    {/* Conversions Bar */}
                    <div
                      title={`Conversions: ${point.conversions.toLocaleString()}`}
                      style={{
                        width: '30%', maxWidth: 20, height: `${convHeight}px`,
                        background: '#5BA373', borderRadius: '3px 3px 0 0',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                    {point.date.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#0D0C0B', borderRadius: 6, border: '1px dashed #252320' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', margin: '0 0 12px' }}>
              {noticeMsg || 'Not enough performance data to display a reliable trend.'}
            </p>
            <button
              onClick={handleSeedDemoData}
              style={{
                padding: '7px 14px', background: '#181715', border: '1px solid #3A3830',
                borderRadius: 5, color: '#C4813A', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Seed Sample Activity Trend
            </button>
          </div>
        )}
      </div>

      {/* Two Column Layout: Platform Comparison & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        {/* Platform Performance Comparison */}
        <div style={{ ...S.card, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={S.label}>CROSS-CHANNEL PERFORMANCE</div>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '4px 0 0' }}>
                Platform Engagement & Conversion
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentPlatforms?.map(p => {
              const cfg = platformIcons[p.platform] || { label: p.platform, color: '#C4813A' }
              return (
                <div
                  key={p.platform}
                  style={{
                    padding: '14px 18px', background: '#0D0C0B', border: '1px solid #1C1B19',
                    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#EDE8DF' }}>
                        {cfg.label}
                      </span>
                    </div>
                    {p.contextual_note && (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: cfg.color, padding: '2px 6px', background: `${cfg.color}15`, borderRadius: 3 }}>
                        {p.contextual_note}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, paddingTop: 4 }}>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>ENGAGEMENT</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF' }}>
                        {p.engagement_rate}%
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>REACH</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF' }}>
                        {p.reach.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>CLICKS</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#5B9BC4' }}>
                        {p.clicks.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>CONVERSIONS</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#5BA373' }}>
                        {p.conversions.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Performance Insights */}
        <div style={{ ...S.card, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={S.label}>AI SYNTHESIS</div>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '4px 0 0' }}>
                AI Performance Insights
              </h3>
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5BA373', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheckIcon size={12} /> EVIDENCE-BACKED
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {currentInsights?.map((ins, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 18px', background: '#0D0C0B', border: '1px solid #1C1B19',
                  borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#EDE8DF' }}>
                    {ins.title}
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: ins.confidence === 'high' ? 'rgba(91,163,115,0.15)' : 'rgba(196,129,58,0.15)', color: ins.confidence === 'high' ? '#5BA373' : '#C4813A' }}>
                    {ins.confidence} Confidence
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#8C857B', lineHeight: 1.5 }}>
                  <strong style={{ color: '#C4813A', fontFamily: 'DM Mono, monospace', fontSize: 10, display: 'block', marginBottom: 2 }}>OBSERVATION</strong>
                  {ins.observation}
                </div>

                <div style={{ fontSize: 12, color: '#EDE8DF', lineHeight: 1.5 }}>
                  <strong style={{ color: '#5B9BC4', fontFamily: 'DM Mono, monospace', fontSize: 10, display: 'block', marginBottom: 2 }}>INTERPRETATION</strong>
                  {ins.interpretation}
                </div>

                <div style={{ fontSize: 12, color: '#C4B89A', background: '#141312', padding: '8px 10px', borderRadius: 4, marginTop: 2, borderLeft: '2px solid #5BA373' }}>
                  <strong style={{ color: '#5BA373', fontFamily: 'DM Mono, monospace', fontSize: 10, display: 'block', marginBottom: 2 }}>RECOMMENDED EXPERIMENT</strong>
                  {ins.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Continuous Optimization Recommendations Panel */}
      <div style={{ ...S.card, padding: '28px 32px', marginBottom: 28, border: '1px solid #C4813A40', background: 'linear-gradient(180deg, #141312 0%, #0F0E0D 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...S.label, color: '#C4813A' }}>CONTINUOUS OPTIMIZATION LOOP</div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontWeight: 400, color: '#EDE8DF', margin: '4px 0 0' }}>
              Next Campaign Optimization Recommendations
            </h3>
            <p style={{ color: '#8C857B', fontSize: 13, margin: '4px 0 0' }}>
              AI recommends · Human decides. Learnings from current campaign results are synthesized for upcoming campaign cycles.
            </p>
          </div>
          <button
            onClick={() => navigate('campaign-memory')}
            style={{
              padding: '8px 14px', background: '#181715', border: '1px solid #3A3830',
              borderRadius: 6, color: '#EDE8DF', fontSize: 12, fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
            }}
          >
            View Campaign Memory →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentRecommendations?.map(rec => (
            <div
              key={rec.id}
              style={{
                padding: '20px', background: '#0D0C0B', border: '1px solid #252320',
                borderRadius: 6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#C4813A' }}>
                    {rec.category} RECOMMENDATION
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(91,163,115,0.15)', color: '#5BA373' }}>
                    {rec.confidence} confidence
                  </span>
                </div>

                <h4 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
                  {rec.title}
                </h4>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A', margin: '0 0 10px', lineHeight: 1.5 }}>
                  {rec.recommendation}
                </p>

                <div style={{ fontSize: 11, color: '#6B6560', fontFamily: 'DM Mono, monospace', marginBottom: 6 }}>
                  EVIDENCE: {rec.evidence}
                </div>
              </div>

              <button
                onClick={() => handleApplyRecommendation(rec)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', background: 'rgba(196,129,58,0.12)', border: '1px solid rgba(196,129,58,0.3)',
                  borderRadius: 5, color: '#C4813A', fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                Apply to Next Campaign <ArrowRightIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content Performance Leaderboard */}
      <div style={{ ...S.card, padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={S.label}>INDIVIDUAL CONTENT ATTRIBUTION</div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '4px 0 0' }}>
              Content Performance Leaderboard
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...S.label, fontSize: 9 }}>SORT BY:</span>
            <select
              value={metricSort}
              onChange={e => setMetricSort(e.target.value)}
              style={{
                background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5,
                color: '#EDE8DF', padding: '5px 10px', fontSize: 12, outline: 'none',
              }}
            >
              <option value="engagement_rate">Engagement Rate</option>
              <option value="clicks">Clicks</option>
              <option value="conversions">Conversions</option>
              <option value="conversion_rate">Conversion Rate</option>
              <option value="saves">Saves / Bookmarks</option>
              <option value="shares">Shares</option>
              <option value="impressions">Impressions</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1C1B19', color: '#6B6560', fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Content Asset</th>
                <th style={{ padding: '10px 12px' }}>Platform</th>
                <th style={{ padding: '10px 12px' }}>Strategy</th>
                <th style={{ padding: '10px 12px' }}>Reach</th>
                <th style={{ padding: '10px 12px' }}>Engagement</th>
                <th style={{ padding: '10px 12px' }}>Clicks</th>
                <th style={{ padding: '10px 12px' }}>Conversions</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentLeaderboard && currentLeaderboard.length > 0 ? (
                currentLeaderboard.map(item => {
                  const pCfg = platformIcons[item.platform] || { label: item.platform, color: '#C4813A' }
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #141312', transition: 'background 0.1s ease' }}>
                      <td style={{ padding: '12px 12px', color: '#EDE8DF', fontWeight: 500, maxWidth: 220, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {item.title || `${item.platform} Post`}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: pCfg.color }}>
                          {pCfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', color: '#8C857B', fontSize: 12 }}>
                        {item.strategy_label}
                      </td>
                      <td style={{ padding: '12px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#EDE8DF' }}>
                        {item.reach.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#C4813A' }}>
                        {item.engagement_rate}%
                      </td>
                      <td style={{ padding: '12px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5B9BC4' }}>
                        {item.clicks.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5BA373' }}>
                        {item.conversions.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: item.publishing_status === 'published' ? 'rgba(91,163,115,0.15)' : '#181715', color: item.publishing_status === 'published' ? '#5BA373' : '#8C857B' }}>
                          {item.publishing_status || 'Draft'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#6B6560' }}>
                    No content performance logged yet. Publish assets or click "Seed Demo Metrics" above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Performance Data Modal */}
      {showEntryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="w-full max-w-lg p-5 sm:p-8 max-h-[90vh] overflow-y-auto rounded-lg border border-[#252320] bg-[#141312] box-border">
            <div style={{ ...S.label, color: '#C4813A', marginBottom: 8 }}>
              DEMO PERFORMANCE DATA ENTRY
            </div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
              Record Post-Launch Metrics
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', margin: '0 0 20px', lineHeight: 1.5 }}>
              Enter campaign performance data. Metrics are validated, recorded in SQLite, and continuously feed Campaign Memory and Optimization recommendations.
            </p>

            {entryError && (
              <div style={{ padding: '10px 14px', background: 'rgba(196,88,88,0.1)', border: '1px solid #C45858', borderRadius: 5, color: '#C45858', fontSize: 12, marginBottom: 16 }}>
                {entryError}
              </div>
            )}

            <form onSubmit={handleSubmitPerformance} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>CHANNEL PLATFORM</label>
                <select
                  value={entryForm.platform}
                  onChange={e => setEntryForm(f => ({ ...f, platform: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5, color: '#EDE8DF', fontSize: 13 }}
                >
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="x">X (Twitter)</option>
                  <option value="youtube_shorts">YouTube Shorts</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>IMPRESSIONS</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.impressions}
                    onChange={e => setEntryForm(f => ({ ...f, impressions: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '8px 12px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5, color: '#EDE8DF', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>REACH</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.reach}
                    onChange={e => setEntryForm(f => ({ ...f, reach: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '8px 12px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5, color: '#EDE8DF', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>LIKES</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.likes}
                    onChange={e => setEntryForm(f => ({ ...f, likes: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '6px 8px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 4, color: '#EDE8DF', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>COMMENTS</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.comments}
                    onChange={e => setEntryForm(f => ({ ...f, comments: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '6px 8px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 4, color: '#EDE8DF', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>SHARES</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.shares}
                    onChange={e => setEntryForm(f => ({ ...f, shares: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '6px 8px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 4, color: '#EDE8DF', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>SAVES</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.saves}
                    onChange={e => setEntryForm(f => ({ ...f, saves: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '6px 8px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 4, color: '#EDE8DF', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>CLICKS (LINK/CTA)</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.clicks}
                    onChange={e => setEntryForm(f => ({ ...f, clicks: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '8px 12px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5, color: '#EDE8DF', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>CONVERSIONS</label>
                  <input
                    type="number"
                    min={0}
                    value={entryForm.conversions}
                    onChange={e => setEntryForm(f => ({ ...f, conversions: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '8px 12px', background: '#0D0C0B', border: '1px solid #252320', borderRadius: 5, color: '#EDE8DF', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  disabled={submittingEntry}
                  style={{ padding: '8px 16px', background: '#181715', border: '1px solid #252320', borderRadius: 5, color: '#8C857B', fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEntry}
                  style={{ padding: '8px 20px', background: '#C4813A', border: 'none', borderRadius: 5, color: '#0A0908', fontSize: 12, fontWeight: 600, cursor: submittingEntry ? 'not-allowed' : 'pointer' }}
                >
                  {submittingEntry ? 'Saving...' : 'Save Metrics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
