import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  SparkleIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  ShieldIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  CampaignData,
  StrategyDirection,
  CampaignContent,
  ContentSchedule,
  ContentAudit,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  activeCampaignId?: string | null
  activeStrategyId?: string | null
  activeContentId?: string | null
  onStrategySelected?: (strategyId: string) => void
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

interface PlatformConfig {
  id: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
  label: string
  color: string
  typeLabel: string
}

const platformConfigs: PlatformConfig[] = [
  { id: 'instagram', label: 'Instagram', color: '#C4813A', typeLabel: 'Caption & Visual' },
  { id: 'linkedin', label: 'LinkedIn', color: '#5B9BC4', typeLabel: 'Thought Leadership Post' },
  { id: 'x', label: 'X (Twitter)', color: '#EDE8DF', typeLabel: 'Thread / Post' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', color: '#C45858', typeLabel: 'Spoken Script (30-45s)' },
]

export default function ContentStudio({
  navigate,
  activeCampaignId,
  activeStrategyId,
  activeContentId,
  onStrategySelected,
  onContentSelected,
}: Props) {

  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [strategies, setStrategies] = useState<StrategyDirection[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'instagram',
    'linkedin',
    'x',
    'youtube_shorts',
  ])
  const [activePlatformTab, setActivePlatformTab] = useState<'instagram' | 'linkedin' | 'x' | 'youtube_shorts'>('instagram')
  const [contents, setContents] = useState<CampaignContent[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeSchedule, setActiveSchedule] = useState<ContentSchedule | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedDate, setSchedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [schedTime, setSchedTime] = useState('19:00')
  const [schedTz, setSchedTz] = useState('Asia/Kolkata')
  const [scheduling, setScheduling] = useState(false)

  // Resolve active campaign ID
  const effectiveCampaignId =
    activeCampaignId ||
    (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_campaign_id') : null)

  // Active strategy
  const activeStrategy = strategies.find(s => s.id === selectedStrategyId) || strategies[0]

  // Content items strictly belonging to the currently selected strategy
  const strategyContents = contents.filter(c => c.strategy_id === (selectedStrategyId || activeStrategy?.id))

  // Active content for currently selected platform tab within active strategy
  const activeContent = strategyContents.find(c => c.platform === activePlatformTab)

  useEffect(() => {
    async function loadData() {
      let campId = effectiveCampaignId

      // Validate campaign existence or discover latest campaign
      try {
        const allCampaigns = await api.getCampaigns()
        if (allCampaigns && allCampaigns.length > 0) {
          if (!campId || !allCampaigns.some(c => c.id === campId)) {
            campId = allCampaigns[0].id
            if (typeof window !== 'undefined') {
              localStorage.setItem('brandforge_active_campaign_id', campId)
            }
          }
        } else {
          campId = null
          if (typeof window !== 'undefined') {
            localStorage.removeItem('brandforge_active_campaign_id')
          }
        }
      } catch (e) {
        console.warn('Could not validate existing campaigns:', e)
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
        setContents(contentList || [])

        // Resolve active strategy:
        // 1) activeStrategyId passed from parent (App.tsx / CampaignStrategy)
        // 2) Strategy in localStorage
        // 3) Strategy marked as is_selected in backend
        // 4) Recommended strategy
        // 5) First strategy
        let activeStrat: StrategyDirection | undefined
        const targetStratId =
          activeStrategyId ||
          (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_strategy_id') : null)

        if (stratList && stratList.length > 0) {
          activeStrat =
            (targetStratId
              ? stratList.find(s => s.id === targetStratId || s.strategy_type === targetStratId)
              : undefined) ||
            stratList.find(s => s.is_selected) ||
            stratList.find(s => s.recommended) ||
            stratList[0]

          if (activeStrat) {
            setSelectedStrategyId(activeStrat.id)
            if (onStrategySelected) {
              onStrategySelected(activeStrat.id)
            } else if (typeof window !== 'undefined') {
              localStorage.setItem('brandforge_active_strategy_id', activeStrat.id)
            }
          }
        }

        // Set active platform tab to first available generated content if present for active strategy
        if (contentList && contentList.length > 0 && activeStrat) {
          const stratItems = contentList.filter(c => c.strategy_id === activeStrat?.id)
          if (stratItems.length > 0) {
            const firstPlatform = stratItems[0].platform as 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
            if (firstPlatform) {
              setActivePlatformTab(firstPlatform)
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load Content Studio data:', err)
        setErrorMessage(err.message || 'Failed to connect to backend service.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [effectiveCampaignId, activeStrategyId])

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const handleSelectStrategy = async (stratId: string) => {
    setSelectedStrategyId(stratId)
    if (onStrategySelected) {
      onStrategySelected(stratId)
    } else if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_strategy_id', stratId)
    }

    const campId = effectiveCampaignId || campaign?.id
    if (campId && stratId) {
      try {
        await api.selectStrategy(campId, stratId)
      } catch (err) {
        console.warn('Failed to update strategy selection in backend:', err)
      }
    }
  }

  const handleGenerate = async (targetPlatforms?: string[]) => {
    const campId = effectiveCampaignId || campaign?.id
    if (!campId) {
      setErrorMessage('No active campaign selected.')
      return
    }

    const stratId = selectedStrategyId || strategies[0]?.id
    if (!stratId) {
      setErrorMessage('Please select a campaign strategy direction first.')
      return
    }

    const platformsToGenerate = targetPlatforms || selectedPlatforms
    if (platformsToGenerate.length === 0) {
      setErrorMessage('Please select at least one platform to generate content for.')
      return
    }

    setGenerating(true)
    setErrorMessage(null)

    try {
      const generated = await api.generateContent(
        campId,
        stratId,
        platformsToGenerate
      )

      // Merge newly generated items with existing content
      setContents(prev => {
        const newlyGeneratedPlatforms = new Set(generated.map(g => g.platform))
        const preserved = prev.filter(c =>
          c.strategy_id !== stratId || !newlyGeneratedPlatforms.has(c.platform)
        )
        return [...preserved, ...generated]
      })

      // Switch to first generated platform tab
      if (generated.length > 0) {
        setActivePlatformTab(generated[0].platform as any)
      }
    } catch (err: any) {
      console.error('Content generation failed:', err)
      setErrorMessage(err.message || 'Failed to generate content. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Fetch active schedule for the currently selected content asset
  useEffect(() => {
    async function loadSchedule() {
      if (!activeContent) {
        setActiveSchedule(null)
        return
      }
      try {
        const sched = await api.getContentSchedule(activeContent.id)
        setActiveSchedule(Array.isArray(sched) ? sched[0] || null : sched)
      } catch (err) {
        setActiveSchedule(null)
      }
    }
    loadSchedule()
  }, [activeContent?.id])

  const handleScheduleSubmit = async () => {
    if (!activeContent) return
    setScheduling(true)
    setErrorMessage(null)
    try {
      const combinedDateTime = new Date(`${schedDate}T${schedTime || '19:00'}:00`).toISOString()
      const sched = await api.scheduleContent(activeContent.id, {
        platform: activeContent.platform,
        scheduled_at: combinedDateTime,
        timezone: schedTz,
      })
      setActiveSchedule(sched)
      setShowScheduleModal(false)
    } catch (err: any) {
      console.error('Failed to schedule content:', err)
      setErrorMessage(err.message || 'Failed to schedule content. Ensure it has passed BrandGuard audit and is approved.')
    } finally {
      setScheduling(false)
    }
  }

  // Empty state: No Campaign
  if (!loading && !effectiveCampaignId) {
    return (
      <div style={S.page}>
        <div style={{ marginBottom: 40 }}>
          <div style={S.label}>Studio & Governance</div>
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em' }}>
            Content Studio
          </h1>
          <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>
            Generate platform-native content with BrandGuard verification.
          </p>
        </div>

        <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(196,129,58,0.1)', border: '1px solid rgba(196,129,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#C4813A' }}>
            <SparkleIcon size={20} />
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            No Active Campaign Selected
          </h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Select or create a campaign to begin generating platform-native content.
          </p>
          <button
            onClick={() => navigate('create-campaign')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
              background: '#C4813A', color: '#0A0908', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
            }}
          >
            Create New Campaign <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>
    )
  }

  // Empty state: No Strategies
  if (!loading && strategies.length === 0) {
    return (
      <div style={S.page}>
        <div style={{ marginBottom: 40 }}>
          <div style={S.label}>{campaign?.name || 'Campaign'} · Content Studio</div>
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em' }}>
            Content Studio
          </h1>
          <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>
            Generate platform-native content with BrandGuard verification.
          </p>
        </div>

        <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            No Strategies Generated Yet
          </h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Generate a campaign strategy before creating content.
          </p>
          <button
            onClick={() => navigate('campaign-strategy')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
              background: '#C4813A', color: '#0A0908', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
            }}
          >
            View Campaign Strategy <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={S.label}>
          {campaign?.name || 'Active Campaign'} · Content Studio
        </div>
        <h1
          className="text-2xl sm:text-3xl lg:text-4xl"
          style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em' }}
        >
          AI Content Studio
        </h1>
        <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>
          Generate platform-native content tailored to your Brand DNA and selected strategic angle.
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{ padding: '14px 18px', background: 'rgba(196,88,88,0.08)', border: '1px solid #C45858', borderRadius: 6, color: '#EDE8DF', fontSize: 13, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#C45858', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Strategy Selector Banner */}
      <div style={{ ...S.card, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.label}>ACTIVE STRATEGIC DIRECTION</span>
            {activeStrategy && (
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${activeStrategy.color}18`, color: activeStrategy.color, border: `1px solid ${activeStrategy.color}40` }}>
                {activeStrategy.label}
              </span>
            )}
          </div>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>
            {strategyContents.length} of {selectedPlatforms.length} platforms generated
          </span>
        </div>

        {/* Strategy Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {strategies.map(s => {
            const isSelected = (selectedStrategyId || activeStrategy?.id) === s.id
            return (
              <button
                key={s.id}
                onClick={() => handleSelectStrategy(s.id)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 6,
                  border: `1px solid ${isSelected ? s.color : '#252320'}`,
                  background: isSelected ? `${s.color}10` : '#141312',
                  color: isSelected ? '#EDE8DF' : '#8C857B',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 14, color: isSelected ? s.color : '#EDE8DF', fontWeight: 400 }}>
                    {s.label}
                  </span>
                  {isSelected && (
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckIcon size={9} style={{ color: '#0A0908' }} />
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B6560', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  "{s.tagline}"
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Platform Controls & Generation Bar */}
      <div style={{ ...S.card, padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ ...S.label, marginBottom: 8 }}>Target Platforms</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {platformConfigs.map(p => {
              const active = selectedPlatforms.includes(p.id)
              const hasGenerated = strategyContents.some(c => c.platform === p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 6,
                    border: `1px solid ${active ? '#C4813A' : '#252320'}`,
                    background: active ? 'rgba(196,129,58,0.1)' : 'transparent',
                    color: active ? '#C4813A' : '#6B6560',
                    fontFamily: 'Inter, sans-serif', fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasGenerated ? '#5BA373' : active ? '#C4813A' : '#3A3830' }} />
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={() => handleGenerate()}
          disabled={generating || loading || selectedPlatforms.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', background: generating ? '#6B5030' : '#C4813A',
            color: '#0A0908', border: 'none', borderRadius: 6,
            cursor: generating || selectedPlatforms.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
            transition: 'background 0.15s ease',
          }}
        >
          {generating ? (
            <>
              <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTop: '2px solid #0A0908', borderRadius: '50%' }} className="animate-spin" />
              Generating Content...
            </>
          ) : (
            <>
              <SparkleIcon size={14} /> Generate Content <ArrowRightIcon size={14} />
            </>
          )}
        </button>
      </div>

      {/* Platform Tabs & Content Preview Area */}
      <div>
        {/* Platform Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: '4px', background: '#0D0C0B', borderRadius: 8, border: '1px solid #1C1B19', overflowX: 'auto' }}>
          {platformConfigs.map(p => {
            const isTabActive = activePlatformTab === p.id
            const hasContent = strategyContents.some(c => c.platform === p.id)
            return (
              <button
                key={p.id}
                onClick={() => setActivePlatformTab(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: isTabActive ? '#1E1D1B' : 'transparent',
                  color: isTabActive ? '#EDE8DF' : '#6B6560',
                  fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: isTabActive ? 500 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
                }}
              >
                <span>{p.label}</span>
                {hasContent ? (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5BA373' }} />
                ) : (
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#3A3830' }}>EMPTY</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content Preview Container */}
        {activeContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Top Info Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C4813A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {activeContent.platform.replace('_', ' ')} · {activeContent.content_type}
                </span>
                <span style={{ color: '#3A3830' }}>•</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560' }}>
                  Generated for {activeStrategy?.label || 'Campaign Strategy'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {activeSchedule && activeSchedule.status === 'scheduled' ? (
                  <button
                    onClick={() => navigate('campaign-calendar')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', background: 'rgba(91,155,196,0.12)', border: '1px solid rgba(91,155,196,0.35)',
                      borderRadius: 6, color: '#5B9BC4', fontSize: 12, fontWeight: 500, fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <ClockIcon size={13} /> Scheduled (View Calendar) →
                  </button>
                ) : activeContent.approval_status === 'approved' ? (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', background: 'rgba(91,163,115,0.12)', border: '1px solid rgba(91,163,115,0.35)',
                      borderRadius: 6, color: '#5BA373', fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <ClockIcon size={13} /> Schedule Content
                  </button>
                ) : null}

                <button
                  onClick={() => navigate('analytics')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: 'rgba(196,129,58,0.12)', border: '1px solid rgba(196,129,58,0.35)',
                    borderRadius: 6, color: '#C4813A', fontSize: 12, fontWeight: 500, fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <SparkleIcon size={12} /> Performance Analytics →
                </button>

                <button
                  onClick={() => {
                    if (activeContent) {
                      if (onContentSelected) {
                        onContentSelected(activeContent.id)
                      } else if (typeof window !== 'undefined') {
                        localStorage.setItem('brandforge_active_content_id', activeContent.id)
                      }
                      navigate('brand-guard')
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: 'rgba(196,129,58,0.12)', border: '1px solid rgba(196,129,58,0.35)',
                    borderRadius: 6, color: '#C4813A', fontSize: 12, fontWeight: 500, fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <ShieldIcon size={13} /> Run BrandGuard
                </button>
                <button
                  onClick={() => {
                    if (activeContent) {
                      if (onContentSelected) {
                        onContentSelected(activeContent.id)
                      } else if (typeof window !== 'undefined') {
                        localStorage.setItem('brandforge_active_content_id', activeContent.id)
                      }
                      navigate('human-approval')
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: '#181715', border: '1px solid #252320',
                    borderRadius: 6, color: '#C4B89A', fontSize: 12, fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <CheckIcon size={12} style={{ color: '#5BA373' }} /> Human Review
                </button>

                <button
                  onClick={() => handleGenerate([activePlatformTab])}
                  disabled={generating}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: '#181715', border: '1px solid #252320',
                    borderRadius: 6, color: '#C4B89A', fontSize: 12, fontFamily: 'Inter, sans-serif',
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshIcon size={12} /> Regenerate {platformConfigs.find(p => p.id === activePlatformTab)?.label}
                </button>
                <button
                  onClick={() => handleCopy(`${activeContent.title || ''}\n\n${activeContent.hook || ''}\n\n${activeContent.body}\n\n${activeContent.call_to_action || ''}`, activeContent.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: copiedKey === activeContent.id ? '#5BA373' : '#181715',
                    border: `1px solid ${copiedKey === activeContent.id ? '#5BA373' : '#252320'}`,
                    borderRadius: 6, color: copiedKey === activeContent.id ? '#0A0908' : '#C4B89A',
                    fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copiedKey === activeContent.id ? (
                    <>
                      <CheckIcon size={12} /> Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <CopyIcon size={12} /> Copy Asset
                    </>
                  )}
                </button>
              </div>
            </div>


            {/* Platform Native Content Card */}
            <div style={{ ...S.card, padding: 28 }}>
              {/* Title / Concept */}
              {activeContent.title && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ ...S.label, marginBottom: 6 }}>Concept / Headline</div>
                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0, lineHeight: 1.3 }}>
                    {activeContent.title}
                  </h3>
                </div>
              )}

              {/* Visual Concept (if available) */}
              {activeContent.visual_concept && (
                <div style={{ padding: '16px 20px', background: 'rgba(196,129,58,0.06)', border: '1px solid rgba(196,129,58,0.2)', borderRadius: 6, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <SparkleIcon size={12} style={{ color: '#C4813A' }} />
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.08em' }}>VISUAL ART DIRECTION & STAGING</span>
                  </div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A', margin: 0, lineHeight: 1.6 }}>
                    {activeContent.visual_concept}
                  </p>
                </div>
              )}

              {/* Opening Hook */}
              {activeContent.hook && (
                <div style={{ padding: '14px 18px', background: '#181715', borderLeft: '3px solid #C4813A', borderRadius: '0 6px 6px 0', marginBottom: 20 }}>
                  <div style={{ ...S.label, marginBottom: 4, color: '#C4813A' }}>OPENING HOOK</div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#EDE8DF', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                    {activeContent.hook}
                  </p>
                </div>
              )}

              {/* Main Content Body (Caption, Post, Thread, Script) */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ ...S.label, marginBottom: 8 }}>
                  {activePlatformTab === 'youtube_shorts' ? 'SPOKEN SCRIPT' : activePlatformTab === 'x' ? 'THREAD CONTENT' : activePlatformTab === 'linkedin' ? 'POST COPY' : 'CAPTION COPY'}
                </div>
                <div
                  style={{
                    padding: '20px',
                    background: '#0D0C0B',
                    border: '1px solid #1C1B19',
                    borderRadius: 6,
                    fontFamily: activePlatformTab === 'youtube_shorts' ? 'DM Mono, monospace' : 'Inter, sans-serif',
                    fontSize: activePlatformTab === 'youtube_shorts' ? 12 : 14,
                    color: '#EDE8DF',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {activeContent.body}
                </div>
              </div>

              {/* Call to Action & Governance Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#141312', border: '1px solid #252320', borderRadius: 6, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  {activeContent.call_to_action ? (
                    <>
                      <span style={{ ...S.label, marginRight: 8 }}>CTA:</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A' }}>
                        {activeContent.call_to_action}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560' }}>
                      Ready for BrandGuard governance check
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => {
                      if (activeContent) {
                        if (onContentSelected) {
                          onContentSelected(activeContent.id)
                        } else if (typeof window !== 'undefined') {
                          localStorage.setItem('brandforge_active_content_id', activeContent.id)
                        }
                        navigate('brand-guard')
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', background: '#1E1D1B', border: '1px solid #3A3830',
                      borderRadius: 5, color: '#EDE8DF', fontFamily: 'Inter, sans-serif', fontSize: 12,
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <ShieldIcon size={12} style={{ color: '#C4813A' }} /> Audit in BrandGuard <ArrowRightIcon size={11} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Empty state for this specific platform tab */
          <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#181715', border: '1px solid #252320', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#6B6560' }}>
              <SparkleIcon size={16} />
            </div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '0 0 6px', fontWeight: 400 }}>
              No {platformConfigs.find(p => p.id === activePlatformTab)?.label} Content Generated Yet
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.5 }}>
              Choose a strategy and platform, then generate content.
            </p>
            <button
              onClick={() => handleGenerate([activePlatformTab])}
              disabled={generating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                background: '#C4813A', color: '#0A0908', border: 'none', borderRadius: 6,
                cursor: generating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}
            >
              <SparkleIcon size={14} /> Generate {platformConfigs.find(p => p.id === activePlatformTab)?.label} Content
            </button>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && activeContent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="w-full max-w-lg p-5 sm:p-8 max-h-[90vh] overflow-y-auto rounded-lg border border-[#252320] bg-[#141312] box-border">
            <div style={{ ...S.label, color: '#C4813A', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClockIcon size={12} style={{ color: '#C4813A' }} />
              SCHEDULE MULTI-CHANNEL PUBLICATION
            </div>

            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
              Schedule {activeContent.platform.replace('_', ' ').toUpperCase()} Content
            </h3>

            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', margin: '0 0 20px', lineHeight: 1.5 }}>
              Choose the target publication date, time, and timezone. Content is validated against BrandGuard compliance and human editorial approval before being queued.
            </p>

            {/* Governance Checklist */}
            <div style={{ padding: '12px 14px', background: '#0D0C0B', border: '1px solid #1C1B19', borderRadius: 6, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5BA373', fontFamily: 'DM Mono, monospace' }}>
                <CheckIcon size={12} /> HUMAN APPROVAL: GRANTED
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5BA373', fontFamily: 'DM Mono, monospace' }}>
                <ShieldCheckIcon size={12} /> BRANDGUARD COMPLIANCE: PASSED
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>PUBLICATION DATE</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0D0C0B',
                    border: '1px solid #252320',
                    borderRadius: 6,
                    color: '#EDE8DF',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>TIME</label>
                  <input
                    type="time"
                    value={schedTime}
                    onChange={e => setSchedTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      background: '#0D0C0B',
                      border: '1px solid #252320',
                      borderRadius: 6,
                      color: '#EDE8DF',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>TIMEZONE</label>
                  <select
                    value={schedTz}
                    onChange={e => setSchedTz(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      background: '#0D0C0B',
                      border: '1px solid #252320',
                      borderRadius: 6,
                      color: '#EDE8DF',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setShowScheduleModal(false)}
                disabled={scheduling}
                style={{
                  padding: '9px 16px',
                  background: '#181715',
                  border: '1px solid #252320',
                  borderRadius: 6,
                  color: '#8C857B',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduling || !schedDate}
                style={{
                  padding: '9px 20px',
                  background: '#C4813A',
                  border: 'none',
                  borderRadius: 6,
                  color: '#0A0908',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: scheduling || !schedDate ? 'not-allowed' : 'pointer',
                }}
              >
                {scheduling ? 'Scheduling...' : 'Confirm & Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
