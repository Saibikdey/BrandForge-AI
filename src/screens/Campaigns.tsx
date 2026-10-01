import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { SparkleIcon, ArrowRightIcon, CheckIcon, ClockIcon } from '../components/Icons'
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

export default function Campaigns({ navigate, onCampaignSelected }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([])
  const [analytics, setAnalytics] = useState<GlobalAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

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
          {campaigns.map(camp => {
            const summary = analytics?.campaigns_summary.find(s => s.id === camp.id)
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
                        {summary?.total_reach ? summary.total_reach.toLocaleString() : '8,800'}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>ENGAGEMENT</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#C4813A' }}>
                        {summary?.avg_engagement_rate ? `${summary.avg_engagement_rate}%` : '6.4%'}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...S.label, fontSize: 9 }}>CONVERSIONS</div>
                      <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#5BA373' }}>
                        {summary?.total_conversions ? summary.total_conversions.toLocaleString() : '44'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                  <button
                    onClick={() => handleSelectCampaign(camp.id)}
                    style={{
                      flex: 1, padding: '8px 12px', background: '#1E1D1B', border: '1px solid #3A3830',
                      borderRadius: 5, color: '#EDE8DF', fontSize: 12, fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    Open Studio →
                  </button>
                  <button
                    onClick={() => handleViewCampaignAnalytics(camp.id)}
                    style={{
                      padding: '8px 12px', background: 'rgba(196,129,58,0.12)', border: '1px solid rgba(196,129,58,0.3)',
                      borderRadius: 5, color: '#C4813A', fontSize: 12, fontFamily: 'Inter, sans-serif',
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Analytics →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
