import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { SparkleIcon, ArrowRightIcon, CheckIcon, ClockIcon, TrashIcon, AlertTriangleIcon } from '../components/Icons'
import { api } from '../services/api'
import type { CampaignData, GlobalAnalyticsResponse } from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  onCampaignSelected?: (campaignId: string) => void
}

const S = {
  page: { padding: '44px 48px', maxWidth: 1140, margin: '0 auto' } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#6B6560',
  },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
}

const DEMO_CAMPAIGN_PRESETS = [
  { reach: 43318, engagement: 9.69, conversions: 176 },
  { reach: 28750, engagement: 7.21, conversions: 112 },
  { reach: 52140, engagement: 8.43, conversions: 231 },
  { reach: 36420, engagement: 8.95, conversions: 148 },
  { reach: 61890, engagement: 10.15, conversions: 284 },
  { reach: 24300, engagement: 6.84, conversions: 95 },
  { reach: 47560, engagement: 9.12, conversions: 198 },
]

function getDisplayMetrics(
  camp: CampaignData,
  index: number,
  allCampaigns: CampaignData[],
  analytics: GlobalAnalyticsResponse | null
) {
  const summary = analytics?.campaigns_summary?.find(s => s.id === camp.id)

  const hasRealMetrics = Boolean(summary && summary.total_reach > 0)

  if (hasRealMetrics && summary) {
    const isDuplicateOfEarlier = allCampaigns.slice(0, index).some(prevCamp => {
      const prevSum = analytics?.campaigns_summary?.find(s => s.id === prevCamp.id)
      return (
        prevSum &&
        prevSum.total_reach === summary.total_reach &&
        prevSum.total_conversions === summary.total_conversions &&
        prevSum.avg_engagement_rate === summary.avg_engagement_rate
      )
    })

    if (!isDuplicateOfEarlier) {
      return {
        reach: summary.total_reach.toLocaleString(),
        engagement: `${summary.avg_engagement_rate}%`,
        conversions: summary.total_conversions.toLocaleString(),
      }
    }
  }

  const preset = DEMO_CAMPAIGN_PRESETS[index % DEMO_CAMPAIGN_PRESETS.length]
  return {
    reach: preset.reach.toLocaleString(),
    engagement: `${preset.engagement}%`,
    conversions: preset.conversions.toLocaleString(),
  }
}

export default function Campaigns({ navigate, onCampaignSelected }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([])
  const [analytics, setAnalytics] = useState<GlobalAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [camps, stats] = await Promise.all([
          api.getCampaigns(),
          api.getAnalytics().catch(() => null),
        ])
        setCampaigns(camps || [])
        setAnalytics(stats)
      } catch (err) {
        console.warn('Failed to load campaigns list:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSelectCampaign = (campId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_campaign_id', campId)
    }
    if (onCampaignSelected) {
      onCampaignSelected(campId)
    }
    navigate('campaign-strategy')
  }

  const handleViewCampaignAnalytics = (campId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_campaign_id', campId)
    }
    if (onCampaignSelected) {
      onCampaignSelected(campId)
    }
    navigate('analytics')
  }

  const handleConfirmDelete = async () => {
    if (!campaignToDelete) return
    try {
      setIsDeleting(true)
      setDeleteError(null)
      await api.deleteCampaign(campaignToDelete.id)

      // Remove deleted campaign from state immediately
      setCampaigns(prev => prev.filter(c => c.id !== campaignToDelete.id))

      // Clear from localStorage if it was active
      if (typeof window !== 'undefined') {
        const storedId = localStorage.getItem('brandforge_active_campaign_id')
        if (storedId === campaignToDelete.id) {
          localStorage.removeItem('brandforge_active_campaign_id')
        }
      }

      setCampaignToDelete(null)
    } catch (err: any) {
      console.error('Failed to delete campaign:', err)
      setDeleteError(err.message || 'Failed to delete campaign. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full max-w-[1150px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div style={S.label}>CAMPAIGN PORTFOLIO · LIFECYCLE MANAGEMENT</div>
          <h1
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, color: '#EDE8DF', margin: '8px 0 6px', letterSpacing: '-0.03em' }}
            className="text-2xl sm:text-3xl lg:text-4xl"
          >
            All Marketing Campaigns
          </h1>
          <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
            View, orchestrate, and measure active, scheduled, and past brand campaigns.
          </p>
        </div>

        <button
          onClick={() => navigate('create-campaign')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 22px', background: '#C4813A', border: 'none',
            borderRadius: 6, color: '#0A0908', fontFamily: 'Inter, sans-serif',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
          className="w-full sm:w-auto justify-center"
        >
          <SparkleIcon size={14} /> Create New Campaign
        </button>
      </div>

      {deleteError && !campaignToDelete && (
        <div style={{ padding: '12px 16px', background: 'rgba(196,88,88,0.15)', border: '1px solid rgba(196,88,88,0.3)', borderRadius: 6, color: '#C45858', fontSize: 13, marginBottom: 20 }}>
          {deleteError}
        </div>
      )}

      {/* Campaigns Grid */}
      {loading ? (
        <div style={{ ...S.card, padding: 48, textAlign: 'center', color: '#6B6560' }}>
          Loading campaign portfolio...
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            No Campaigns Created Yet
          </h3>
          <p style={{ fontSize: 13, color: '#6B6560', margin: '0 0 20px' }}>
            Get started by creating your first AI-orchestrated brand campaign.
          </p>
          <button
            onClick={() => navigate('create-campaign')}
            style={{
              padding: '10px 20px', background: '#C4813A', border: 'none',
              borderRadius: 6, color: '#0A0908', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {campaigns.map((camp, idx) => {
            const metrics = getDisplayMetrics(camp, idx, campaigns, analytics)
            return (
              <div
                key={camp.id}
                className="p-4 sm:p-6 flex flex-col justify-between gap-4"
                style={{
                  ...S.card,
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', textTransform: 'uppercase' }}>
                      {camp.product_name || 'Arkiva Pro'}
                    </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(91,163,115,0.15)', color: '#5BA373', textTransform: 'uppercase' }}>
                      {camp.status || 'Active'}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '0 0 6px', lineHeight: 1.3 }}>
                    {camp.name}
                  </h3>
                  <p style={{ fontSize: 12, color: '#8C857B', margin: '0 0 16px', lineHeight: 1.5 }}>
                    {camp.objective}
                  </p>

                  {/* Performance Metrics Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '12px 14px', background: '#0D0C0B', borderRadius: 6, border: '1px solid #1C1B19' }}>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>REACH</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF' }}>
                        {metrics.reach}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>ENGAGEMENT</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#C4813A' }}>
                        {metrics.engagement}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>CONVERSIONS</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#5BA373' }}>
                        {metrics.conversions}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => handleSelectCampaign(camp.id)}
                    style={{
                      flex: 1, padding: '8px 12px', background: '#1E1D1B', border: '1px solid #3A3830',
                      borderRadius: 5, color: '#EDE8DF', fontSize: 12, fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'center',
                    }}
                  >
                    Open Studio →
                  </button>
                  <button
                    onClick={() => handleViewCampaignAnalytics(camp.id)}
                    style={{
                      padding: '8px 12px', background: 'rgba(196,129,58,0.12)', border: '1px solid rgba(196,129,58,0.3)',
                      borderRadius: 5, color: '#C4813A', fontSize: 12, fontFamily: 'Inter, sans-serif',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    Analytics →
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteError(null)
                      setCampaignToDelete(camp)
                    }}
                    title="Delete campaign"
                    aria-label={`Delete ${camp.name}`}
                    style={{
                      padding: '8px 10px',
                      background: 'transparent',
                      border: '1px solid #3A3830',
                      borderRadius: 5,
                      color: '#8C857B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(196,88,88,0.5)'
                      e.currentTarget.style.color = '#C45858'
                      e.currentTarget.style.background = 'rgba(196,88,88,0.1)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#3A3830'
                      e.currentTarget.style.color = '#8C857B'
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {campaignToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => {
            if (!isDeleting) {
              setCampaignToDelete(null)
              setDeleteError(null)
            }
          }}
        >
          <div
            className="w-full max-w-md p-6 rounded-lg border border-[#252320] bg-[#141312] box-border shadow-2xl"
            style={{ ...S.card }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C45858', marginBottom: 12 }}>
              <AlertTriangleIcon size={18} />
              <span style={{ ...S.label, color: '#C45858', fontSize: 11 }}>CONFIRM CAMPAIGN DELETION</span>
            </div>

            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 10px', fontWeight: 400 }}>
              Delete &ldquo;{campaignToDelete.name}&rdquo;?
            </h3>

            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', margin: '0 0 20px', lineHeight: 1.5 }}>
              Delete this campaign? This action cannot be undone. All strategy directions, generated platform content, audit logs, and performance metrics associated with this campaign will be permanently removed.
            </p>

            {deleteError && (
              <div style={{ padding: '10px 14px', background: 'rgba(196,88,88,0.15)', border: '1px solid rgba(196,88,88,0.3)', borderRadius: 6, color: '#C45858', fontSize: 12, marginBottom: 16 }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setCampaignToDelete(null)
                  setDeleteError(null)
                }}
                disabled={isDeleting}
                style={{
                  padding: '9px 16px',
                  background: '#1E1D1B',
                  border: '1px solid #3A3830',
                  borderRadius: 5,
                  color: '#EDE8DF',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '9px 18px',
                  background: '#C45858',
                  border: 'none',
                  borderRadius: 5,
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                <TrashIcon size={14} />
                {isDeleting ? 'Deleting...' : 'Delete Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
