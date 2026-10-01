import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { ArrowRightIcon, CheckIcon, SparkleIcon } from '../components/Icons'
import { api } from '../services/api'
import type { StrategyDirection, CampaignData, CampaignInsight } from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  activeCampaignId?: string | null
  activeStrategyId?: string | null
  onStrategySelected?: (strategyId: string) => void
}

const S = {
  page: { padding: '48px 48px', maxWidth: 1100, margin: '0 auto' } as React.CSSProperties,
  label: { fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#3A3830' },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
}

const fallbackDirections: StrategyDirection[] = [
  {
    id: '',
    campaign_id: '',
    strategy_type: 'product',
    label: 'Product-Led',
    tagline: 'Let the work speak first.',
    desc: "Lead with Arkiva Pro's most powerful features through high-quality demos and before/after moments. Show real workflows, real results, real time saved.",
    pillars: ['Feature spotlight', 'Workflow demos', 'Before & after'],
    tone: 'Direct, confident, technical depth without jargon',
    best: ['LinkedIn', 'YouTube Shorts'],
    color: '#5B9BC4',
    recommended: false,
    timeline: [
      { week: 'Week 1', phase: 'Teaser', desc: '3 mystery/anticipation posts across Instagram + LinkedIn', pieces: 3 },
      { week: 'Week 2', phase: 'Launch', desc: 'Full campaign reveal with hero content and story-driven post', pieces: 6 },
      { week: 'Week 3', phase: 'Feature', desc: 'Deep-dive content: demos, creator story, LinkedIn article', pieces: 8 },
      { week: 'Week 4', phase: 'Social Proof', desc: 'Testimonials, UGC, results showcases', pieces: 5 },
      { week: 'Week 5', phase: 'CTA Push', desc: 'Conversion-focused content with clear offers', pieces: 6 },
      { week: 'Week 6', phase: 'Follow-up', desc: 'Retargeting content, recap, community thanks', pieces: 4 },
    ],
    total_pieces: 32,
    is_selected: false,
    audience_tags: ['TIME-CONSCIOUS', 'CRAFT-FOCUSED', 'TOOL-FATIGUED', 'COMMUNITY-ORIENTED'],
  },
  {
    id: '',
    campaign_id: '',
    strategy_type: 'story',
    label: 'Story-Led',
    tagline: 'Every brand has a creative origin.',
    desc: 'Position Arkiva through the lens of the creators who use it. Authentic testimonials, creative journeys, and the human side of design excellence.',
    pillars: ['Creator journeys', 'Behind the work', 'Community stories'],
    tone: 'Warm, narrative, emotionally resonant, inspirational',
    best: ['Instagram', 'YouTube'],
    color: '#C4813A',
    recommended: true,
    timeline: [
      { week: 'Week 1', phase: 'Teaser', desc: '3 mystery/anticipation posts across Instagram + LinkedIn', pieces: 3 },
      { week: 'Week 2', phase: 'Launch', desc: 'Full campaign reveal with hero content and story-driven post', pieces: 6 },
      { week: 'Week 3', phase: 'Feature', desc: 'Deep-dive content: demos, creator story, LinkedIn article', pieces: 8 },
      { week: 'Week 4', phase: 'Social Proof', desc: 'Testimonials, UGC, results showcases', pieces: 5 },
      { week: 'Week 5', phase: 'CTA Push', desc: 'Conversion-focused content with clear offers', pieces: 6 },
      { week: 'Week 6', phase: 'Follow-up', desc: 'Retargeting content, recap, community thanks', pieces: 4 },
    ],
    total_pieces: 32,
    is_selected: true,
    audience_tags: ['TIME-CONSCIOUS', 'CRAFT-FOCUSED', 'TOOL-FATIGUED', 'COMMUNITY-ORIENTED'],
  },
  {
    id: '',
    campaign_id: '',
    strategy_type: 'community',
    label: 'Community-Led',
    tagline: 'Great design is made together.',
    desc: 'Activate the Arkiva community through challenges, collaborative showcases, and peer-to-peer inspiration. High shareability and organic growth.',
    pillars: ['Design challenges', 'Community showcases', 'Creator spotlights'],
    tone: 'Energetic, inclusive, celebratory, participatory',
    best: ['X', 'Instagram', 'TikTok'],
    color: '#5BA373',
    recommended: false,
    timeline: [
      { week: 'Week 1', phase: 'Teaser', desc: '3 mystery/anticipation posts across Instagram + LinkedIn', pieces: 3 },
      { week: 'Week 2', phase: 'Launch', desc: 'Full campaign reveal with hero content and story-driven post', pieces: 6 },
      { week: 'Week 3', phase: 'Feature', desc: 'Deep-dive content: demos, creator story, LinkedIn article', pieces: 8 },
      { week: 'Week 4', phase: 'Social Proof', desc: 'Testimonials, UGC, results showcases', pieces: 5 },
      { week: 'Week 5', phase: 'CTA Push', desc: 'Conversion-focused content with clear offers', pieces: 6 },
      { week: 'Week 6', phase: 'Follow-up', desc: 'Retargeting content, recap, community thanks', pieces: 4 },
    ],
    total_pieces: 32,
    is_selected: false,
    audience_tags: ['TIME-CONSCIOUS', 'CRAFT-FOCUSED', 'TOOL-FATIGUED', 'COMMUNITY-ORIENTED'],
  },
]

export default function CampaignStrategy({
  navigate,
  activeCampaignId,
  activeStrategyId,
  onStrategySelected,
}: Props) {
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [strategies, setStrategies] = useState<StrategyDirection[]>(fallbackDirections)
  const [strategyInsights, setStrategyInsights] = useState<CampaignInsight[]>([])
  const [selectedDirection, setSelectedDirection] = useState('story')
  const [loading, setLoading] = useState(false)

  const effectiveCampaignId =
    activeCampaignId ||
    (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_campaign_id') : null)

  useEffect(() => {
    async function loadCampaignData() {
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
          // ignore
        }
      }

      if (!campId) return

      setLoading(true)
      try {
        const [campaignData, strategyList, memoryRes] = await Promise.all([
          api.getCampaign(campId),
          api.getStrategies(campId),
          api.getCampaignMemory().catch(() => null),
        ])
        setCampaign(campaignData)
        if (memoryRes?.insights) {
          setStrategyInsights(memoryRes.insights.filter(i => i.category === 'strategy' || i.category === 'platform'))
        }

        let loadedStrategies = strategyList || []
        // If the campaign has no strategies generated yet, trigger generation to persist real UUID strategy records
        if (loadedStrategies.length === 0) {
          try {
            loadedStrategies = await api.generateStrategies(campId)
          } catch (genErr) {
            console.warn('Failed to auto-generate strategies on load:', genErr)
          }
        }

        if (loadedStrategies && loadedStrategies.length > 0) {
          setStrategies(loadedStrategies)

          const targetStratId =
            activeStrategyId ||
            (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_strategy_id') : null)

          const matchedStrat =
            (targetStratId
              ? loadedStrategies.find(s => s.id === targetStratId || s.strategy_type === targetStratId)
              : undefined) ||
            loadedStrategies.find(s => s.is_selected) ||
            loadedStrategies.find(s => s.recommended) ||
            loadedStrategies[0]

          if (matchedStrat) {
            setSelectedDirection(matchedStrat.strategy_type)
            if (onStrategySelected) {
              onStrategySelected(matchedStrat.id)
            } else if (typeof window !== 'undefined') {
              localStorage.setItem('brandforge_active_strategy_id', matchedStrat.id)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load campaign strategies from backend:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCampaignData()
  }, [effectiveCampaignId, activeStrategyId])

  const activeStrategy = strategies.find(s => s.strategy_type === selectedDirection) || strategies[0]
  const currentTimeline = activeStrategy?.timeline?.length > 0 ? activeStrategy.timeline : fallbackDirections[1].timeline

  const campaignTitle = campaign?.name || 'Summer Refresh 2024'
  const objectiveValue = campaign?.objective || 'Brand Awareness'
  const durationValue = campaign?.duration || '6 Weeks'
  const platformsValue = campaign?.platforms?.length ? campaign.platforms.join(', ') : 'Instagram, YouTube, LinkedIn, X'
  const contentPiecesValue = `${activeStrategy?.total_pieces || 32} total`

  const coreMessageText = activeStrategy?.core_message ||
    campaign?.message ||
    '"Arkiva transforms how creative professionals work — giving them more time to do what matters: create."'

  const audienceInsightText = activeStrategy?.audience_insight ||
    campaign?.audience ||
    'Your core audience spends 40% of their workday on repetitive design tasks. They want tools that elevate their craft, not tools they have to fight.'

  const audienceTags = activeStrategy?.audience_tags?.length
    ? activeStrategy.audience_tags
    : ['TIME-CONSCIOUS', 'CRAFT-FOCUSED', 'TOOL-FATIGUED', 'COMMUNITY-ORIENTED']

  const handleSelectDirection = async (directionOrId: string) => {
    let targetStrat = strategies.find(
      s => s.strategy_type === directionOrId || s.id === directionOrId,
    )
    const campId = effectiveCampaignId || campaign?.id

    // If strategies are not yet persisted in backend (e.g. mock fallback objects with empty ids),
    // trigger strategy generation on backend first to get real persisted database UUIDs.
    if (campId && (!targetStrat || !targetStrat.id || !targetStrat.campaign_id)) {
      try {
        const generated = await api.generateStrategies(campId)
        if (generated && generated.length > 0) {
          setStrategies(generated)
          targetStrat =
            generated.find(s => s.strategy_type === directionOrId || s.id === directionOrId) ||
            generated[0]
        }
      } catch (genErr) {
        console.warn('Failed to ensure generated strategies on selection:', genErr)
      }
    }

    if (targetStrat) {
      setSelectedDirection(targetStrat.strategy_type)
      if (targetStrat.id) {
        if (onStrategySelected) {
          onStrategySelected(targetStrat.id)
        } else if (typeof window !== 'undefined') {
          localStorage.setItem('brandforge_active_strategy_id', targetStrat.id)
        }
        if (campId) {
          try {
            await api.selectStrategy(campId, targetStrat.id)
          } catch (err) {
            console.error('Failed to update strategy selection on backend:', err)
          }
        }
      }
    }
  }

  const handleProceedToStudio = async () => {
    let targetStrat =
      strategies.find(s => s.strategy_type === selectedDirection) ||
      strategies.find(s => s.id === selectedDirection) ||
      strategies[0]

    const campId = effectiveCampaignId || campaign?.id

    // Ensure strategies are generated and persisted in backend with real database UUIDs
    if (campId && (!targetStrat || !targetStrat.id || !targetStrat.campaign_id)) {
      try {
        const generated = await api.generateStrategies(campId)
        if (generated && generated.length > 0) {
          setStrategies(generated)
          targetStrat =
            generated.find(s => s.strategy_type === selectedDirection) ||
            generated.find(s => s.recommended) ||
            generated[0]
        }
      } catch (genErr) {
        console.warn('Failed to ensure generated strategies on proceed:', genErr)
      }
    }

    if (targetStrat?.id) {
      if (onStrategySelected) {
        onStrategySelected(targetStrat.id)
      } else if (typeof window !== 'undefined') {
        localStorage.setItem('brandforge_active_strategy_id', targetStrat.id)
      }
      if (campId) {
        try {
          await api.selectStrategy(campId, targetStrat.id)
        } catch (err) {
          console.warn('Failed to sync strategy selection to backend:', err)
        }
      }
    }
    navigate('content-studio')
  }


  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={S.label}>{campaignTitle} · Strategy</div>
        <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em' }}>
          Campaign Strategy
        </h1>
        <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>
          {loading
            ? 'Loading AI-generated strategies from backend...'
            : 'AI-generated based on your Brand DNA and campaign brief. Select a strategic direction to proceed.'}
        </p>
      </div>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 40 }}>
        {[
          { label: 'Objective', value: objectiveValue },
          { label: 'Duration', value: durationValue },
          { label: 'Platforms', value: platformsValue },
          { label: 'Content Pieces', value: contentPiecesValue },
        ].map(item => (
          <div key={item.label} style={{ ...S.card, padding: 18 }}>
            <div style={{ ...S.label, marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 15, color: '#EDE8DF', fontWeight: 400 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Core Message + Audience */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
        <div style={{ ...S.card, padding: 24 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Core Message</div>
          <p style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 300, color: '#EDE8DF', margin: 0, lineHeight: 1.5, letterSpacing: '-0.01em' }}>
            {coreMessageText}
          </p>
        </div>
        <div style={{ ...S.card, padding: 24 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Audience Insight</div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#C4B89A', margin: '0 0 16px', lineHeight: 1.6 }}>
            {audienceInsightText}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {audienceTags.map(t => (
              <span key={t} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '3px 8px', background: '#1E1D1B', border: '1px solid #252320', borderRadius: 4, color: '#6B6560' }}>
                {t.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Strategic Directions */}
      <div style={{ marginBottom: 40 }}>
        {/* Campaign Memory Intelligence Banner */}
        {strategyInsights.length > 0 && (
          <div
            style={{
              padding: '14px 18px',
              background: 'rgba(196,129,58,0.06)',
              border: '1px solid rgba(196,129,58,0.25)',
              borderRadius: 8,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SparkleIcon size={15} style={{ color: '#C4813A' }} />
              <div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.08em', marginRight: 8 }}>
                  CAMPAIGN MEMORY SIGNAL:
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#EDE8DF' }}>
                  {strategyInsights[0].title} — {strategyInsights[0].recommendation}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('campaign-memory')}
              style={{
                background: 'none',
                border: 'none',
                color: '#C4813A',
                fontSize: 11,
                fontFamily: 'DM Mono, monospace',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                padding: '4px 8px',
              }}
            >
              Explore Memory →
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontWeight: 400, color: '#EDE8DF', margin: 0, letterSpacing: '-0.02em' }}>Select Strategic Direction</h2>
          <SparkleIcon size={14} style={{ color: '#C4813A' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {strategies.map(d => {
            const selected = selectedDirection === d.strategy_type
            return (
              <div
                key={d.strategy_type}
                onClick={() => handleSelectDirection(d.strategy_type)}
                style={{
                  ...S.card,
                  padding: 24,
                  cursor: 'pointer',
                  border: `1px solid ${selected ? d.color : '#252320'}`,
                  background: selected
                    ? `rgba(${d.strategy_type === 'story' ? '196,129,58' : d.strategy_type === 'product' ? '91,155,196' : '91,163,115'},0.06)`
                    : '#111110',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {d.recommended && (
                  <div style={{
                    position: 'absolute', top: -10, right: 16,
                    background: '#C4813A', color: '#0A0908',
                    fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.08em',
                    padding: '3px 8px', borderRadius: 4,
                  }}>RECOMMENDED</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: selected ? d.color : '#EDE8DF' }}>{d.label}</span>
                  {selected && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckIcon size={12} style={{ color: '#0A0908' }} />
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', fontStyle: 'italic', marginBottom: 12 }}>"{d.tagline}"</div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A', margin: '0 0 16px', lineHeight: 1.6 }}>{d.desc}</p>
                <div style={{ borderTop: '1px solid #252320', paddingTop: 16 }}>
                  <div style={{ ...S.label, marginBottom: 8 }}>Pillars</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {d.pillars.map(p => (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: d.color }} />
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560' }}>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {d.best.map(p => (
                      <span key={p} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', background: '#1E1D1B', borderRadius: 3, color: '#6B6560' }}>{p.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontWeight: 400, color: '#EDE8DF', margin: '0 0 20px', letterSpacing: '-0.02em' }}>Campaign Timeline</h2>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(currentTimeline.length, 6)}, 1fr)`, gap: 8 }}>
          {currentTimeline.map((t, i) => (
            <div key={i} style={{ ...S.card, padding: 16 }}>
              <div style={{ ...S.label, marginBottom: 6 }}>{t.week}</div>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 14, color: activeStrategy?.color || '#C4813A', marginBottom: 8, fontWeight: 400 }}>{t.phase}</div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B6560', margin: '0 0 10px', lineHeight: 1.5 }}>{t.desc}</p>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3A3830' }}>{t.pieces} pieces</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 28, background: '#111110', border: '1px solid #252320', borderRadius: 8,
      }}>
        <div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '0 0 6px' }}>
            Proceed with <span style={{ color: activeStrategy?.color || '#C4813A' }}>{activeStrategy?.label || 'Story-Led'}</span> direction?
          </h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', margin: 0 }}>
            BrandForge will generate {activeStrategy?.total_pieces || 32} content pieces across {platformsValue} with BrandGuard verification.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          <button
            onClick={() => {
              const types = ['product', 'story', 'community']
              const nextIndex = (types.indexOf(selectedDirection) + 1) % types.length
              handleSelectDirection(types[nextIndex])
            }}
            style={{
              padding: '11px 20px', background: 'transparent', border: '1px solid #252320',
              borderRadius: 6, color: '#C4B89A', fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            }}
          >
            Change Direction
          </button>
          <button
            onClick={handleProceedToStudio}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px',
              background: '#C4813A', color: '#0A0908', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
            }}
          >
            Generate Content <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
