import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  SparkleIcon,
  ArrowRightIcon,
  CheckIcon,
  ShieldCheckIcon,
  ClockIcon,
  RefreshIcon,
  AlertTriangleIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  CampaignMemoryResponse,
  CampaignInsight,
  GovernanceLearningItem,
  ApprovalLearningItem,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
}

const S = {
  page: { padding: '48px 48px', maxWidth: 1100, margin: '0 auto' } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#3A3830',
  },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
}

export default function CampaignMemory({ navigate }: Props) {
  const [memoryData, setMemoryData] = useState<CampaignMemoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    loadMemory()
  }, [])

  async function loadMemory() {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await api.getCampaignMemory()
      setMemoryData(data)
    } catch (err: any) {
      console.error('Failed to load campaign memory:', err)
      setErrorMessage(err.message || 'Failed to load campaign memory.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setErrorMessage(null)
    try {
      const refreshed = await api.refreshCampaignMemory()
      setMemoryData(refreshed)
    } catch (err: any) {
      console.error('Failed to refresh campaign memory:', err)
      setErrorMessage(err.message || 'Failed to refresh memory intelligence.')
    } finally {
      setRefreshing(false)
    }
  }

  const toggleEvidence = (id: string) => {
    setExpandedInsightId(prev => (prev === id ? null : id))
  }

  const filteredInsights = (memoryData?.insights || []).filter(ins => {
    if (activeCategory === 'all') return true
    if (activeCategory === 'strategy') return ins.category === 'strategy'
    if (activeCategory === 'platform') return ins.category === 'platform' || ins.category === 'content_format'
    if (activeCategory === 'governance') return ins.category === 'claim_risk' || ins.category === 'messaging'
    if (activeCategory === 'approval') return ins.category === 'approval_pattern' || ins.category === 'cta'
    if (activeCategory === 'performance') return ins.category === 'performance'
    return true
  })

  const getConfidenceBadge = (confidence: string) => {
    if (confidence === 'high') {
      return {
        label: 'HIGH CONFIDENCE',
        color: '#5BA373',
        bg: 'rgba(91,163,115,0.12)',
        border: 'rgba(91,163,115,0.3)',
      }
    }
    if (confidence === 'medium') {
      return {
        label: 'MEDIUM SIGNAL',
        color: '#C4813A',
        bg: 'rgba(196,129,58,0.12)',
        border: 'rgba(196,129,58,0.3)',
      }
    }
    return {
      label: 'EARLY SIGNAL',
      color: '#5B9BC4',
      bg: 'rgba(91,155,196,0.12)',
      border: 'rgba(91,155,196,0.3)',
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strategy':
        return '#C4813A'
      case 'platform':
        return '#5B9BC4'
      case 'claim_risk':
        return '#E5A93C'
      case 'approval_pattern':
        return '#A78BFA'
      case 'performance':
        return '#5BA373'
      default:
        return '#C4813A'
    }
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ ...S.label, color: '#C4813A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <SparkleIcon size={12} style={{ color: '#C4813A' }} />
            INTELLIGENCE & CONTINUOUS LEARNING
          </div>
          <h1
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 34,
              fontWeight: 300,
              color: '#EDE8DF',
              margin: '8px 0 8px',
              letterSpacing: '-0.03em',
            }}
          >
            Campaign Memory
          </h1>
          <p style={{ color: '#6B6560', fontSize: 13, margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
            Synthesizes past campaign strategies, ClaimGuard governance outcomes, reviewer revisions, and engagement metrics into explainable recommendations for future marketing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#161514',
              border: '1px solid #252320',
              borderRadius: 6,
              color: '#EDE8DF',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
          >
            <RefreshIcon size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Re-analyzing...' : 'Refresh Memory'}
          </button>

          <button
            onClick={() => navigate('create-campaign')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#C4813A',
              border: 'none',
              borderRadius: 6,
              color: '#0A0908',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Use for Next Campaign <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(196,88,88,0.1)',
            border: '1px solid #C45858',
            borderRadius: 6,
            color: '#EDE8DF',
            fontSize: 13,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangleIcon size={16} style={{ color: '#C45858' }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Memory Health Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div style={{ ...S.card, padding: '18px 20px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Campaigns Analyzed</div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 26,
              fontWeight: 400,
              color: '#EDE8DF',
            }}
          >
            {loading ? '—' : memoryData?.health.total_campaigns_analyzed || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Historical dataset in SQLite
          </div>
        </div>

        <div style={{ ...S.card, padding: '18px 20px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Active Insights</div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 26,
              fontWeight: 400,
              color: '#C4813A',
            }}
          >
            {loading ? '—' : memoryData?.health.total_insights || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Extracted cross-campaign signals
          </div>
        </div>

        <div style={{ ...S.card, padding: '18px 20px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>High Confidence</div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 26,
              fontWeight: 400,
              color: '#5BA373',
            }}
          >
            {loading ? '—' : memoryData?.health.high_confidence_count || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Supported by 3+ data sources
          </div>
        </div>

        <div style={{ ...S.card, padding: '18px 20px' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Data Points Traced</div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 26,
              fontWeight: 400,
              color: '#5B9BC4',
            }}
          >
            {loading ? '—' : memoryData?.health.total_data_points || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Audits, approvals & metrics
          </div>
        </div>
      </div>

      {/* Category Filter Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid #1C1B19',
          paddingBottom: 12,
          marginBottom: 28,
        }}
      >
        {[
          { id: 'all', label: 'All Insights' },
          { id: 'strategy', label: 'Strategy Direction' },
          { id: 'platform', label: 'Platform Synergy' },
          { id: 'governance', label: 'ClaimGuard Governance' },
          { id: 'approval', label: 'Reviewer Feedback' },
          { id: 'performance', label: 'Performance' },
        ].map(tab => {
          const active = activeCategory === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                background: active ? '#1A1816' : 'transparent',
                border: `1px solid ${active ? '#C4813A' : 'transparent'}`,
                color: active ? '#C4813A' : '#6B6560',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Main Insights Content Grid */}
      {loading ? (
        <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid rgba(196,129,58,0.2)',
              borderTop: '2px solid #C4813A',
              borderRadius: '50%',
              margin: '0 auto 16px',
            }}
            className="animate-spin"
          />
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560' }}>
            Compiling campaign memory & cross-campaign learnings...
          </div>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#C4B89A', marginBottom: 8 }}>
            No Active Memory Insights
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 460, margin: '0 auto 20px' }}>
            Generate your first campaign and run BrandGuard audits to begin populating campaign memory.
          </p>
          <button
            onClick={() => navigate('create-campaign')}
            style={{
              padding: '9px 18px',
              background: '#C4813A',
              border: 'none',
              borderRadius: 6,
              color: '#0A0908',
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filteredInsights.map(ins => {
            const badge = getConfidenceBadge(ins.confidence)
            const isExpanded = expandedInsightId === ins.id
            const catColor = getCategoryColor(ins.category)

            return (
              <div
                key={ins.id}
                style={{
                  ...S.card,
                  padding: 24,
                  borderLeft: `3px solid ${catColor}`,
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: catColor,
                        padding: '3px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 4,
                        border: '1px solid #1F1D1A',
                      }}
                    >
                      {ins.category.replace('_', ' ')}
                    </span>
                    <span
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: badge.color,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4A4640' }}>
                    {ins.source_count} source data point{ins.source_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Insight Title */}
                <h3
                  style={{
                    fontFamily: 'Fraunces, Georgia, serif',
                    fontSize: 18,
                    fontWeight: 400,
                    color: '#EDE8DF',
                    margin: '0 0 10px',
                    lineHeight: 1.35,
                  }}
                >
                  {ins.title}
                </h3>

                {/* Insight Description */}
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: '#9C948A',
                    margin: '0 0 16px',
                    lineHeight: 1.6,
                  }}
                >
                  {ins.insight}
                </p>

                {/* Recommendation Box */}
                <div
                  style={{
                    padding: '14px 16px',
                    background: '#151413',
                    border: '1px solid #22201D',
                    borderLeft: `3px solid #C4813A`,
                    borderRadius: '0 6px 6px 0',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#C4813A',
                      marginBottom: 4,
                    }}
                  >
                    Actionable Guidance for Next Campaign
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#EDE8DF', lineHeight: 1.5 }}>
                    {ins.recommendation}
                  </div>
                </div>

                {/* Evidence Accordion Button & Drawer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                  <button
                    onClick={() => toggleEvidence(ins.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6B6560',
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EDE8DF')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6B6560')}
                  >
                    <span>{isExpanded ? 'Hide Traceable Evidence' : 'View Traceable Evidence & Data Sources'}</span>
                    <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {ins.evidence_summary && (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4A4640' }}>
                      {ins.evidence_summary}
                    </span>
                  )}
                </div>

                {/* Expanded Traceable Sources Drawer */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      background: '#0D0C0B',
                      border: '1px solid #1C1B19',
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 10,
                        color: '#6B6560',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 12,
                      }}
                    >
                      Underlying Empirical Sources ({ins.learning_sources?.length || 0})
                    </div>

                    {(!ins.learning_sources || ins.learning_sources.length === 0) ? (
                      <div style={{ fontSize: 12, color: '#4A4640', fontStyle: 'italic' }}>
                        Synthesized across global campaign baseline metrics.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ins.learning_sources.map((src, sIdx) => (
                          <div
                            key={src.id || sIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: '#131211',
                              border: '1px solid #1A1918',
                              borderRadius: 4,
                              fontSize: 11,
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', color: '#C4813A' }}>
                                [{src.source_type.toUpperCase()}] {src.metric_name ? `• ${src.metric_name}` : ''}
                              </span>
                              <span style={{ color: '#8A8278', fontFamily: 'Inter, sans-serif' }}>
                                {src.context || 'Campaign record verification'}
                              </span>
                            </div>

                            {src.metric_value && (
                              <span
                                style={{
                                  fontFamily: 'DM Mono, monospace',
                                  color: '#EDE8DF',
                                  background: '#1F1D1A',
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {src.metric_value}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Triple Deep-Dive Intelligence Panels */}
      {!loading && memoryData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 40 }}>
          {/* Governance Learnings Panel */}
          <div style={{ ...S.card, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ShieldCheckIcon size={16} style={{ color: '#5BA373' }} />
              <h4
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#EDE8DF',
                  margin: 0,
                }}
              >
                Governance Learnings
              </h4>
            </div>
            <p style={{ fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
              Recurring ClaimGuard flags & policy adherence patterns.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(memoryData.governance_learnings || []).map((gov, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    background: '#151413',
                    border: '1px solid #1F1D1A',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#E5A93C' }}>
                      {gov.category.toUpperCase()} ({gov.frequency}x flagged)
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#EDE8DF', fontWeight: 500, marginBottom: 4 }}>
                    {gov.common_violation}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A8278', lineHeight: 1.4 }}>
                    <span style={{ color: '#5BA373' }}>Guideline:</span> {gov.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Approval Feedback Trends Panel */}
          <div style={{ ...S.card, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckIcon size={16} style={{ color: '#A78BFA' }} />
              <h4
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#EDE8DF',
                  margin: 0,
                }}
              >
                Reviewer Preference Trends
              </h4>
            </div>
            <p style={{ fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
              Editorial habits and common revision requests analyzed from approval queues.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(memoryData.approval_learnings || []).map((app, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    background: '#151413',
                    border: '1px solid #1F1D1A',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#A78BFA' }}>
                      {app.pattern_type.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#EDE8DF', fontWeight: 500, marginBottom: 4 }}>
                    {app.detail}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A8278', lineHeight: 1.4 }}>
                    <span style={{ color: '#C4813A' }}>Editorial Standard:</span> {app.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Learnings Panel */}
          <div style={{ ...S.card, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SparkleIcon size={15} style={{ color: '#C4813A' }} />
                <h4
                  style={{
                    fontFamily: 'Fraunces, Georgia, serif',
                    fontSize: 16,
                    fontWeight: 400,
                    color: '#EDE8DF',
                    margin: 0,
                  }}
                >
                  Performance Learnings
                </h4>
              </div>
              <button
                onClick={() => navigate('analytics')}
                style={{
                  background: 'none', border: 'none', color: '#C4813A',
                  fontSize: 11, fontFamily: 'DM Mono, monospace', cursor: 'pointer',
                }}
              >
                Analytics →
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
              Empirical multi-channel engagement, conversion, and reach signals.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(memoryData.performance_learnings || []).map((perf, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    background: '#151413',
                    border: '1px solid #1F1D1A',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A' }}>
                      {perf.signal_type.toUpperCase()} SIGNAL · {perf.evidence_count} evidence pts
                    </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(196,129,58,0.15)', color: '#C4813A' }}>
                      {perf.confidence}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#EDE8DF', fontWeight: 500, marginBottom: 4 }}>
                    {perf.observation}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A8278', lineHeight: 1.4 }}>
                    <span style={{ color: '#5B9BC4' }}>Optimization:</span> {perf.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div
        style={{
          marginTop: 40,
          padding: 24,
          background: 'rgba(196,129,58,0.05)',
          border: '1px solid rgba(196,129,58,0.2)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF', marginBottom: 4 }}>
            Apply Historical Learnings to Your Next Campaign
          </div>
          <div style={{ fontSize: 12, color: '#8A8278' }}>
            New campaigns automatically leverage these verified narrative angles, ClaimGuard guidelines, and reviewer preferences.
          </div>
        </div>

        <button
          onClick={() => navigate('create-campaign')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 22px',
            background: '#C4813A',
            border: 'none',
            borderRadius: 6,
            color: '#0A0908',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Launch New Campaign with Memory <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  )
}
