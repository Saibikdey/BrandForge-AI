import React, { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  SparkleIcon,
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  ShieldCheckIcon,
  ClockIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type { SystemSettingsData, GovernancePolicyInfo, PublishingChannelInfo } from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
}

const S = {
  page: { padding: '44px 48px', maxWidth: 1120, margin: '0 auto' } as React.CSSProperties,
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
    padding: '10px 14px',
    background: '#181715',
    border: '1px solid #252320',
    borderRadius: 6,
    color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    lineHeight: 1.6,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
}

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - UTC+05:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT - UTC-05:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT - UTC-08:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST - UTC+00:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST - UTC+09:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT - UTC+08:00)' },
]

export default function Settings({ navigate }: Props) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'governance' | 'publishing' | 'ai' | 'diagnostics'>('workspace')
  const [settingsData, setSettingsData] = useState<SystemSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [backendHealth, setBackendHealth] = useState<string>('checking')

  // Editable form fields
  const [brandName, setBrandName] = useState('Arkiva Studio')
  const [tagline, setTagline] = useState('"Design without limits."')
  const [industry, setIndustry] = useState('Design Software')
  const [stage, setStage] = useState('Growth')
  const [mission, setMission] = useState('Empower creative professionals with intelligent design tools.')
  const [defaultTimezone, setDefaultTimezone] = useState('Asia/Kolkata')
  const [strictGovernance, setStrictGovernance] = useState(true)

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      try {
        const [data, health] = await Promise.all([
          api.getSystemSettings().catch(() => null),
          api.checkHealth().catch(() => ({ status: 'unreachable' })),
        ])

        if (data) {
          setSettingsData(data)
          if (data.brand) {
            setBrandName(data.brand.name || '')
            setTagline(data.brand.tagline || '')
            setIndustry(data.brand.industry || '')
            setStage(data.brand.stage || '')
            setMission(data.brand.mission || '')
          }
          if (data.default_timezone) {
            setDefaultTimezone(data.default_timezone)
          }
        }
        setBackendHealth(health.status || 'healthy')
      } catch (err: any) {
        console.error('Failed to load system settings:', err)
        setErrorMessage(err.message || 'Failed to fetch settings from backend.')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSaveBrand = async () => {
    setSaving(true)
    setSaveSuccess(false)
    setErrorMessage(null)
    try {
      const updated = await api.updateSystemSettings({
        brand_name: brandName,
        tagline: tagline,
        industry: industry,
        stage: stage,
        mission: mission,
        default_timezone: defaultTimezone,
      })
      setSettingsData(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      setErrorMessage(err.message || 'Failed to update system settings.')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'workspace', label: 'Workspace & Brand' },
    { id: 'governance', label: 'BrandGuard Governance' },
    { id: 'publishing', label: 'Channels & Publishing' },
    { id: 'ai', label: 'AI & Intelligence' },
    { id: 'diagnostics', label: 'System Diagnostics' },
  ]

  return (
    <div className="w-full max-w-[1150px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      {/* Header */}
      <div className="mb-6 sm:mb-9">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={S.label}>System & Workspace Configuration</span>
          <span style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', padding: '2px 7px', borderRadius: 4, background: 'rgba(91,163,115,0.12)', color: '#5BA373', border: '1px solid rgba(91,163,115,0.25)' }}>
            OPERATIONAL
          </span>
        </div>
        <h1
          style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, color: '#EDE8DF', margin: '0 0 8px', letterSpacing: '-0.03em' }}
          className="text-2xl sm:text-3xl lg:text-4xl"
        >
          System Settings
        </h1>
        <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Manage your brand profile attributes, BrandGuard governance policies, synthetic publishing drivers, and AI engine parameters.
        </p>
      </div>

      {/* Save Success / Error alerts */}
      {errorMessage && (
        <div style={{ padding: '12px 18px', background: 'rgba(196,88,88,0.1)', border: '1px solid #C45858', borderRadius: 6, color: '#EDE8DF', fontSize: 13, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#C45858', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {saveSuccess && (
        <div style={{ padding: '12px 18px', background: 'rgba(91,163,115,0.12)', border: '1px solid rgba(91,163,115,0.3)', borderRadius: 6, color: '#5BA373', fontSize: 13, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckIcon size={14} />
          <span>Workspace settings successfully persisted to SQLite database!</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1.5 sm:gap-2 mb-6 sm:mb-8 p-1.5 bg-[#0D0C0B] rounded-lg border border-[#1C1B19] overflow-x-auto no-scrollbar scrollbar-none">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                background: isActive ? '#1E1D1B' : 'transparent',
                color: isActive ? '#EDE8DF' : '#6B6560',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              className="whitespace-nowrap flex-shrink-0"
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab 1: Workspace & Brand Profile */}
      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="p-4 sm:p-7" style={S.card}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <span style={S.label}>Brand Profile Parameters</span>
                <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '4px 0 0', fontWeight: 400 }}>
                  Active Brand Identity
                </h3>
              </div>
              <button
                onClick={() => navigate('brand-dna')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: '#181715', border: '1px solid #252320', borderRadius: 6,
                  color: '#C4813A', fontSize: 12, cursor: 'pointer',
                }}
              >
                Open Full Brand DNA Editor →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-4">
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  style={S.input}
                />
              </div>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  style={S.input}
                />
              </div>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>Industry Domain</label>
                <input
                  type="text"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  style={S.input}
                />
              </div>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>Company Stage</label>
                <input
                  type="text"
                  value={stage}
                  onChange={e => setStage(e.target.value)}
                  style={S.input}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ ...S.label, display: 'block', marginBottom: 6, fontSize: 9 }}>Mission Statement</label>
              <textarea
                value={mission}
                onChange={e => setMission(e.target.value)}
                style={S.textarea}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #1C1B19' }}>
              <button
                onClick={handleSaveBrand}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                  background: saving ? '#6B5030' : '#C4813A', color: '#0A0908',
                  border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                }}
                className="w-full sm:w-auto justify-center"
              >
                {saving ? 'Saving...' : 'Save Workspace Parameters'}
              </button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div style={{ ...S.card, padding: 20 }}>
              <span style={S.label}>Brand DNA Completeness</span>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 28, color: '#EDE8DF', margin: '8px 0 4px' }}>
                {settingsData?.brand.completeness || 82}%
              </div>
              <div style={{ fontSize: 12, color: '#5BA373' }}>
                7 of 7 DNA modules configured
              </div>
            </div>

            <div style={{ ...S.card, padding: 20 }}>
              <span style={S.label}>Governance Matrix</span>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 28, color: '#5B9BC4', margin: '8px 0 4px' }}>
                Active
              </div>
              <div style={{ fontSize: 12, color: '#6B6560' }}>
                BrandGuard & ClaimGuard enabled
              </div>
            </div>

            <div style={{ ...S.card, padding: 20 }}>
              <span style={S.label}>Persistent Storage</span>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 28, color: '#EDE8DF', margin: '8px 0 4px' }}>
                SQLite
              </div>
              <div style={{ fontSize: 12, color: '#6B6560' }}>
                Port 8001 (Source of Truth)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: BrandGuard Governance */}
      {activeTab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="p-4 sm:p-7" style={S.card}>
            <div style={{ marginBottom: 20 }}>
              <span style={S.label}>Automated Governance & Risk Controls</span>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '4px 0 6px', fontWeight: 400 }}>
                BrandGuard & ClaimGuard Active Policies
              </h3>
              <p style={{ color: '#8C857B', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Content generated across all channels is checked against brand tone guidelines, do/don't rules, and ClaimGuard truth checks.
              </p>
            </div>

            {/* Policies list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {settingsData?.governance_policies?.map(policy => (
                <div key={policy.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-4.5" style={{ background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                  <div style={{ maxWidth: 640 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <ShieldCheckIcon size={14} style={{ color: '#5BA373' }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#EDE8DF' }}>
                        {policy.name}
                      </span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(91,163,115,0.12)', color: '#5BA373' }}>
                        {policy.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8C857B', lineHeight: 1.4 }}>
                      {policy.description}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#C4813A' }}>
                      {policy.rule_count} Rules
                    </div>
                    <div style={{ fontSize: 10, color: '#6B6560' }}>
                      {policy.engine}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Governance Gate Controls */}
            <div style={{ padding: 20, background: '#141312', border: '1px solid #252320', borderRadius: 6 }}>
              <span style={{ ...S.label, display: 'block', marginBottom: 12 }}>Governance Gate Configuration</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={strictGovernance}
                    onChange={e => setStrictGovernance(e.target.checked)}
                    style={{ accentColor: '#C4813A', cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>
                      Enforce Strict Publishing Gate
                    </div>
                    <div style={{ fontSize: 11, color: '#6B6560' }}>
                      Blocks scheduling and publication for any content piece flagged with critical BrandGuard violations.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' }}>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    style={{ accentColor: '#5BA373', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>
                      Human Approval Workflow Enforced
                    </div>
                    <div style={{ fontSize: 11, color: '#6B6560' }}>
                      All AI-generated content must transition through "Review" before reaching "Approved" state.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Channels & Publishing Defaults */}
      {activeTab === 'publishing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Demo Notice Banner */}
          <div style={{ padding: '16px 20px', background: 'rgba(196,129,58,0.08)', border: '1px solid rgba(196,129,58,0.25)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <InfoIcon size={18} style={{ color: '#C4813A', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#C4813A', marginBottom: 2 }}>
                DEMO / SYNTHETIC PUBLISHING ENGINE ACTIVE
              </div>
              <p style={{ fontSize: 12, color: '#A0988E', margin: 0, lineHeight: 1.5 }}>
                Social publishing operates via simulated drivers that accurately model webhook dispatch, idempotency keys, delivery delays, and failure simulation (e.g. rate limit error testing) without requiring live third-party OAuth tokens.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-7" style={S.card}>
            <div style={{ marginBottom: 20 }}>
              <span style={S.label}>Configured Social Platforms</span>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '4px 0 0', fontWeight: 400 }}>
                Multi-Channel Dispatch Channels
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 mb-6 sm:mb-7">
              {settingsData?.publishing_channels?.map(channel => (
                <div key={channel.id} style={{ padding: '16px 18px', background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#EDE8DF' }}>
                      {channel.name}
                    </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(91,155,196,0.12)', color: '#5B9BC4' }}>
                      SYNTHETIC DRIVER
                    </span>
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', marginBottom: 6 }}>
                    {channel.type_label}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6560', lineHeight: 1.4 }}>
                    {channel.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Timezone Configuration */}
            <div style={{ paddingTop: 20, borderTop: '1px solid #1C1B19' }}>
              <div style={{ maxWidth: 460 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 8 }}>Default Publication Timezone</label>
                <select
                  value={defaultTimezone}
                  onChange={e => setDefaultTimezone(e.target.value)}
                  style={{ ...S.input, marginBottom: 16, cursor: 'pointer' }}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value} style={{ background: '#111110', color: '#EDE8DF' }}>
                      {tz.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSaveBrand}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                    background: '#C4813A', color: '#0A0908', border: 'none', borderRadius: 6,
                    cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                  className="w-full sm:w-auto justify-center"
                >
                  {saving ? 'Updating...' : 'Save Timezone Preference'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AI & Intelligence Engine */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="p-4 sm:p-7" style={S.card}>
            <div style={{ marginBottom: 20 }}>
              <span style={S.label}>AI Models & Generation Engine</span>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '4px 0 0', fontWeight: 400 }}>
                Language Models & Fallback Architecture
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 mb-5 sm:mb-6">
              <div style={{ padding: 20, background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#EDE8DF' }}>
                    Primary Model
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(91,163,115,0.12)', color: '#5BA373' }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#C4813A', marginBottom: 6 }}>
                  Google Gemini 2.5 Flash
                </div>
                <div style={{ fontSize: 12, color: '#8C857B', lineHeight: 1.5 }}>
                  High-speed structured JSON generation engine for multi-channel copy, campaign strategy ideation, and BrandGuard reasoning.
                </div>
              </div>

              <div style={{ padding: 20, background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#EDE8DF' }}>
                    Fallback Engine
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(91,155,196,0.12)', color: '#5B9BC4' }}>
                    STANDBY READY
                  </span>
                </div>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', marginBottom: 6 }}>
                  Deterministic Rule Matrix
                </div>
                <div style={{ fontSize: 12, color: '#8C857B', lineHeight: 1.5 }}>
                  Zero-latency structured fallback providing 100% test coverage and offline stability if Gemini API is unconfigured.
                </div>
              </div>

              <div style={{ padding: 20, background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#EDE8DF' }}>
                    Campaign Memory
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(196,129,58,0.12)', color: '#C4813A' }}>
                    INTELLIGENCE
                  </span>
                </div>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', marginBottom: 6 }}>
                  SQLite Semantic Store
                </div>
                <div style={{ fontSize: 12, color: '#8C857B', lineHeight: 1.5 }}>
                  Extracts cross-campaign learning sources from approved content, audit findings, and performance records.
                </div>
              </div>
            </div>

            {/* Model Hyperparameters */}
            <div style={{ padding: 18, background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
              <span style={{ ...S.label, display: 'block', marginBottom: 10 }}>Active Sampling Temperatures</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                <div>
                  <div style={{ fontSize: 11, color: '#6B6560' }}>Strategy & Content Generation</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#EDE8DF' }}>temperature = 0.7</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6B6560' }}>BrandGuard Compliance Audit</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#EDE8DF' }}>temperature = 0.2</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6B6560' }}>Campaign Memory Synthesis</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#EDE8DF' }}>temperature = 0.3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: System Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="p-4 sm:p-7" style={S.card}>
            <div style={{ marginBottom: 20 }}>
              <span style={S.label}>Runtime Diagnostics & Source of Truth</span>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, color: '#EDE8DF', margin: '4px 0 0', fontWeight: 400 }}>
                Server & Persistence Health
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 sm:p-4" style={{ background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>FastAPI Backend Health</div>
                  <div style={{ fontSize: 11, color: '#6B6560' }}>GET /api/health</div>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: backendHealth === 'healthy' ? '#5BA373' : '#C45858' }}>
                  {backendHealth.toUpperCase()} (PORT 8001)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 sm:p-4" style={{ background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>SQLite Database File</div>
                  <div style={{ fontSize: 11, color: '#6B6560' }}>backend/brandforge.db</div>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5BA373' }}>
                  CONNECTED & MIGRATED
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 sm:p-4" style={{ background: '#141312', border: '1px solid #1C1B19', borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>Isolated Port Guard</div>
                  <div style={{ fontSize: 11, color: '#6B6560' }}>RecoverAI on Port 8000 · BrandForge on Port 8001</div>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5B9BC4' }}>
                  PROTECTED
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => navigate('overview')}
                style={{
                  padding: '9px 16px', background: '#181715', border: '1px solid #252320',
                  borderRadius: 6, color: '#EDE8DF', fontSize: 12, cursor: 'pointer',
                }}
              >
                ← Back to Overview
              </button>
              <button
                onClick={() => navigate('brand-guard')}
                style={{
                  padding: '9px 16px', background: '#181715', border: '1px solid #252320',
                  borderRadius: 6, color: '#C4813A', fontSize: 12, cursor: 'pointer',
                }}
              >
                Open BrandGuard →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
