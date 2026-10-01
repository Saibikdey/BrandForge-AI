import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { SparkleIcon, ArrowRightIcon, ShieldCheckIcon } from '../components/Icons'
import { api } from '../services/api'
import type { Product, CampaignMemoryResponse, CampaignInsight } from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  onCampaignCreated?: (campaignId: string) => void
}

const platforms = ['Instagram', 'YouTube Shorts', 'LinkedIn', 'X', 'TikTok', 'Email']
const objectives = ['Brand Awareness', 'Lead Generation', 'Conversion', 'Retention', 'Product Launch', 'Community Growth']

const S = {
  page: { padding: '48px 48px', maxWidth: 1000, margin: '0 auto' } as React.CSSProperties,
  label: { fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#6B6560', display: 'block', marginBottom: 8 },
  input: {
    width: '100%', padding: '11px 14px',
    background: '#111110', border: '1px solid #252320',
    borderRadius: 6, color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif', fontSize: 13,
    outline: 'none', transition: 'border-color 0.15s ease',
  } as React.CSSProperties,
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
}

export default function CreateCampaign({ navigate, onCampaignCreated }: Props) {
  const [form, setForm] = useState({
    name: '',
    product: 'Arkiva Pro Suite',
    objective: 'Brand Awareness',
    audience: 'Creative professionals aged 28–40, design-tool users',
    duration: '3 weeks',
    message: '',
    instructions: '',
  })
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram', 'LinkedIn', 'YouTube Shorts'])
  const [productsList, setProductsList] = useState<string[]>(['Arkiva Pro Suite', 'Arkiva Templates', 'Arkiva Community'])
  const [memoryData, setMemoryData] = useState<CampaignMemoryResponse | null>(null)
  const [generating, setGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [activeAppliedRec, setActiveAppliedRec] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [products, mem] = await Promise.all([
          api.getProducts().catch(() => []),
          api.getCampaignMemory().catch(() => null),
        ])
        if (products && products.length > 0) {
          setProductsList(products.map((p: Product) => p.name))
          setForm(f => ({ ...f, product: products[0].name }))
        }
        if (mem) {
          setMemoryData(mem)
        }

        // Check for applied continuous optimization recommendation
        if (typeof window !== 'undefined') {
          const savedRec = localStorage.getItem('brandforge_active_recommendation')
          if (savedRec) {
            try {
              const rec = JSON.parse(savedRec)
              setActiveAppliedRec(rec)
              if (rec.suggested_instructions) {
                setForm(f => ({
                  ...f,
                  instructions: f.instructions
                    ? `${f.instructions}\n${rec.suggested_instructions}`
                    : rec.suggested_instructions,
                }))
              }
            } catch (e) {
              console.warn('Failed to parse applied recommendation:', e)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }
    loadData()
  }, [])

  const applyInsightRecommendation = (insight: CampaignInsight) => {
    if (insight.category === 'platform') {
      setSelectedPlatforms(['Instagram', 'LinkedIn', 'YouTube Shorts', 'X'])
    } else if (insight.category === 'claim_risk') {
      setForm(f => ({
        ...f,
        instructions: f.instructions
          ? `${f.instructions}\n• [Memory Rule]: Substantiate all numerical claims with verified benchmarks; avoid blanket superlatives.`
          : '• [Memory Rule]: Substantiate all numerical claims with verified benchmarks; avoid blanket superlatives.',
      }))
    } else if (insight.category === 'approval_pattern') {
      setForm(f => ({
        ...f,
        instructions: f.instructions
          ? `${f.instructions}\n• [Reviewer Rule]: Strong 2-line provocative hook with single, frictionless CTA.`
          : '• [Reviewer Rule]: Strong 2-line provocative hook with single, frictionless CTA.',
      }))
    } else if (insight.category === 'strategy') {
      setForm(f => ({
        ...f,
        message: f.message || 'Built for craft-focused creators who demand friction-free precision.',
      }))
    }
  }

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const handleBuild = async () => {
    setErrorMessage(null)
    setGenerating(true)
    try {
      // 1. Persist campaign
      const campaignName = form.name.trim() || `${form.product} ${form.objective} Campaign`
      const campaign = await api.createCampaign({
        name: campaignName,
        product_name: form.product,
        objective: form.objective,
        audience: form.audience,
        duration: form.duration,
        message: form.message,
        instructions: form.instructions,
        platforms: selectedPlatforms,
      })

      // 2. Trigger LLM Strategy Generation
      const generatedStrats = await api.generateStrategies(campaign.id)
      const recommended = generatedStrats?.find(s => s.recommended) || generatedStrats?.find(s => s.strategy_type === 'story') || generatedStrats?.[0]
      if (recommended && typeof window !== 'undefined') {
        localStorage.setItem('brandforge_active_strategy_id', recommended.id)
      }

      // 3. Update global campaign state and navigate
      if (onCampaignCreated) {
        onCampaignCreated(campaign.id)
      }
      navigate('campaign-strategy')
    } catch (err: any) {
      console.error('Campaign generation failed:', err)
      setErrorMessage(err.message || 'Failed to generate strategies. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="w-full max-w-[1000px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3A3830' }}>New Campaign</div>
        <h1
          className="text-2xl sm:text-3xl lg:text-4xl"
          style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em' }}
        >
          Build Your Campaign
        </h1>
        <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>
          Tell BrandForge about your campaign. The AI will generate a complete strategy with platform-ready content.
        </p>
      </div>

      {activeAppliedRec && (
        <div style={{ padding: '14px 18px', background: 'rgba(196,129,58,0.08)', border: '1px solid rgba(196,129,58,0.35)', borderRadius: 6, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SparkleIcon size={16} style={{ color: '#C4813A' }} />
            <div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', textTransform: 'uppercase' }}>
                APPLIED CONTINUOUS OPTIMIZATION RECOMMENDATION
              </span>
              <div style={{ fontSize: 13, color: '#EDE8DF', fontWeight: 500, marginTop: 2 }}>
                {activeAppliedRec.title}: <span style={{ color: '#C4B89A', fontWeight: 400 }}>{activeAppliedRec.recommendation}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveAppliedRec(null)
              if (typeof window !== 'undefined') {
                localStorage.removeItem('brandforge_active_recommendation')
              }
            }}
            style={{ background: 'none', border: 'none', color: '#8C857B', cursor: 'pointer', fontSize: 13 }}
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: '12px 16px', background: 'rgba(196,88,88,0.1)', border: '1px solid #C45858', borderRadius: 6, color: '#EDE8DF', fontSize: 13, marginBottom: 24 }}>
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ ...S.card, padding: 28 }}>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 24px' }}>Campaign Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={S.label}>Campaign Name</label>
                <input
                  style={S.input}
                  placeholder="e.g. Summer Refresh 2024"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = '#C4813A')}
                  onBlur={e => (e.target.style.borderColor = '#252320')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={S.label}>Product / Service</label>
                  <select style={{ ...S.input, appearance: 'none', cursor: 'pointer' }} value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))}>
                    {productsList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Campaign Duration</label>
                  <select style={{ ...S.input, appearance: 'none', cursor: 'pointer' }} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                    {['1 week', '2 weeks', '3 weeks', '4 weeks', '6 weeks', '8 weeks', '3 months'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...S.card, padding: 28 }}>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 24px' }}>Objective & Audience</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Campaign Objective</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {objectives.map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, objective: o }))}
                      style={{
                        padding: '9px 12px', borderRadius: 6, border: `1px solid ${form.objective === o ? '#C4813A' : '#252320'}`,
                        background: form.objective === o ? 'rgba(196,129,58,0.1)' : 'transparent',
                        color: form.objective === o ? '#C4813A' : '#6B6560',
                        fontFamily: 'Inter, sans-serif', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                    >{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.label}>Target Audience</label>
                <input
                  style={S.input}
                  placeholder="e.g. Creative professionals aged 28–40, design-tool users..."
                  value={form.audience}
                  onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = '#C4813A')}
                  onBlur={e => (e.target.style.borderColor = '#252320')}
                />
              </div>
            </div>
          </div>

          <div style={{ ...S.card, padding: 28 }}>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 24px' }}>Platforms</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {platforms.map(p => {
                const active = selectedPlatforms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    style={{
                      padding: '10px 14px', borderRadius: 6,
                      border: `1px solid ${active ? '#C4813A' : '#252320'}`,
                      background: active ? 'rgba(196,129,58,0.1)' : 'transparent',
                      color: active ? '#C4813A' : '#6B6560',
                      fontFamily: 'Inter, sans-serif', fontSize: 12, cursor: 'pointer',
                      transition: 'all 0.12s ease', textAlign: 'left',
                    }}
                  >{p}</button>
                )
              })}
            </div>
          </div>

          <div style={{ ...S.card, padding: 28 }}>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 24px' }}>Message & Direction</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Key Message</label>
                <input
                  style={S.input}
                  placeholder="The single most important thing your audience should walk away believing..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = '#C4813A')}
                  onBlur={e => (e.target.style.borderColor = '#252320')}
                />
              </div>
              <div>
                <label style={S.label}>Additional Instructions <span style={{ color: '#3A3830' }}>(Optional)</span></label>
                <textarea
                  style={{ ...S.input, minHeight: 90, resize: 'vertical' as const, lineHeight: 1.6 }}
                  placeholder="Any specific tone, themes, references, or constraints to consider..."
                  value={form.instructions}
                  onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = '#C4813A')}
                  onBlur={e => (e.target.style.borderColor = '#252320')}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleBuild}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 28px', background: generating ? '#6B5030' : '#C4813A',
              color: '#0A0908', border: 'none', borderRadius: 6,
              cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif',
              transition: 'background 0.15s ease',
            }}
          >
            {generating ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTop: '2px solid #0A0908', borderRadius: '50%' }} className="animate-spin" />
                Generating AI Strategy (Gemini Engine)...
              </>
            ) : (
              <>
                <SparkleIcon size={15} /> Build Campaign <ArrowRightIcon size={14} />
              </>
            )}
          </button>
        </div>

        {/* AI Preview panel & Campaign Memory recommendations */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Campaign Memory Suggestions Card */}
          {memoryData && memoryData.insights && memoryData.insights.length > 0 && (
            <div style={{ ...S.card, padding: 20, borderLeft: '3px solid #5BA373' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SparkleIcon size={13} style={{ color: '#5BA373' }} />
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5BA373', letterSpacing: '0.08em' }}>
                    CAMPAIGN MEMORY SIGNALS
                  </span>
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
                    padding: 0,
                  }}
                >
                  View All ({memoryData.insights.length}) →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {memoryData.insights.slice(0, 2).map((ins, iIdx) => (
                  <div
                    key={ins.id || iIdx}
                    style={{
                      padding: '10px 12px',
                      background: '#151413',
                      border: '1px solid #1F1D1A',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C4813A', textTransform: 'uppercase' }}>
                        {ins.category}
                      </span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 8.5, color: '#5BA373' }}>
                        {ins.confidence.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#EDE8DF', fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>
                      {ins.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A8278', marginBottom: 8, lineHeight: 1.4 }}>
                      {ins.recommendation}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyInsightRecommendation(ins)}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(196,129,58,0.12)',
                        border: '1px solid rgba(196,129,58,0.3)',
                        borderRadius: 4,
                        color: '#C4813A',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + Apply to Form
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...S.card, padding: 24, borderLeft: '2px solid #C4813A', borderRadius: '0 8px 8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <SparkleIcon size={14} style={{ color: '#C4813A' }} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>AI STRATEGY PREVIEW</span>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: '0 0 20px', lineHeight: 1.6 }}>
              Based on your Brand DNA and the inputs below, BrandForge will generate:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { num: '01', label: 'Campaign Strategy', desc: 'Objective-aligned narrative with audience insights' },
                { num: '02', label: 'Content Pillars', desc: '3–5 thematic directions based on your brand voice' },
                { num: '03', label: 'Platform Content', desc: `${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''}: posts, captions, and CTAs` },
                { num: '04', label: 'Campaign Timeline', desc: 'Teaser → Launch → Feature → CTA → Follow-up' },
                { num: '05', label: 'BrandGuard Audit', desc: 'Every piece verified before you see it' },
              ].map(item => (
                <div key={item.num} style={{ display: 'flex', gap: 12, paddingBottom: 12, borderBottom: '1px solid #1C1B19' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3A3830', flexShrink: 0, paddingTop: 1 }}>{item.num}</span>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#EDE8DF', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B6560', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: 14, background: 'rgba(196,129,58,0.06)', borderRadius: 6 }}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', margin: 0, letterSpacing: '0.04em' }}>
                ESTIMATED GENERATION: ~3-5 seconds
              </p>
            </div>
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3A3830', letterSpacing: '0.08em', marginBottom: 12 }}>BRAND DNA STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5BA373' }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A' }}>Arkiva Studio — 82% complete</span>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B6560', margin: 0, lineHeight: 1.5 }}>
              The AI will apply brand voice, visual identity, and messaging guidelines automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
