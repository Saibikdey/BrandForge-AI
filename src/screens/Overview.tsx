import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { SparkleIcon, ArrowRightIcon, CheckIcon, ShieldCheckIcon } from '../components/Icons'
import { api } from '../services/api'
import type { GlobalAnalyticsResponse } from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
}

export default function Overview({ navigate }: Props) {
  const [analytics, setAnalytics] = useState<GlobalAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true)
        const data = await api.getAnalytics()
        setAnalytics(data)
      } catch (e) {
        console.warn('Failed to load overview analytics:', e)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  const topRec = analytics?.recommendations && analytics.recommendations.length > 0 ? analytics.recommendations[0] : null

  return (
    <div style={{ padding: '48px 48px', maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B6560' }}>
          EXECUTIVE DASHBOARD · CONTINUOUS OPTIMIZATION
        </div>
        <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 300, color: '#EDE8DF', margin: '8px 0 8px', letterSpacing: '-0.03em' }}>
          BrandForge AI Control Center
        </h1>
        <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 650, lineHeight: 1.5 }}>
          Orchestrate brand-aware marketing campaigns, enforce BrandGuard & ClaimGuard compliance, schedule publishing, and continuously optimize results.
        </p>
      </div>

      {/* Primary Workflow Pipeline Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div
          onClick={() => navigate('brand-dna')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>STEP 01</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5BA373' }}>82% COMPLETE</span>
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 6px' }}>Brand DNA</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
            Knowledge base extracted from guidelines, website, and voice rules.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4813A', fontSize: 11.5, fontWeight: 500 }}>
            Configure Brand DNA <ArrowRightIcon size={11} />
          </div>
        </div>

        <div
          onClick={() => navigate('create-campaign')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>STEP 02</span>
            <SparkleIcon size={12} style={{ color: '#C4813A' }} />
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 6px' }}>Create Campaign</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
            Define objectives, audience, and platforms for AI generation.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4813A', fontSize: 11.5, fontWeight: 500 }}>
            Build New Campaign <ArrowRightIcon size={11} />
          </div>
        </div>

        <div
          onClick={() => navigate('campaign-strategy')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>STEP 03</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5B9BC4' }}>3 STRATEGIES</span>
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 6px' }}>Campaign Strategy</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
            Review Product-Led, Story-Led, and Community-Led strategic angles.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4813A', fontSize: 11.5, fontWeight: 500 }}>
            View Strategies <ArrowRightIcon size={11} />
          </div>
        </div>

        <div
          onClick={() => navigate('campaign-calendar')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#5B9BC4')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5B9BC4', letterSpacing: '0.1em' }}>STEP 04</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5BA373' }}>PUBLISHING</span>
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: '0 0 6px' }}>Campaign Calendar</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B6560', margin: '0 0 14px', lineHeight: 1.5 }}>
            Multi-channel scheduling and publishing execution queue.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5B9BC4', fontSize: 11.5, fontWeight: 500 }}>
            Open Calendar Queue <ArrowRightIcon size={11} />
          </div>
        </div>
      </div>

      {/* Performance Snapshot & Continuous Optimization Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Performance Snapshot Card */}
        <div
          onClick={() => navigate('analytics')}
          style={{
            background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 24,
            cursor: 'pointer', transition: 'border-color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>
              PERFORMANCE SNAPSHOT
            </span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#5BA373', padding: '2px 6px', background: 'rgba(91,163,115,0.15)', borderRadius: 3 }}>
              DEMO ANALYTICS
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B6560' }}>REACH</div>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF' }}>
                {analytics?.kpis.total_reach ? analytics.kpis.total_reach.toLocaleString() : '8,800'}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B6560' }}>ENGAGEMENT</div>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#C4813A' }}>
                {analytics?.kpis.avg_engagement_rate ? `${analytics.kpis.avg_engagement_rate}%` : '6.4%'}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B6560' }}>CLICKS</div>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#5B9BC4' }}>
                {analytics?.kpis.total_clicks ? analytics.kpis.total_clicks.toLocaleString() : '320'}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B6560' }}>CONVERSIONS</div>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#5BA373' }}>
                {analytics?.kpis.total_conversions ? analytics.kpis.total_conversions.toLocaleString() : '44'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4813A', fontSize: 12, fontWeight: 500 }}>
            View Full Omnichannel Analytics <ArrowRightIcon size={12} />
          </div>
        </div>

        {/* Optimization Insight Card */}
        <div
          onClick={() => navigate('analytics')}
          style={{
            background: 'linear-gradient(180deg, #141312 0%, #0D0C0B 100%)',
            border: '1px solid rgba(196,129,58,0.3)', borderRadius: 8, padding: 24,
            cursor: 'pointer', transition: 'border-color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(196,129,58,0.3)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.1em' }}>
              CONTINUOUS OPTIMIZATION INSIGHT
            </span>
            <SparkleIcon size={13} style={{ color: '#C4813A' }} />
          </div>

          <h4 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, color: '#EDE8DF', margin: '0 0 6px', fontWeight: 400 }}>
            {topRec?.title || 'Story-Led Narrative Outperformance'}
          </h4>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#8C857B', margin: '0 0 14px', lineHeight: 1.5 }}>
            {topRec?.recommendation || 'Story-Led assets generated a 6.2% average engagement rate. Consider testing another Story-Led direction in your next campaign.'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4813A', fontSize: 12, fontWeight: 500 }}>
            View Continuous Learnings <ArrowRightIcon size={12} />
          </div>
        </div>
      </div>

      {/* Secondary Row: Governance & Intelligence */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div
          onClick={() => navigate('campaign-memory')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 24, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#5BA373')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5BA373', letterSpacing: '0.1em' }}>CONTINUOUS LEARNING</span>
            <SparkleIcon size={14} style={{ color: '#5BA373' }} />
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '0 0 8px' }}>Campaign Memory</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', margin: '0 0 16px', lineHeight: 1.5 }}>
            Synthesizes past campaign strategies, claim risks, and reviewer approvals into explainable recommendations.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5BA373', fontSize: 12, fontWeight: 500 }}>
            Explore Memory Intelligence <ArrowRightIcon size={12} />
          </div>
        </div>

        <div
          onClick={() => navigate('brand-guard')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 24, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#E5A93C')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#E5A93C', letterSpacing: '0.1em' }}>GOVERNANCE</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#E5A93C' }}>BRAND & CLAIMS</span>
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '0 0 8px' }}>BrandGuard</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', margin: '0 0 16px', lineHeight: 1.5 }}>
            Automated verification against Brand DNA and strict claim substantiation rules.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#E5A93C', fontSize: 12, fontWeight: 500 }}>
            View Policy Compliance <ArrowRightIcon size={12} />
          </div>
        </div>

        <div
          onClick={() => navigate('human-approval')}
          style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 24, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#A78BFA')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#A78BFA', letterSpacing: '0.1em' }}>APPROVAL WORKFLOW</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#A78BFA' }}>EDITORIAL QUEUE</span>
          </div>
          <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF', margin: '0 0 8px' }}>Human Approval</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', margin: '0 0 16px', lineHeight: 1.5 }}>
            Review, revise, approve, or reject generated content with full revision history.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A78BFA', fontSize: 12, fontWeight: 500 }}>
            Open Approval Queue <ArrowRightIcon size={12} />
          </div>
        </div>
      </div>
    </div>
  )
}
