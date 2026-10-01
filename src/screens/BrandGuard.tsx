import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  ShieldIcon,
  SparkleIcon,
  CheckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  InfoIcon,
  RefreshIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  CampaignData,
  StrategyDirection,
  CampaignContent,
  ContentAudit,
  AuditFinding,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  activeCampaignId?: string | null
  activeStrategyId?: string | null
  activeContentId?: string | null
  onContentSelected?: (contentId: string) => void
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

interface PlatformMeta {
  id: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
  label: string
  color: string
}

const platformMetas: PlatformMeta[] = [
  { id: 'instagram', label: 'Instagram', color: '#C4813A' },
  { id: 'linkedin', label: 'LinkedIn', color: '#5B9BC4' },
  { id: 'x', label: 'X (Twitter)', color: '#EDE8DF' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', color: '#C45858' },
]

const auditLoadingStages = [
  'Analyzing brand consistency and voice tone...',
  'Checking messaging pillars and creative guidelines...',
  'Scanning for brand do and dont rule compliance...',
  'Verifying claims with ClaimGuard policy engine...',
  'Evaluating environmental, numerical and absolute assertions...',
]

export default function BrandGuard({
  navigate,
  activeCampaignId,
  activeStrategyId,
  activeContentId,
  onContentSelected,
}: Props) {
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [strategies, setStrategies] = useState<StrategyDirection[]>([])
  const [activeStrategy, setActiveStrategy] = useState<StrategyDirection | null>(null)
  const [contents, setContents] = useState<CampaignContent[]>([])
  const [selectedContent, setSelectedContent] = useState<CampaignContent | null>(null)
  const [audit, setAudit] = useState<ContentAudit | null>(null)
  const [allAudits, setAllAudits] = useState<Record<string, ContentAudit>>({})

  const [loading, setLoading] = useState(true)
  const [auditing, setAuditing] = useState(false)
  const [auditStageIdx, setAuditStageIdx] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({})
  const [previewOpen, setPreviewOpen] = useState(true)

  // Resolve active campaign ID
  const effectiveCampaignId =
    activeCampaignId ||
    (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_campaign_id') : null)

  // Rotate stage messages during audit
  useEffect(() => {
    if (!auditing) return
    const timer = setInterval(() => {
      setAuditStageIdx(prev => (prev + 1) % auditLoadingStages.length)
    }, 900)
    return () => clearInterval(timer)
  }, [auditing])

  // Toast auto-hide
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(t)
  }, [toastMessage])

  // Load campaign, strategies, content, and existing audit
  useEffect(() => {
    async function loadData() {
      let campId = effectiveCampaignId

      if (!campId) {
        try {
          const list = await api.getCampaigns()
          if (list && list.length > 0) {
            campId = list[0].id
            if (typeof window !== 'undefined') {
              localStorage.setItem('brandforge_active_campaign_id', campId)
            }
          }
        } catch (e) {
          console.warn('Could not discover existing campaigns:', e)
        }
      }

      if (!campId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage(null)
      try {
        const [campData, stratList, contentList] = await Promise.all([
          api.getCampaign(campId),
          api.getStrategies(campId),
          api.getContent(campId),
        ])

        setCampaign(campData)
        setStrategies(stratList || [])

        // Resolve active strategy
        const targetStratId =
          activeStrategyId ||
          (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_strategy_id') : null)

        let resolvedStrat: StrategyDirection | undefined
        if (stratList && stratList.length > 0) {
          resolvedStrat =
            (targetStratId ? stratList.find(s => s.id === targetStratId || s.strategy_type === targetStratId) : undefined) ||
            stratList.find(s => s.is_selected) ||
            stratList.find(s => s.recommended) ||
            stratList[0]
          setActiveStrategy(resolvedStrat || null)
        }

        // Filter contents by resolved strategy if available
        const strategyContents = resolvedStrat
          ? (contentList || []).filter(c => c.strategy_id === resolvedStrat?.id)
          : contentList || []

        setContents(strategyContents)

        // Determine selected content
        const targetContentId =
          activeContentId ||
          (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_content_id') : null)

        let targetContent = strategyContents.find(c => c.id === targetContentId)
        if (!targetContent && strategyContents.length > 0) {
          targetContent = strategyContents[0]
        }

        setSelectedContent(targetContent || null)

        if (targetContent) {
          if (onContentSelected) {
            onContentSelected(targetContent.id)
          } else if (typeof window !== 'undefined') {
            localStorage.setItem('brandforge_active_content_id', targetContent.id)
          }

          // Fetch existing audit for this content item
          try {
            const auditData = await api.getContentAudit(targetContent.id)
            if (auditData) {
              setAudit(auditData)
              setAllAudits(prev => ({ ...prev, [targetContent.id]: auditData }))
              // Auto-expand warnings/fails
              const initialExpanded: Record<string, boolean> = {}
              auditData.findings.forEach(f => {
                if (f.status === 'fail' || f.status === 'warning') {
                  initialExpanded[f.id] = true
                }
              })
              setExpandedFindings(initialExpanded)
            }
          } catch (auditErr) {
            // No audit exists yet for this content item
            setAudit(null)
          }
        }
      } catch (err: any) {
        console.error('Error loading BrandGuard data:', err)
        setErrorMessage('Failed to load campaign and content data for BrandGuard.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [effectiveCampaignId, activeStrategyId])

  // Switch selected content asset
  const handleSelectContent = async (item: CampaignContent) => {
    setSelectedContent(item)
    if (onContentSelected) {
      onContentSelected(item.id)
    } else if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_content_id', item.id)
    }

    setErrorMessage(null)

    // Check if we already have the audit in memory
    if (allAudits[item.id]) {
      setAudit(allAudits[item.id])
      return
    }

    // Otherwise fetch from backend
    try {
      const auditData = await api.getContentAudit(item.id)
      if (auditData) {
        setAudit(auditData)
        setAllAudits(prev => ({ ...prev, [item.id]: auditData }))
        const initialExpanded: Record<string, boolean> = {}
        auditData.findings.forEach(f => {
          if (f.status === 'fail' || f.status === 'warning') {
            initialExpanded[f.id] = true
          }
        })
        setExpandedFindings(initialExpanded)
      }
    } catch {
      setAudit(null)
    }
  }

  // Run or re-run audit
  const handleRunAudit = async () => {
    if (!selectedContent) return

    setAuditing(true)
    setErrorMessage(null)
    try {
      const result = await api.auditContent(selectedContent.id)
      setAudit(result)
      setAllAudits(prev => ({ ...prev, [selectedContent.id]: result }))

      // Auto-expand warnings and fails
      const initialExpanded: Record<string, boolean> = {}
      result.findings.forEach(f => {
        if (f.status === 'fail' || f.status === 'warning') {
          initialExpanded[f.id] = true
        }
      })
      setExpandedFindings(initialExpanded)
      setToastMessage('BrandGuard audit completed.')
    } catch (err: any) {
      console.error('Audit execution error:', err)
      setErrorMessage('Audit could not be completed. Please try again.')
    } finally {
      setAuditing(false)
    }
  }

  const toggleFinding = (id: string) => {
    setExpandedFindings(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const brandguardFindings = (audit?.findings || []).filter(f => f.guard_type === 'brandguard')
  const claimguardFindings = (audit?.findings || []).filter(f => f.guard_type === 'claimguard')

  // Render status badge helper
  const renderStatusBadge = (status: 'pass' | 'warning' | 'fail') => {
    if (status === 'pass') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 4,
            background: 'rgba(91, 163, 115, 0.15)',
            border: '1px solid rgba(91, 163, 115, 0.3)',
            color: '#5BA373',
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.05em',
          }}
        >
          <CheckIcon size={10} /> PASS
        </span>
      )
    }
    if (status === 'warning') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 4,
            background: 'rgba(196, 129, 58, 0.15)',
            border: '1px solid rgba(196, 129, 58, 0.3)',
            color: '#C4813A',
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.05em',
          }}
        >
          <AlertTriangleIcon size={10} /> WARNING
        </span>
      )
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 4,
          background: 'rgba(196, 88, 88, 0.15)',
          border: '1px solid rgba(196, 88, 88, 0.3)',
          color: '#C45858',
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.05em',
        }}
      >
        <AlertCircleIcon size={10} /> FAIL
      </span>
    )
  }

  // Render severity badge helper
  const renderSeverityBadge = (severity: 'critical' | 'warning' | 'info') => {
    const colors = {
      critical: { bg: 'rgba(196, 88, 88, 0.12)', text: '#C45858', border: 'rgba(196, 88, 88, 0.25)' },
      warning: { bg: 'rgba(196, 129, 58, 0.12)', text: '#C4813A', border: 'rgba(196, 129, 58, 0.25)' },
      info: { bg: 'rgba(107, 101, 96, 0.12)', text: '#8C857B', border: 'rgba(107, 101, 96, 0.25)' },
    }[severity] || { bg: '#181715', text: '#6B6560', border: '#252320' }

    return (
      <span
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          fontFamily: 'DM Mono, monospace',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {severity}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid #252320',
              borderTopColor: '#C4813A',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>
            Loading BrandGuard governance engine...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#1A1917',
            border: '1px solid #5BA373',
            borderRadius: 8,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#EDE8DF',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <CheckIcon size={14} style={{ color: '#5BA373' }} />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={S.label}>GOVERNANCE & COMPLIANCE</span>
            <span style={{ color: '#3A3830' }}>•</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.08em' }}>
              MILESTONE 3B
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 32,
              fontWeight: 300,
              color: '#EDE8DF',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            BrandGuard
          </h1>
          <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
            AI-powered brand consistency, voice alignment, and deterministic ClaimGuard verification.
          </p>
        </div>

        {/* Action Header Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('content-studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              background: '#181715',
              border: '1px solid #252320',
              borderRadius: 6,
              color: '#C4B89A',
              fontSize: 12,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowRightIcon size={12} style={{ transform: 'rotate(180deg)' }} /> Content Studio
          </button>

          {selectedContent && (
            <button
              onClick={handleRunAudit}
              disabled={auditing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                background: auditing ? '#1E1D1B' : '#C4813A',
                border: auditing ? '1px solid #3A3830' : 'none',
                borderRadius: 6,
                color: auditing ? '#8C857B' : '#0A0908',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                cursor: auditing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {auditing ? (
                <>
                  <div
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      border: '2px solid #8C857B',
                      borderTopColor: 'transparent',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                  Auditing...
                </>
              ) : audit ? (
                <>
                  <RefreshIcon size={13} /> Re-run Audit
                </>
              ) : (
                <>
                  <ShieldIcon size={14} /> Run BrandGuard Audit
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(196, 88, 88, 0.1)',
            border: '1px solid rgba(196, 88, 88, 0.3)',
            borderRadius: 6,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#EDE8DF',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircleIcon size={16} style={{ color: '#C45858' }} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleRunAudit}
            style={{
              background: '#C45858',
              border: 'none',
              borderRadius: 4,
              color: '#0A0908',
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Campaign & Strategy Context Bar */}
      <div
        style={{
          ...S.card,
          padding: '14px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ ...S.label, marginRight: 6 }}>CAMPAIGN:</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>
              {campaign?.name || 'Active Campaign'}
            </span>
          </div>
          <span style={{ color: '#252320' }}>|</span>
          <div>
            <span style={{ ...S.label, marginRight: 6 }}>STRATEGY:</span>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: activeStrategy?.color || '#C4813A',
                fontWeight: 500,
              }}
            >
              {activeStrategy?.label || 'Selected Strategy'}
            </span>
          </div>
        </div>

        {selectedContent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>AUDITING:</span>
            <span
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#181715',
                border: '1px solid #252320',
                color: '#EDE8DF',
                textTransform: 'uppercase',
              }}
            >
              {selectedContent.platform.replace('_', ' ')} · {selectedContent.content_type}
            </span>
          </div>
        )}
      </div>

      {/* Asset Switcher Tabs */}
      {contents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>SELECT GENERATED ASSET TO AUDIT</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {contents.map(item => {
              const meta = platformMetas.find(p => p.id === item.platform) || {
                id: item.platform,
                label: item.platform,
                color: '#C4813A',
              }
              const isSelected = selectedContent?.id === item.id
              const itemAudit = allAudits[item.id]

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectContent(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    borderRadius: 6,
                    background: isSelected ? '#1A1917' : '#111110',
                    border: `1px solid ${isSelected ? meta.color : '#252320'}`,
                    color: isSelected ? '#EDE8DF' : '#8C857B',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: isSelected ? 500 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: itemAudit
                        ? itemAudit.overall_status === 'pass'
                          ? '#5BA373'
                          : itemAudit.overall_status === 'warning'
                          ? '#C4813A'
                          : '#C45858'
                        : '#3A3830',
                    }}
                  />
                  <span>{meta.label}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                    ({item.content_type})
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!selectedContent ? (
        /* Empty State: No Content Generated */
        <div style={{ ...S.card, padding: 64, textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#181715',
              border: '1px solid #252320',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#6B6560',
            }}
          >
            <ShieldIcon size={20} />
          </div>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            No Content Selected
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B6560', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Select or generate platform content in Content Studio to run automated BrandGuard voice and ClaimGuard verification audits.
          </p>
          <button
            onClick={() => navigate('content-studio')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 22px',
              background: '#C4813A',
              color: '#0A0908',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Go to Content Studio <ArrowRightIcon size={14} />
          </button>
        </div>
      ) : auditing ? (
        /* Loading Audit State */
        <div style={{ ...S.card, padding: 64, textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(196,129,58,0.1)',
              border: '1px solid rgba(196,129,58,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#C4813A',
            }}
          >
            <ShieldIcon size={24} />
          </div>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            Running BrandGuard Audit
          </h2>
          <p
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 12,
              color: '#C4813A',
              letterSpacing: '0.05em',
              margin: '0 0 24px',
              minHeight: 18,
            }}
          >
            {auditLoadingStages[auditStageIdx]}
          </p>
          <div
            style={{
              width: 240,
              height: 3,
              background: '#1C1B19',
              borderRadius: 2,
              margin: '0 auto',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '60%',
                height: '100%',
                background: 'linear-gradient(90deg, #8A521E, #C4813A)',
                borderRadius: 2,
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      ) : !audit ? (
        /* Empty Audit State: Content exists but not yet audited */
        <div style={{ ...S.card, padding: 56, textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#181715',
              border: '1px solid #252320',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#C4813A',
            }}
          >
            <ShieldIcon size={20} />
          </div>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            Ready to Audit {selectedContent.platform.replace('_', ' ').toUpperCase()} Content
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Run BrandGuard to verify brand voice alignment, messaging pillars, and check for absolute or unverified claims with ClaimGuard.
          </p>
          <button
            onClick={handleRunAudit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 24px',
              background: '#C4813A',
              color: '#0A0908',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <SparkleIcon size={14} /> Run BrandGuard Audit
          </button>
        </div>
      ) : (
        /* Real Audit Results Display */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Overall Audit Status Banner */}
          <div
            style={{
              padding: '24px 28px',
              borderRadius: 8,
              background:
                audit.overall_status === 'pass'
                  ? 'rgba(91, 163, 115, 0.08)'
                  : audit.overall_status === 'warning'
                  ? 'rgba(196, 129, 58, 0.08)'
                  : 'rgba(196, 88, 88, 0.08)',
              border: `1px solid ${
                audit.overall_status === 'pass'
                  ? 'rgba(91, 163, 115, 0.28)'
                  : audit.overall_status === 'warning'
                  ? 'rgba(196, 129, 58, 0.28)'
                  : 'rgba(196, 88, 88, 0.28)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background:
                    audit.overall_status === 'pass'
                      ? 'rgba(91, 163, 115, 0.15)'
                      : audit.overall_status === 'warning'
                      ? 'rgba(196, 129, 58, 0.15)'
                      : 'rgba(196, 88, 88, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color:
                    audit.overall_status === 'pass'
                      ? '#5BA373'
                      : audit.overall_status === 'warning'
                      ? '#C4813A'
                      : '#C45858',
                  flexShrink: 0,
                }}
              >
                {audit.overall_status === 'pass' ? (
                  <CheckCircleIcon size={24} />
                ) : audit.overall_status === 'warning' ? (
                  <AlertTriangleIcon size={24} />
                ) : (
                  <AlertCircleIcon size={24} />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: 'Fraunces, Georgia, serif',
                      fontSize: 20,
                      fontWeight: 400,
                      color: '#EDE8DF',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {audit.overall_status === 'pass'
                      ? 'PASS · Brand Aligned'
                      : audit.overall_status === 'warning'
                      ? 'WARNING · Needs Review'
                      : 'FAIL · Critical Issues Found'}
                  </span>
                  {renderStatusBadge(audit.overall_status as 'pass' | 'warning' | 'fail')}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B' }}>
                  {audit.overall_status === 'pass'
                    ? 'All claims substantiated · Voice & guidelines compliant'
                    : audit.overall_status === 'warning'
                    ? 'Unverified superlatives, metrics, or minor guideline deviations detected'
                    : 'Unsupported marketing claims or brand rule violations must be resolved'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={S.label}>TOTAL FINDINGS</div>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF' }}>
                  {audit.findings.length}
                </div>
              </div>
            </div>
          </div>

          {/* AI Audit Summary */}
          {audit.summary && (
            <div style={{ ...S.card, padding: '22px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <SparkleIcon size={12} style={{ color: '#C4813A' }} />
                <span style={{ ...S.label, color: '#C4813A' }}>AI AUDIT SUMMARY</span>
              </div>
              <p
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 16,
                  fontStyle: 'italic',
                  color: '#EDE8DF',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                "{audit.summary}"
              </p>
            </div>
          )}

          {/* Audited Content Preview */}
          <div style={{ ...S.card, overflow: 'hidden' }}>
            <div
              onClick={() => setPreviewOpen(!previewOpen)}
              style={{
                padding: '16px 24px',
                background: '#141312',
                borderBottom: previewOpen ? '1px solid #252320' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={S.label}>AUDITED CONTENT ASSET</span>
                <span style={{ color: '#3A3830' }}>•</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>
                  {selectedContent.title || `${selectedContent.platform.toUpperCase()} Post`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B6560', fontSize: 12 }}>
                <span>{previewOpen ? 'Hide Preview' : 'Show Preview'}</span>
                {previewOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
              </div>
            </div>

            {previewOpen && (
              <div style={{ padding: '24px 28px' }}>
                {selectedContent.visual_concept && (
                  <div style={{ padding: '12px 16px', background: 'rgba(196,129,58,0.06)', border: '1px solid rgba(196,129,58,0.2)', borderRadius: 6, marginBottom: 16 }}>
                    <div style={{ ...S.label, color: '#C4813A', marginBottom: 4 }}>VISUAL DIRECTION</div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A', margin: 0 }}>
                      {selectedContent.visual_concept}
                    </p>
                  </div>
                )}

                {selectedContent.hook && (
                  <div style={{ padding: '12px 16px', background: '#181715', borderLeft: '3px solid #C4813A', borderRadius: '0 6px 6px 0', marginBottom: 16 }}>
                    <div style={{ ...S.label, color: '#C4813A', marginBottom: 4 }}>HOOK</div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', margin: 0, fontWeight: 500 }}>
                      {selectedContent.hook}
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...S.label, marginBottom: 6 }}>CONTENT BODY</div>
                  <div
                    style={{
                      padding: '16px',
                      background: '#0D0C0B',
                      border: '1px solid #1C1B19',
                      borderRadius: 6,
                      fontFamily: selectedContent.platform === 'youtube_shorts' ? 'DM Mono, monospace' : 'Inter, sans-serif',
                      fontSize: selectedContent.platform === 'youtube_shorts' ? 12 : 13,
                      color: '#EDE8DF',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedContent.body}
                  </div>
                </div>

                {selectedContent.call_to_action && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#141312', border: '1px solid #252320', borderRadius: 6 }}>
                    <span style={{ ...S.label, color: '#8C857B' }}>CTA:</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A' }}>
                      {selectedContent.call_to_action}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BrandGuard Checks */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <ShieldIcon size={14} style={{ color: '#5B9BC4' }} />
                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: 0, fontWeight: 400 }}>
                    BrandGuard Consistency Checks
                  </h3>
                </div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: 0 }}>
                  Verification of brand voice, messaging pillars, positioning, and creative do/don't guidelines.
                </p>
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>
                {brandguardFindings.length} checks
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {brandguardFindings.map(finding => {
                const isExpanded = !!expandedFindings[finding.id]

                return (
                  <div
                    key={finding.id}
                    style={{
                      ...S.card,
                      border: `1px solid ${
                        finding.status === 'fail'
                          ? 'rgba(196, 88, 88, 0.35)'
                          : finding.status === 'warning'
                          ? 'rgba(196, 129, 58, 0.35)'
                          : '#252320'
                      }`,
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div
                      onClick={() => toggleFinding(finding.id)}
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isExpanded ? '#141312' : '#111110',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {renderStatusBadge(finding.status)}
                        {renderSeverityBadge(finding.severity)}
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5B9BC4', textTransform: 'uppercase' }}>
                          [{finding.category.replace('_', ' ')}]
                        </span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#EDE8DF', fontWeight: 500 }}>
                          {finding.title}
                        </span>
                      </div>
                      <div style={{ color: '#6B6560', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '18px 20px', borderTop: '1px solid #1C1B19', background: '#0D0C0B' }}>
                        {finding.evidence && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ ...S.label, marginBottom: 4, color: '#8C857B' }}>EVIDENCE</div>
                            <div
                              style={{
                                padding: '10px 14px',
                                background: '#141312',
                                borderLeft: '2px solid #5B9BC4',
                                borderRadius: '0 4px 4px 0',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 12,
                                color: '#C4B89A',
                                lineHeight: 1.5,
                              }}
                            >
                              {finding.evidence}
                            </div>
                          </div>
                        )}

                        <div style={{ marginBottom: finding.suggestion ? 14 : 0 }}>
                          <div style={{ ...S.label, marginBottom: 4, color: '#8C857B' }}>EXPLANATION</div>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', margin: 0, lineHeight: 1.6 }}>
                            {finding.explanation}
                          </p>
                        </div>

                        {finding.suggestion && (
                          <div style={{ padding: '12px 14px', background: 'rgba(91, 163, 115, 0.08)', border: '1px solid rgba(91, 163, 115, 0.2)', borderRadius: 6 }}>
                            <div style={{ ...S.label, color: '#5BA373', marginBottom: 4 }}>RECOMMENDED FIX</div>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', margin: 0, lineHeight: 1.5 }}>
                              {finding.suggestion}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ClaimGuard Checks */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <ShieldIcon size={14} style={{ color: '#C4813A' }} />
                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: 0, fontWeight: 400 }}>
                    ClaimGuard Policy Verification
                  </h3>
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(196,129,58,0.15)',
                      color: '#C4813A',
                      letterSpacing: '0.05em',
                    }}
                  >
                    ZERO-HALLUCINATION POLICY
                  </span>
                </div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: 0 }}>
                  Deterministic verification ensuring all marketing claims, metrics, and superlatives have evidence in Brand DNA and Product Knowledge.
                </p>
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>
                {claimguardFindings.length} checks
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {claimguardFindings.map(finding => {
                const isExpanded = !!expandedFindings[finding.id]

                return (
                  <div
                    key={finding.id}
                    style={{
                      ...S.card,
                      border: `1px solid ${
                        finding.status === 'fail'
                          ? 'rgba(196, 88, 88, 0.45)'
                          : finding.status === 'warning'
                          ? 'rgba(196, 129, 58, 0.45)'
                          : '#252320'
                      }`,
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div
                      onClick={() => toggleFinding(finding.id)}
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isExpanded ? '#141312' : '#111110',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {renderStatusBadge(finding.status)}
                        {renderSeverityBadge(finding.severity)}
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', textTransform: 'uppercase' }}>
                          [{finding.category.replace('_', ' ')}]
                        </span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#EDE8DF', fontWeight: 500 }}>
                          {finding.title}
                        </span>
                      </div>
                      <div style={{ color: '#6B6560', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '18px 20px', borderTop: '1px solid #1C1B19', background: '#0D0C0B' }}>
                        {finding.evidence && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ ...S.label, marginBottom: 4, color: '#8C857B' }}>CLAIM DETECTED</div>
                            <div
                              style={{
                                padding: '10px 14px',
                                background: '#141312',
                                borderLeft: `2px solid ${finding.status === 'fail' ? '#C45858' : '#C4813A'}`,
                                borderRadius: '0 4px 4px 0',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 12,
                                color: '#EDE8DF',
                                lineHeight: 1.5,
                              }}
                            >
                              {finding.evidence}
                            </div>
                          </div>
                        )}

                        <div style={{ marginBottom: finding.suggestion ? 14 : 0 }}>
                          <div style={{ ...S.label, marginBottom: 4, color: '#8C857B' }}>EXPLANATION</div>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', margin: 0, lineHeight: 1.6 }}>
                            {finding.explanation}
                          </p>
                        </div>

                        {finding.suggestion && (
                          <div style={{ padding: '12px 14px', background: 'rgba(196,129,58,0.08)', border: '1px solid rgba(196,129,58,0.2)', borderRadius: 6 }}>
                            <div style={{ ...S.label, color: '#C4813A', marginBottom: 4 }}>SUGGESTED ACTION</div>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', margin: 0, lineHeight: 1.5 }}>
                              {finding.suggestion}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action Footer Bar */}
          <div
            style={{
              ...S.card,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Fix Automatically: Disabled with tooltip tag */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  disabled
                  title="Coming in content revision milestone (3C)"
                  style={{
                    padding: '9px 16px',
                    background: '#141312',
                    border: '1px solid #252320',
                    borderRadius: 6,
                    color: '#4A4640',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <SparkleIcon size={13} /> Fix Automatically
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 9,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: '#1C1B19',
                      color: '#6B6560',
                    }}
                  >
                    Milestone 3C
                  </span>
                </button>
              </div>

              {/* Review Manually: Navigates to Human Approval */}
              <button
                onClick={() => {
                  if (selectedContent) {
                    if (onContentSelected) {
                      onContentSelected(selectedContent.id)
                    } else if (typeof window !== 'undefined') {
                      localStorage.setItem('brandforge_active_content_id', selectedContent.id)
                    }
                  }
                  navigate('human-approval')
                }}
                style={{
                  padding: '9px 16px',
                  background: '#181715',
                  border: '1px solid #252320',
                  borderRadius: 6,
                  color: '#C4B89A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Review Manually →
              </button>

            </div>

            <div>
              <button
                onClick={handleRunAudit}
                disabled={auditing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: '#C4813A',
                  border: 'none',
                  borderRadius: 6,
                  color: '#0A0908',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: auditing ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshIcon size={13} /> Re-run Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
