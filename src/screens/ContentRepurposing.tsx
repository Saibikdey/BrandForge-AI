import React, { useState, useEffect } from 'react'
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
  AlertTriangleIcon,
  PlusIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  CampaignData,
  StrategyDirection,
  CampaignContent,
  ContentAudit,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  activeCampaignId?: string | null
  activeStrategyId?: string | null
  activeContentId?: string | null
  onCampaignSelected?: (campaignId: string) => void
  onContentSelected?: (contentId: string) => void
}

const S = {
  page: { padding: '44px 48px', maxWidth: 1160, margin: '0 auto' } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#6B6560',
  },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: '#181715',
    border: '1px solid #252320',
    borderRadius: 6,
    color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    lineHeight: 1.5,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '12px 14px',
    background: '#181715',
    border: '1px solid #252320',
    borderRadius: 6,
    color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    lineHeight: 1.6,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 110,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
}

interface TargetPlatformOption {
  id: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
  name: string
  formatLabel: string
  color: string
  iconBadge: string
  description: string
}

const TARGET_PLATFORMS: TargetPlatformOption[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    formatLabel: 'Carousel & Visual Caption',
    color: '#C4813A',
    iconBadge: 'IG',
    description: 'Aesthetic hook, multi-slide narrative breakdown, curated hashtags & art direction.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    formatLabel: 'Thought-Leadership Post',
    color: '#5B9BC4',
    iconBadge: 'IN',
    description: 'Executive hook, structured whitespace, bullet insight takeaways & peer prompt.',
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    formatLabel: '4-Tweet Thread / Post',
    color: '#EDE8DF',
    iconBadge: '𝕏',
    description: 'Scroll-stopping opening tweet, high-signal numbered points & bookmark CTA.',
  },
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    formatLabel: '30-45s Spoken Script',
    color: '#C45858',
    iconBadge: 'YT',
    description: '0-3s spoken hook, video action cues, scene timestamps & pinned comment CTA.',
  },
]

export default function ContentRepurposing({
  navigate,
  activeCampaignId,
  activeStrategyId,
  activeContentId,
  onCampaignSelected,
  onContentSelected,
}: Props) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [campaignContents, setCampaignContents] = useState<CampaignContent[]>([])
  const [strategies, setStrategies] = useState<StrategyDirection[]>([])
  const [loading, setLoading] = useState(true)

  // Source selection state
  const [sourceMode, setSourceMode] = useState<'existing' | 'custom'>('existing')
  const [selectedSourceContentId, setSelectedSourceContentId] = useState<string>('')
  const [customTitle, setCustomTitle] = useState('How Intelligent Systems Elevate Craft')
  const [customPlatform, setCustomPlatform] = useState('Blog / Keynote')
  const [customBody, setCustomBody] = useState(
    'Most creative professionals lose up to 40% of their workday to tedious reformatting, broken plugin handoffs, and asset version drift.\n\nBy unifying intelligent layout scaling and brand governance into a single workspace, creative teams eliminate grunt work and keep human energy focused 100% on craft.'
  )

  // Target platforms state
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([
    'instagram',
    'linkedin',
    'x',
    'youtube_shorts',
  ])
  const [saveToCampaign, setSaveToCampaign] = useState(true)

  // Repurposing execution state
  const [repurposing, setRepurposing] = useState(false)
  const [regeneratingPlatform, setRegeneratingPlatform] = useState<string | null>(null)
  const [repurposedItems, setRepurposedItems] = useState<CampaignContent[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [auditingIds, setAuditingIds] = useState<Record<string, boolean>>({})
  const [auditResults, setAuditResults] = useState<Record<string, ContentAudit>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Resolve effective campaign ID
  const effectiveCampaignId =
    selectedCampaignId ||
    activeCampaignId ||
    (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_campaign_id') : null)

  // Load initial data
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const camps = await api.getCampaigns()
        setCampaigns(camps || [])

        let targetCampId = effectiveCampaignId
        if (!targetCampId && camps && camps.length > 0) {
          targetCampId = camps[0].id
        }

        if (targetCampId) {
          setSelectedCampaignId(targetCampId)
          const [contentList, stratList] = await Promise.all([
            api.getContent(targetCampId).catch(() => []),
            api.getStrategies(targetCampId).catch(() => []),
          ])
          setCampaignContents(contentList || [])
          setStrategies(stratList || [])

          // Pick active source content if passed via props / localStorage
          if (contentList && contentList.length > 0) {
            const initialSource =
              (activeContentId ? contentList.find(c => c.id === activeContentId) : null) ||
              contentList[0]
            if (initialSource) {
              setSelectedSourceContentId(initialSource.id)
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load repurposing context:', err)
        setErrorMessage(err.message || 'Failed to initialize repurposing studio.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Switch active campaign
  const handleCampaignChange = async (campId: string) => {
    setSelectedCampaignId(campId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_campaign_id', campId)
    }
    if (onCampaignSelected) {
      onCampaignSelected(campId)
    }

    try {
      const [contentList, stratList] = await Promise.all([
        api.getContent(campId).catch(() => []),
        api.getStrategies(campId).catch(() => []),
      ])
      setCampaignContents(contentList || [])
      setStrategies(stratList || [])
      if (contentList && contentList.length > 0) {
        setSelectedSourceContentId(contentList[0].id)
      } else {
        setSelectedSourceContentId('')
        setSourceMode('custom')
      }
    } catch (err) {
      console.warn('Failed to fetch campaign contents:', err)
    }
  }

  // Toggle target platform
  const toggleTargetPlatform = (id: string) => {
    setTargetPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const selectedSourceContent = campaignContents.find(c => c.id === selectedSourceContentId)

  // Run full repurposing
  const handleRepurpose = async () => {
    if (targetPlatforms.length === 0) {
      setErrorMessage('Please select at least one target platform.')
      return
    }

    if (sourceMode === 'existing' && !selectedSourceContentId) {
      setErrorMessage('Please select an existing source content piece or enter custom text.')
      return
    }

    if (sourceMode === 'custom' && !customBody.trim()) {
      setErrorMessage('Please enter source content text to repurpose.')
      return
    }

    setRepurposing(true)
    setErrorMessage(null)
    setSuccessToast(null)

    try {
      const payload = {
        source_content_id: sourceMode === 'existing' ? selectedSourceContentId : undefined,
        source_text: sourceMode === 'custom' ? customBody : undefined,
        source_title: sourceMode === 'custom' ? customTitle : selectedSourceContent?.title,
        source_platform: sourceMode === 'custom' ? customPlatform : selectedSourceContent?.platform,
        target_platforms: targetPlatforms,
        campaign_id: effectiveCampaignId || undefined,
        strategy_id: strategies.find(s => s.is_selected)?.id || strategies[0]?.id,
        save_to_campaign: saveToCampaign,
      }

      const res = await api.repurposeContent(payload, effectiveCampaignId || undefined)
      setRepurposedItems(res.items || [])
      setSuccessToast(`Successfully adapted ${res.items.length} platform derivatives!`)
      setTimeout(() => setSuccessToast(null), 4000)

      // Refresh campaign contents if saved
      if (saveToCampaign && effectiveCampaignId) {
        const freshList = await api.getContent(effectiveCampaignId).catch(() => [])
        setCampaignContents(freshList || [])
      }
    } catch (err: any) {
      console.error('Content repurposing failed:', err)
      setErrorMessage(err.message || 'Repurposing failed. Please verify inputs.')
    } finally {
      setRepurposing(false)
    }
  }

  // Regenerate single platform derivative
  const handleRegeneratePlatform = async (platformId: string) => {
    setRegeneratingPlatform(platformId)
    try {
      const payload = {
        source_content_id: sourceMode === 'existing' ? selectedSourceContentId : undefined,
        source_text: sourceMode === 'custom' ? customBody : undefined,
        source_title: sourceMode === 'custom' ? customTitle : selectedSourceContent?.title,
        source_platform: sourceMode === 'custom' ? customPlatform : selectedSourceContent?.platform,
        target_platforms: [platformId],
        campaign_id: effectiveCampaignId || undefined,
        strategy_id: strategies.find(s => s.is_selected)?.id || strategies[0]?.id,
        save_to_campaign: saveToCampaign,
      }

      const res = await api.repurposeContent(payload, effectiveCampaignId || undefined)
      if (res.items && res.items.length > 0) {
        const newItem = res.items[0]
        setRepurposedItems(prev => {
          const filtered = prev.filter(p => p.platform !== platformId)
          return [...filtered, newItem]
        })
      }
    } catch (err: any) {
      console.error('Regeneration failed:', err)
      setErrorMessage(err.message || 'Failed to regenerate platform derivative.')
    } finally {
      setRegeneratingPlatform(null)
    }
  }

  // Copy to clipboard
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Run BrandGuard audit for a derivative
  const handleAuditItem = async (item: CampaignContent) => {
    if (!item.id || item.id.startsWith('ephemeral')) {
      setErrorMessage('Please enable "Save to Campaign Studio" to run full persistent BrandGuard audits.')
      return
    }

    setAuditingIds(prev => ({ ...prev, [item.id]: true }))
    try {
      const audit = await api.auditContent(item.id)
      setAuditResults(prev => ({ ...prev, [item.id]: audit }))
    } catch (err: any) {
      console.error('Audit failed:', err)
      setErrorMessage(err.message || 'Audit failed.')
    } finally {
      setAuditingIds(prev => ({ ...prev, [item.id]: false }))
    }
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={S.label}>Hero-to-Derivative Adaptation Engine</span>
          <span style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', padding: '2px 7px', borderRadius: 4, background: 'rgba(196,129,58,0.12)', color: '#C4813A', border: '1px solid rgba(196,129,58,0.25)' }}>
            MULTI-CHANNEL ORCHESTRATION
          </span>
        </div>
        <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 300, color: '#EDE8DF', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
          Content Repurposing
        </h1>
        <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Transform hero concepts, long-form articles, and existing campaign assets into high-converting, platform-native derivative formats in one click.
        </p>
      </div>

      {/* Toast / Error alerts */}
      {errorMessage && (
        <div style={{ padding: '12px 18px', background: 'rgba(196,88,88,0.1)', border: '1px solid #C45858', borderRadius: 6, color: '#EDE8DF', fontSize: 13, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#C45858', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {successToast && (
        <div style={{ padding: '12px 18px', background: 'rgba(91,163,115,0.12)', border: '1px solid rgba(91,163,115,0.3)', borderRadius: 6, color: '#5BA373', fontSize: 13, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckIcon size={14} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Configuration Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 28 }}>
        {/* Source Content Panel */}
        <div style={{ ...S.card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={S.label}>1. Select Source / Hero Content</span>
            <div style={{ display: 'flex', gap: 4, background: '#181715', padding: 2, borderRadius: 6, border: '1px solid #252320' }}>
              <button
                onClick={() => setSourceMode('existing')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: sourceMode === 'existing' ? '#252320' : 'transparent',
                  color: sourceMode === 'existing' ? '#EDE8DF' : '#6B6560',
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Campaign Asset
              </button>
              <button
                onClick={() => setSourceMode('custom')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: sourceMode === 'custom' ? '#252320' : 'transparent',
                  color: sourceMode === 'custom' ? '#EDE8DF' : '#6B6560',
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Custom Input
              </button>
            </div>
          </div>

          {/* Campaign Selector dropdown */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>
              Active Campaign Context
            </label>
            <select
              value={selectedCampaignId}
              onChange={e => handleCampaignChange(e.target.value)}
              style={{ ...S.input, cursor: 'pointer' }}
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id} style={{ background: '#111110', color: '#EDE8DF' }}>
                  {c.name} ({c.product_name})
                </option>
              ))}
            </select>
          </div>

          {sourceMode === 'existing' ? (
            <div>
              <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>
                Select Existing Hero Asset ({campaignContents.length} available)
              </label>
              {campaignContents.length > 0 ? (
                <select
                  value={selectedSourceContentId}
                  onChange={e => setSelectedSourceContentId(e.target.value)}
                  style={{ ...S.input, marginBottom: 16, cursor: 'pointer' }}
                >
                  {campaignContents.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#111110', color: '#EDE8DF' }}>
                      [{c.platform.toUpperCase()}] {c.title || c.body.slice(0, 40) + '...'}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '14px', background: '#141312', border: '1px dashed #252320', borderRadius: 6, color: '#6B6560', fontSize: 12, marginBottom: 16 }}>
                  No content generated in this campaign yet. Switch to "Custom Input" or generate assets in Content Studio.
                </div>
              )}

              {selectedSourceContent && (
                <div style={{ padding: 14, background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A' }}>
                      SOURCE: {selectedSourceContent.platform.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: '#6B6560' }}>
                      {selectedSourceContent.body.length} chars
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 14, color: '#EDE8DF', marginBottom: 6 }}>
                    {selectedSourceContent.title || 'Untitled Asset'}
                  </div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#8C857B', margin: 0, lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}>
                    {selectedSourceContent.body}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>Source Headline</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    style={S.input}
                    placeholder="e.g. Master Creative Framework"
                  />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>Source Channel</label>
                  <input
                    type="text"
                    value={customPlatform}
                    onChange={e => setCustomPlatform(e.target.value)}
                    style={S.input}
                    placeholder="e.g. Blog, Keynote, Newsletter"
                  />
                </div>
              </div>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 4, fontSize: 9 }}>Source Text / Body</label>
                <textarea
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  style={S.textarea}
                  placeholder="Paste your source text, article excerpt, script, or core argument here..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Target Platforms & Orchestration Panel */}
        <div style={{ ...S.card, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={S.label}>2. Target Adaptation Formats</span>
              <button
                onClick={() =>
                  setTargetPlatforms(
                    targetPlatforms.length === TARGET_PLATFORMS.length
                      ? ['instagram', 'linkedin']
                      : TARGET_PLATFORMS.map(p => p.id)
                  )
                }
                style={{ background: 'none', border: 'none', color: '#C4813A', fontSize: 11, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
              >
                {targetPlatforms.length === TARGET_PLATFORMS.length ? 'Reset Selection' : 'Select All 4 Platforms'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {TARGET_PLATFORMS.map(p => {
                const isSelected = targetPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleTargetPlatform(p.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 6,
                      border: `1px solid ${isSelected ? p.color : '#252320'}`,
                      background: isSelected ? `${p.color}10` : '#141312',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: isSelected ? p.color : '#EDE8DF' }}>
                        {p.name}
                      </span>
                      {isSelected && (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckIcon size={9} style={{ color: '#0A0908' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B6560' }}>
                      {p.formatLabel}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Save to campaign checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#8C857B', marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={saveToCampaign}
                onChange={e => setSaveToCampaign(e.target.checked)}
                style={{ accentColor: '#C4813A', cursor: 'pointer' }}
              />
              <span>Save adapted derivatives to Campaign Studio & Human Approval Queue</span>
            </label>
          </div>

          {/* Action Button */}
          <button
            onClick={handleRepurpose}
            disabled={repurposing || loading || targetPlatforms.length === 0}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '13px 20px',
              background: repurposing ? '#6B5030' : '#C4813A',
              color: '#0A0908',
              border: 'none',
              borderRadius: 6,
              cursor: repurposing || targetPlatforms.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.15s ease',
            }}
          >
            {repurposing ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTop: '2px solid #0A0908', borderRadius: '50%' }} className="animate-spin" />
                Generating Multi-Channel Derivatives...
              </>
            ) : (
              <>
                <SparkleIcon size={14} /> Generate {targetPlatforms.length} Platform Derivatives <ArrowRightIcon size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Repurposed Derivatives Output Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={S.label}>Generated Derivative Assets</span>
            {repurposedItems.length > 0 && (
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5BA373' }}>
                {repurposedItems.length} formats ready
              </span>
            )}
          </div>
          {repurposedItems.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate('content-studio')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  background: '#181715', border: '1px solid #252320', borderRadius: 6,
                  color: '#C4B89A', fontSize: 12, cursor: 'pointer',
                }}
              >
                View in Content Studio →
              </button>
              <button
                onClick={() => navigate('human-approval')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  background: '#181715', border: '1px solid #252320', borderRadius: 6,
                  color: '#5BA373', fontSize: 12, cursor: 'pointer',
                }}
              >
                Human Review Queue →
              </button>
            </div>
          )}
        </div>

        {repurposedItems.length === 0 && !repurposing ? (
          <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(196,129,58,0.1)', border: '1px solid rgba(196,129,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#C4813A' }}>
              <SparkleIcon size={20} />
            </div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
              No Derivative Assets Generated Yet
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.5 }}>
              Choose a source hero asset above and click "Generate Derivatives" to automatically produce bespoke multi-platform versions.
            </p>
            <button
              onClick={handleRepurpose}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                background: '#1C1B19', border: '1px solid #2F2C28', color: '#EDE8DF',
                borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}
            >
              <SparkleIcon size={12} style={{ color: '#C4813A' }} /> Run Initial Repurposing
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20 }}>
            {repurposedItems.map(item => {
              const platformMeta = TARGET_PLATFORMS.find(p => p.id === item.platform) || {
                name: item.platform,
                formatLabel: item.content_type,
                color: '#C4813A',
                iconBadge: item.platform.slice(0, 2).toUpperCase(),
              }
              const audit = auditResults[item.id]
              const isAuditing = auditingIds[item.id]
              const isRegenerating = regeneratingPlatform === item.platform

              return (
                <div
                  key={item.id || item.platform}
                  style={{
                    ...S.card,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderLeft: `3px solid ${platformMeta.color}`,
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600, color: platformMeta.color }}>
                          {platformMeta.name.toUpperCase()}
                        </span>
                        <span style={{ color: '#3A3830' }}>•</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                          {platformMeta.formatLabel}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleRegeneratePlatform(item.platform)}
                          disabled={isRegenerating}
                          title="Regenerate this platform version"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                            background: '#181715', border: '1px solid #252320', borderRadius: 4,
                            color: '#8C857B', fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          <RefreshIcon size={11} className={isRegenerating ? 'animate-spin' : ''} />
                          {isRegenerating ? 'Adapting...' : 'Regenerate'}
                        </button>
                        <button
                          onClick={() => handleCopy(`${item.title ? item.title + '\n\n' : ''}${item.hook ? item.hook + '\n\n' : ''}${item.body}\n\n${item.call_to_action || ''}`, item.id || item.platform)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                            background: copiedKey === (item.id || item.platform) ? 'rgba(91,163,115,0.15)' : '#181715',
                            border: `1px solid ${copiedKey === (item.id || item.platform) ? '#5BA373' : '#252320'}`,
                            borderRadius: 4,
                            color: copiedKey === (item.id || item.platform) ? '#5BA373' : '#8C857B',
                            fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          {copiedKey === (item.id || item.platform) ? (
                            <>
                              <CheckIcon size={11} /> Copied!
                            </>
                          ) : (
                            <>
                              <CopyIcon size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Title / Concept */}
                    <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF', marginBottom: 12, fontWeight: 400 }}>
                      {item.title}
                    </div>

                    {/* Hook Snippet */}
                    {item.hook && (
                      <div style={{ padding: '10px 12px', background: 'rgba(196,129,58,0.06)', borderLeft: '2px solid #C4813A', borderRadius: 4, marginBottom: 12 }}>
                        <div style={{ ...S.label, fontSize: 8, color: '#C4813A', marginBottom: 3 }}>OPENING HOOK</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#EDE8DF', fontStyle: 'italic' }}>
                          "{item.hook}"
                        </div>
                      </div>
                    )}

                    {/* Body */}
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#A0988E', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 14, maxHeight: 220, overflowY: 'auto' }}>
                      {item.body}
                    </div>

                    {/* CTA */}
                    {item.call_to_action && (
                      <div style={{ padding: '8px 12px', background: '#141312', border: '1px solid #1C1B19', borderRadius: 4, marginBottom: 10 }}>
                        <div style={{ ...S.label, fontSize: 8, marginBottom: 2 }}>CALL TO ACTION</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A' }}>
                          {item.call_to_action}
                        </div>
                      </div>
                    )}

                    {/* Visual Art Direction / Video Cues */}
                    {item.visual_concept && (
                      <div style={{ padding: '8px 12px', background: '#141312', border: '1px solid #1C1B19', borderRadius: 4, marginBottom: 12 }}>
                        <div style={{ ...S.label, fontSize: 8, marginBottom: 2 }}>ART DIRECTION / VISUAL CONCEPT</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B6560', lineHeight: 1.4 }}>
                          {item.visual_concept}
                        </div>
                      </div>
                    )}

                    {/* Inline BrandGuard Audit Findings */}
                    {audit && (
                      <div style={{ padding: '10px 12px', background: audit.overall_status === 'pass' ? 'rgba(91,163,115,0.08)' : 'rgba(196,129,58,0.08)', border: `1px solid ${audit.overall_status === 'pass' ? 'rgba(91,163,115,0.3)' : 'rgba(196,129,58,0.3)'}`, borderRadius: 6, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: audit.overall_status === 'pass' ? '#5BA373' : '#C4813A', textTransform: 'uppercase' }}>
                            BrandGuard Audit: {audit.overall_status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: '#6B6560' }}>
                            {audit.findings?.length || 0} checks
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#EDE8DF', lineHeight: 1.4 }}>
                          {audit.summary || 'Content verified against Brand DNA rules and ClaimGuard verification matrix.'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #1C1B19', marginTop: 10 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                      {item.body.length} chars · ~{Math.ceil(item.body.split(/\s+/).length / 130)} min
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleAuditItem(item)}
                        disabled={isAuditing}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                          background: 'rgba(196,129,58,0.1)', border: '1px solid rgba(196,129,58,0.3)',
                          borderRadius: 4, color: '#C4813A', fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        <ShieldIcon size={11} /> {isAuditing ? 'Auditing...' : 'Audit BrandGuard'}
                      </button>

                      <button
                        onClick={() => {
                          if (onContentSelected) {
                            onContentSelected(item.id)
                          } else if (typeof window !== 'undefined') {
                            localStorage.setItem('brandforge_active_content_id', item.id)
                          }
                          navigate('human-approval')
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                          background: '#181715', border: '1px solid #252320', borderRadius: 4,
                          color: '#EDE8DF', fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        <CheckIcon size={11} style={{ color: '#5BA373' }} /> Review →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
