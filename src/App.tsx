import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import { MenuIcon } from './components/Icons'
import { api } from './services/api'
import Overview from './screens/Overview'
import BrandDNA from './screens/BrandDNA'
import Campaigns from './screens/Campaigns'
import CreateCampaign from './screens/CreateCampaign'
import CampaignStrategy from './screens/CampaignStrategy'
import ContentStudio from './screens/ContentStudio'
import ContentRepurposing from './screens/ContentRepurposing'
import BrandGuard from './screens/BrandGuard'
import HumanApproval from './screens/HumanApproval'
import CampaignMemory from './screens/CampaignMemory'
import Analytics from './screens/Analytics'
import CampaignCalendar from './screens/CampaignCalendar'
import Settings from './screens/Settings'

export type Screen =
  | 'overview'
  | 'brand-dna'
  | 'campaigns'
  | 'create-campaign'
  | 'campaign-strategy'
  | 'content-studio'
  | 'content-repurposing'
  | 'brand-guard'
  | 'human-approval'
  | 'campaign-memory'
  | 'analytics'
  | 'campaign-calendar'
  | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brandforge_current_screen') as Screen
      if (saved) return saved
    }
    return 'overview'
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('brandforge_active_campaign_id')
    }
    return null
  })
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('brandforge_active_strategy_id')
    }
    return null
  })
  const [activeContentId, setActiveContentId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('brandforge_active_content_id')
    }
    return null
  })

  // Auto-discover latest campaign from backend if not yet set in session
  useEffect(() => {
    async function initCampaign() {
      if (!activeCampaignId) {
        try {
          const list = await api.getCampaigns()
          if (list && list.length > 0) {
            setActiveCampaignId(list[0].id)
            if (typeof window !== 'undefined') {
              localStorage.setItem('brandforge_active_campaign_id', list[0].id)
            }
          }
        } catch (err) {
          console.error('Failed to auto-discover active campaign:', err)
        }
      }
    }
    initCampaign()
  }, [activeCampaignId])

  const navigate = (s: Screen) => {
    setScreen(s)
    setMobileNavOpen(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_current_screen', s)
    }
    window.scrollTo(0, 0)
  }

  const handleCampaignCreated = (campaignId: string) => {
    setActiveCampaignId(campaignId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_campaign_id', campaignId)
    }
  }

  const handleStrategySelected = (strategyId: string) => {
    setActiveStrategyId(strategyId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_strategy_id', strategyId)
    }
  }

  const handleContentSelected = (contentId: string) => {
    setActiveContentId(contentId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_content_id', contentId)
    }
  }

  const renderScreen = () => {
    switch (screen) {
      case 'overview':
        return <Overview navigate={navigate} />
      case 'brand-dna':
        return <BrandDNA navigate={navigate} />
      case 'campaigns':
        return <Campaigns navigate={navigate} onCampaignSelected={handleCampaignCreated} />
      case 'create-campaign':
        return <CreateCampaign navigate={navigate} onCampaignCreated={handleCampaignCreated} />
      case 'campaign-strategy':
        return (
          <CampaignStrategy
            navigate={navigate}
            activeCampaignId={activeCampaignId}
            activeStrategyId={activeStrategyId}
            onStrategySelected={handleStrategySelected}
          />
        )
      case 'content-studio':
        return (
          <ContentStudio
            navigate={navigate}
            activeCampaignId={activeCampaignId}
            activeStrategyId={activeStrategyId}
            activeContentId={activeContentId}
            onStrategySelected={handleStrategySelected}
            onContentSelected={handleContentSelected}
          />
        )
      case 'content-repurposing':
        return (
          <ContentRepurposing
            navigate={navigate}
            activeCampaignId={activeCampaignId}
            activeStrategyId={activeStrategyId}
            activeContentId={activeContentId}
            onCampaignSelected={handleCampaignCreated}
            onContentSelected={handleContentSelected}
          />
        )

      case 'brand-guard':
        return (
          <BrandGuard
            navigate={navigate}
            activeCampaignId={activeCampaignId}
            activeStrategyId={activeStrategyId}
            activeContentId={activeContentId}
            onContentSelected={handleContentSelected}
          />
        )
      case 'human-approval':
        return (
          <HumanApproval
            navigate={navigate}
            activeCampaignId={activeCampaignId}
            activeStrategyId={activeStrategyId}
            activeContentId={activeContentId}
            onContentSelected={handleContentSelected}
            onStrategySelected={handleStrategySelected}
          />
        )

      case 'campaign-memory':
        return <CampaignMemory navigate={navigate} />
      case 'analytics':
        return <Analytics navigate={navigate} activeCampaignId={activeCampaignId} />
      case 'campaign-calendar':
        return <CampaignCalendar navigate={navigate} />
      case 'settings':
        return <Settings navigate={navigate} />
      default:
        return <Overview navigate={navigate} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#090908' }}>
      <Sidebar
        screen={screen}
        navigate={navigate}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 40,
          }}
          className="lg:hidden"
        />
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Mobile top bar */}
        <header
          className="flex lg:hidden"
          style={{
            alignItems: 'center',
            gap: 16,
            padding: '0 20px',
            height: 56,
            borderBottom: '1px solid #1C1B19',
            background: '#0D0C0B',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setMobileNavOpen(true)}
            style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', padding: 4 }}
          >
            <MenuIcon size={20} />
          </button>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 16,
              fontWeight: 500,
              color: '#EDE8DF',
              letterSpacing: '-0.02em',
            }}
          >
            BrandForge AI
          </div>
        </header>

        {/* Scrollable screen */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div key={screen} className="animate-fade-in">
            {renderScreen()}
          </div>
        </main>
      </div>
    </div>
  )
}
