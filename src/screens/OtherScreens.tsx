import type { Screen } from '../App'

interface Props { navigate: (s: Screen) => void }

function ScreenPlaceholder({ title, description, badge }: { title: string; description: string; badge?: string }) {
  return (
    <div style={{ padding: '48px 48px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3A3830' }}>
          {badge || 'Milestone Module'}
        </div>
        <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 300, color: '#EDE8DF', margin: '10px 0 8px', letterSpacing: '-0.03em' }}>
          {title}
        </h1>
        <p style={{ color: '#6B6560', fontSize: 14, margin: 0 }}>{description}</p>
      </div>
      <div style={{ background: '#111110', border: '1px solid #252320', borderRadius: 8, padding: 48, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#C4B89A', marginBottom: 8 }}>
          Module Scheduled for Subsequent Milestone
        </div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 500, margin: '0 auto' }}>
          This screen will be activated in upcoming development phases following the Brand DNA and Campaign Strategy pipeline.
        </p>
      </div>
    </div>
  )
}

export function CampaignsScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="All Campaigns" description="View and manage active, scheduled, and past marketing campaigns." badge="Campaigns" />
}

export function ContentStudioScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="Content Studio" description="AI generation and editing of multi-platform copy, graphics, and scripts." badge="Studio" />
}

export function ContentRepurposingScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="Content Repurposing" description="Transform hero content into derivative snippets and multi-channel assets." badge="Repurposing" />
}

export function BrandGuardScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="BrandGuard Audit" description="Automated policy compliance, brand voice verification, and claim checking." badge="Governance" />
}

export function HumanApprovalScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="Human Approval Queue" description="Review, edit, reject, and approve AI-generated campaign artifacts." badge="Approvals" />
}

export function CampaignMemoryScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="Campaign Memory" description="Semantic vector store of past creative successes, tone learnings, and audience reactions." badge="Intelligence" />
}

export function AnalyticsScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="Performance Analytics" description="Engagement, conversion, and brand consistency metrics across channels." badge="Analytics" />
}

export function CampaignCalendarScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="Campaign Calendar" description="Omnichannel publication schedule and content rollout timeline." badge="Calendar" />
}

export function SettingsScreen({ navigate }: Props) {
  return <ScreenPlaceholder title="System Settings" description="Configure API keys, database connections, and workspace preferences." badge="System" />
}
