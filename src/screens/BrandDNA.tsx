import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { UploadIcon, SparkleIcon, CheckIcon, ChevronRightIcon, PlusIcon } from '../components/Icons'
import { api } from '../services/api'
import type { BrandDNAData, VoiceTrait } from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
}

const S = {
  page: { padding: '48px 48px', maxWidth: 1100, margin: '0 auto' } as React.CSSProperties,
  label: { fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#3A3830' },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
  sectionNum: { fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3A3830', marginRight: 12 },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: '#181715',
    border: '1px solid #252320',
    borderRadius: 6,
    color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    outline: 'none',
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,
}

const defaultVoiceTraits: VoiceTrait[] = [
  { trait: 'Confident', opposite: 'Timid', value: 78 },
  { trait: 'Creative', opposite: 'Conservative', value: 85 },
  { trait: 'Approachable', opposite: 'Formal', value: 62 },
  { trait: 'Precise', opposite: 'Casual', value: 71 },
]

const defaultMessagingPillars = [
  { title: 'Creative Empowerment', desc: 'We give creative professionals the tools to realize their vision without technical barriers.' },
  { title: 'Design Intelligence', desc: 'Arkiva learns from your creative patterns to suggest smarter, faster workflows.' },
  { title: 'Community & Craft', desc: 'Great design is shaped by community. We celebrate makers, teachers, and creators.' },
]

const defaultValues = ['Craft', 'Clarity', 'Empowerment', 'Innovation', 'Community', 'Integrity']

const defaultVoiceDescriptors = [
  'Expert but accessible',
  'Inspiring',
  'Honest',
  'Forward-thinking',
  'Warm but professional',
  'Empowering',
]

const defaultDoList = [
  "Speak directly to the creative's challenge",
  'Use specific, vivid examples',
  'Celebrate craft and attention to detail',
  'Reference real user outcomes',
  'Use confident, clear language',
]

const defaultDontList = [
  'Use jargon or buzzwords like "synergy"',
  'Make unsubstantiated claims',
  'Use pushy or salesy language',
  'Compare negatively to competitors',
  'Oversimplify professional design work',
]

const sections = ['Identity', 'Voice', 'Audience', 'Visual', 'Products', 'Pillars', "Do & Don't"]

export default function BrandDNA({ navigate }: Props) {
  const [activeSection, setActiveSection] = useState('Identity')
  const [brand, setBrand] = useState<BrandDNAData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    async function loadBrand() {
      try {
        setLoading(true)
        const data = await api.getCurrentBrand()
        setBrand(data)
      } catch (err) {
        console.error('Failed to fetch brand DNA:', err)
      } finally {
        setLoading(false)
      }
    }
    loadBrand()
  }, [])

  const completeness = brand?.completeness ?? 82
  const voiceTraits = brand?.voice_traits?.length ? brand.voice_traits : defaultVoiceTraits
  const messagingPillars = brand?.messaging_pillars?.length ? brand.messaging_pillars : defaultMessagingPillars
  const voiceDescriptors = brand?.voice_descriptors?.length ? brand.voice_descriptors : defaultVoiceDescriptors
  const values = brand?.values?.length ? brand.values : defaultValues
  const doList = brand?.do_list?.length ? brand.do_list : defaultDoList
  const dontList = brand?.dont_list?.length ? brand.dont_list : defaultDontList

  // Update voice trait value in local state
  const handleVoiceTraitChange = (traitName: string, newValue: number) => {
    setBrand(prev => {
      const currentTraits = prev?.voice_traits?.length ? prev.voice_traits : defaultVoiceTraits
      const updatedTraits = currentTraits.map(t =>
        t.trait === traitName ? { ...t, value: newValue } : t
      )
      if (!prev) {
        return {
          id: '',
          name: 'Arkiva Studio',
          completeness: 82,
          values: defaultValues,
          voice_traits: updatedTraits,
          voice_descriptors: defaultVoiceDescriptors,
          messaging_pillars: defaultMessagingPillars,
          do_list: defaultDoList,
          dont_list: defaultDontList,
          target_audience: [],
          visual_identity: { colors: [], typography: { display: { font: 'Fraunces', usage: '' }, body: { font: 'Inter', usage: '' } } },
        }
      }
      return { ...prev, voice_traits: updatedTraits }
    })
  }

  // Update identity text fields in local state
  const handleIdentityChange = (field: keyof BrandDNAData, value: string) => {
    setBrand(prev => {
      if (!prev) {
        return {
          id: '',
          name: field === 'name' ? value : 'Arkiva Studio',
          industry: field === 'industry' ? value : 'Creative Software & Design Tools',
          founded: field === 'founded' ? value : '2019',
          stage: field === 'stage' ? value : 'Growth',
          tagline: field === 'tagline' ? value : '"Design without limits."',
          mission: field === 'mission' ? value : 'Empower creative professionals with intelligent design tools.',
          completeness: 82,
          values: defaultValues,
          voice_traits: defaultVoiceTraits,
          voice_descriptors: defaultVoiceDescriptors,
          messaging_pillars: defaultMessagingPillars,
          do_list: defaultDoList,
          dont_list: defaultDontList,
          target_audience: [],
          visual_identity: { colors: [], typography: { display: { font: 'Fraunces', usage: '' }, body: { font: 'Inter', usage: '' } } },
        }
      }
      return { ...prev, [field]: value }
    })
  }

  // Save supported Brand DNA fields to backend
  const handleSave = async () => {
    if (!brand) return
    try {
      setSaving(true)
      const payload: Partial<BrandDNAData> = {
        name: brand.name,
        industry: brand.industry,
        founded: brand.founded,
        stage: brand.stage,
        tagline: brand.tagline,
        mission: brand.mission,
        completeness: brand.completeness,
        values: brand.values || defaultValues,
        voice_traits: brand.voice_traits || defaultVoiceTraits,
        voice_descriptors: brand.voice_descriptors || defaultVoiceDescriptors,
        messaging_pillars: brand.messaging_pillars || defaultMessagingPillars,
        do_list: brand.do_list || defaultDoList,
        dont_list: brand.dont_list || defaultDontList,
        target_audience: brand.target_audience || [],
        visual_identity: brand.visual_identity || {},
      }
      const updated = await api.updateCurrentBrand(payload)
      setBrand(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to save brand DNA:', err)
    } finally {
      setSaving(false)
    }
  }

  const identityFields = [
    { label: 'Brand Name', key: 'name' as const, value: brand?.name ?? 'Arkiva Studio', placeholder: 'e.g. Arkiva Studio' },
    { label: 'Industry', key: 'industry' as const, value: brand?.industry ?? 'Creative Software & Design Tools', placeholder: 'e.g. Creative Software & Design Tools' },
    { label: 'Founded', key: 'founded' as const, value: brand?.founded ?? '2019', placeholder: 'e.g. 2019' },
    { label: 'Brand Stage', key: 'stage' as const, value: brand?.stage ?? 'Growth', placeholder: 'e.g. Growth' },
    { label: 'Tagline', key: 'tagline' as const, value: brand?.tagline ?? '"Design without limits."', placeholder: 'e.g. "Design without limits."' },
    { label: 'Mission', key: 'mission' as const, value: brand?.mission ?? 'Empower creative professionals with intelligent design tools.', placeholder: 'e.g. Empower creative professionals with intelligent design tools.' },
  ]

  return (
    <div className="w-full max-w-[1150px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      {/* Header */}
      <div className="mb-6 sm:mb-9 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div style={S.label}>Brand DNA</div>
          <h1
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}
            className="text-2xl sm:text-3xl lg:text-4xl"
          >
            Your Brand Foundation
          </h1>
          <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>
            The AI-extracted knowledge base that powers every campaign, content piece, and strategy.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: saveSuccess ? '#5BA373' : '#C4813A',
            color: '#0A0908', border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s ease',
          }}
          className="w-full sm:w-auto justify-center"
        >
          {saving ? (
            'Saving...'
          ) : saveSuccess ? (
            <>
              <CheckIcon size={14} /> Saved to Database
            </>
          ) : (
            'Save Brand DNA'
          )}
        </button>
      </div>

      {/* Status bar */}
      <div className="p-4 sm:p-5 mb-6 sm:mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4" style={S.card}>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Brand DNA Completeness</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 140, height: 4, background: '#1E1D1B', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${completeness}%`, height: '100%', background: '#C4813A', borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#C4813A' }}>{completeness}%</span>
            </div>
          </div>
          <div className="hidden sm:block" style={{ width: 1, height: 36, background: '#252320' }} />
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {[
              { label: 'Identity', done: true },
              { label: 'Voice', done: true },
              { label: 'Audience', done: true },
              { label: 'Visual', done: false },
              { label: 'Products', done: true },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.done ? '#5BA373' : '#3A3830' }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: s.done ? '#5BA373' : '#3A3830' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'transparent', border: '1px solid #252320', borderRadius: 6,
            color: '#C4B89A', fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
          }}>
            <UploadIcon size={13} /> Upload Guidelines
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'transparent', border: '1px solid #252320', borderRadius: 6,
            color: '#C4B89A', fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
          }}>
            <SparkleIcon size={13} /> Add Website
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'transparent', border: '1px solid #252320', borderRadius: 6,
            color: '#C4B89A', fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
          }}>
            <ChevronRightIcon size={13} /> Import Content
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 sm:gap-2 mb-6 sm:mb-8 p-1.5 bg-[#0D0C0B] rounded-lg border border-[#1C1B19] overflow-x-auto no-scrollbar scrollbar-none">
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            padding: '7px 14px', borderRadius: 6, border: 'none', background: activeSection === s ? '#1E1D1B' : 'transparent',
            color: activeSection === s ? '#EDE8DF' : '#6B6560', fontSize: 12, fontFamily: 'Inter, sans-serif',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
          }}
          className="whitespace-nowrap flex-shrink-0"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main section */}
        <div>
          {activeSection === 'Identity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="p-4 sm:p-7" style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                  <span style={S.sectionNum}>01</span>
                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>Brand Identity</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {identityFields.map(f => (
                    <div key={f.label}>
                      <label style={{ ...S.label, marginBottom: 6, display: 'block' }}>{f.label}</label>
                      {f.key === 'mission' ? (
                        <textarea
                          style={{
                            ...S.input,
                            resize: 'vertical',
                            minHeight: 52,
                          }}
                          placeholder={f.placeholder}
                          value={f.value}
                          onChange={e => handleIdentityChange(f.key, e.target.value)}
                          onFocus={e => (e.target.style.borderColor = '#C4813A')}
                          onBlur={e => (e.target.style.borderColor = '#252320')}
                        />
                      ) : (
                        <input
                          type="text"
                          style={S.input}
                          placeholder={f.placeholder}
                          value={f.value}
                          onChange={e => handleIdentityChange(f.key, e.target.value)}
                          onFocus={e => (e.target.style.borderColor = '#C4813A')}
                          onBlur={e => (e.target.style.borderColor = '#252320')}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 sm:p-7" style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                  <span style={S.sectionNum}>02</span>
                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>Brand Values</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {values.map(v => (
                    <div key={v} style={{
                      padding: '12px 16px', background: 'rgba(196,129,58,0.06)', border: '1px solid rgba(196,129,58,0.15)',
                      borderRadius: 6, textAlign: 'center',
                    }}>
                      <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 15, color: '#C4B89A' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Voice' && (
            <div className="p-4 sm:p-7" style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                <span style={S.sectionNum}>02</span>
                <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>Brand Voice & Tone</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
                {voiceTraits.map(t => (
                  <div key={t.trait}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF' }}>{t.trait}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C4813A' }}>{t.value}%</span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560' }}>{t.opposite}</span>
                      </div>
                    </div>
                    {/* Interactive Slider Track */}
                    <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '100%', height: 4, background: '#1E1D1B', borderRadius: 2 }}>
                        {/* Dynamic Gradient Bar */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${t.value}%`, background: 'linear-gradient(90deg, #C4813A, rgba(196,129,58,0.4))',
                          borderRadius: 2,
                        }} />
                        {/* Interactive Visual Knob */}
                        <div style={{
                          position: 'absolute', top: -4, left: `${t.value}%`,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#C4813A', border: '2px solid #111110',
                          transform: 'translateX(-50%)',
                          pointerEvents: 'none',
                        }} />
                      </div>
                      {/* Range Input for Native Interaction & Accessibility */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={t.value}
                        onChange={e => handleVoiceTraitChange(t.trait, Number(e.target.value))}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          margin: 0,
                          zIndex: 10,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #252320', paddingTop: 24 }}>
                <div style={{ ...S.label, marginBottom: 14 }}>Voice Descriptors</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {voiceDescriptors.map(d => (
                    <span key={d} style={{
                      padding: '5px 12px', background: '#1E1D1B', border: '1px solid #252320',
                      borderRadius: 100, fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A',
                    }}>{d}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Pillars' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messagingPillars.map((p, i) => (
                <div key={i} className="p-4 sm:p-6" style={{ ...S.card, borderLeft: '2px solid #C4813A', borderRadius: '0 8px 8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C4813A' }}>0{i + 1}</span>
                    <h4 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 17, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>{p.title}</h4>
                  </div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#C4B89A', margin: 0, lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              ))}
            </div>
          )}

          {activeSection === "Do & Don't" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="p-4 sm:p-6" style={{ ...S.card, borderTop: '2px solid #5BA373' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <CheckIcon size={14} style={{ color: '#5BA373' }} />
                  <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#5BA373', fontWeight: 400 }}>Do</span>
                </div>
                {doList.map(d => (
                  <div key={d} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#5BA373', marginTop: 6, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A', lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 sm:p-6" style={{ ...S.card, borderTop: '2px solid #C45858' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#C45858', fontWeight: 400 }}>Don't</span>
                </div>
                {dontList.map(d => (
                  <div key={d} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#C45858', marginTop: 6, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A', lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeSection === 'Audience' || activeSection === 'Visual' || activeSection === 'Products') && (
            <div className="p-4 sm:p-7" style={S.card}>
              {activeSection === 'Audience' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    <span style={S.sectionNum}>03</span>
                    <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>Target Audience</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-6">
                    {[
                      { label: 'Primary', name: 'The Professional Creative', age: '28–42', role: 'Graphic designers, art directors, brand designers', pain: 'Too many tools, too little time, inconsistent output quality' },
                      { label: 'Secondary', name: 'The Creative Entrepreneur', age: '24–36', role: 'Freelancers, indie studio founders, content creators', pain: 'Scaling creative output without hiring a full team' },
                    ].map(a => (
                      <div key={a.label} style={{ padding: 20, background: '#181715', borderRadius: 6, border: '1px solid #252320' }}>
                        <div style={{ ...S.label, marginBottom: 8 }}>Segment {a.label}</div>
                        <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF', marginBottom: 12 }}>{a.name}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>AGE: </span><span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A' }}>{a.age}</span></div>
                          <div><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>ROLE: </span><span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A' }}>{a.role}</span></div>
                          <div><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>PAIN: </span><span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A' }}>{a.pain}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeSection === 'Visual' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    <span style={S.sectionNum}>04</span>
                    <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>Visual Identity</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={{ ...S.label, marginBottom: 12 }}>Brand Colors</div>
                      <div className="flex flex-wrap gap-3 sm:gap-4">
                        {[
                          { name: 'Obsidian', hex: '#0A0908', role: 'Primary' },
                          { name: 'Copper', hex: '#C4813A', role: 'Accent' },
                          { name: 'Cream', hex: '#EDE8DF', role: 'Foreground' },
                          { name: 'Slate', hex: '#6B6560', role: 'Muted' },
                        ].map(c => (
                          <div key={c.name} style={{ textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 8, background: c.hex, border: '1px solid #252320', marginBottom: 8 }} />
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#C4B89A' }}>{c.name}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>{c.hex}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#3A3830' }}>{c.role}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #252320', paddingTop: 20 }}>
                      <div style={{ ...S.label, marginBottom: 12 }}>Typography</div>
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                        <div>
                          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 28, fontWeight: 300, color: '#EDE8DF', marginBottom: 4 }}>Fraunces</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>Display / Headings</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, color: '#EDE8DF', marginBottom: 4 }}>Inter</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>Body / UI</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {activeSection === 'Products' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    <span style={S.sectionNum}>05</span>
                    <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>Products & Services</h3>
                  </div>
                  {(brand?.products && brand.products.length > 0 ? brand.products : [
                    { name: 'Arkiva Pro Suite', product_type: 'Core Product', price: '$49/mo', description: 'Full-featured design workspace with AI-powered tools, smart templates, and collaboration.' },
                    { name: 'Arkiva Templates', product_type: 'Add-on', price: '$12/mo', description: '2,000+ professionally designed, brand-customizable templates for every platform.' },
                    { name: 'Arkiva Community', product_type: 'Platform', price: 'Free', description: 'Peer-to-peer learning, showcases, and design resources for the creative community.' },
                  ]).map((p, i) => (
                    <div key={i} style={{ padding: '18px 0', borderBottom: i < 2 ? '1px solid #252320' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF', fontWeight: 400 }}>{p.name}</span>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, padding: '3px 8px', background: '#1E1D1B', borderRadius: 4, color: '#6B6560' }}>{p.product_type}</span>
                        </div>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#C4813A' }}>{p.price}</span>
                      </div>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', margin: 0, lineHeight: 1.6 }}>{p.description}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: AI extraction status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...S.card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <SparkleIcon size={14} style={{ color: '#C4813A' }} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>AI EXTRACTION</span>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: '0 0 16px', lineHeight: 1.6 }}>
              Brand DNA was extracted from your uploaded guidelines, website, and 47 past content pieces.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { source: 'Brand_Guidelines_2024.pdf', items: 34, done: true },
                { source: 'arkiva.studio', items: 128, done: true },
                { source: 'Past campaigns (Q1–Q2)', items: 47, done: true },
                { source: 'Social media archive', items: 12, done: false },
              ].map(s => (
                <div key={s.source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0D0C0B', borderRadius: 5 }}>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#C4B89A' }}>{s.source}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3A3830' }}>{s.items} signals</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.done ? '#5BA373' : '#3A3830' }} />
                </div>
              ))}
            </div>
            <button style={{
              marginTop: 16, width: '100%', padding: '10px', background: 'rgba(196,129,58,0.08)',
              border: '1px solid rgba(196,129,58,0.2)', borderRadius: 6, color: '#C4813A',
              fontFamily: 'Inter, sans-serif', fontSize: 12, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <PlusIcon size={12} /> Add More Sources
            </button>
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.label, marginBottom: 12 }}>Confidence Scores</div>
            {[
              { label: 'Brand Voice', score: 94 },
              { label: 'Target Audience', score: 89 },
              { label: 'Visual Identity', score: 72 },
              { label: 'Messaging', score: 91 },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A' }}>{item.label}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: item.score > 85 ? '#5BA373' : '#C4813A' }}>{item.score}%</span>
                </div>
                <div style={{ height: 3, background: '#1E1D1B', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${item.score}%`, height: '100%', background: item.score > 85 ? '#3D7A52' : '#C4813A', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
