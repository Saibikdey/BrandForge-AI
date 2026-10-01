import React from 'react'
import type { Screen } from '../App'

interface SidebarProps {
  screen: Screen
  navigate: (s: Screen) => void
  mobileOpen: boolean
  onClose: () => void
}

interface NavItem {
  id: Screen
  label: string
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'FOUNDATION',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'brand-dna', label: 'Brand DNA', badge: '82%' },
    ],
  },
  {
    title: 'CAMPAIGNS',
    items: [
      { id: 'campaigns', label: 'All Campaigns' },
      { id: 'create-campaign', label: 'Create Campaign' },
      { id: 'campaign-strategy', label: 'Campaign Strategy' },
    ],
  },
  {
    title: 'STUDIO & GOVERNANCE',
    items: [
      { id: 'content-studio', label: 'Content Studio' },
      { id: 'content-repurposing', label: 'Repurposing' },
      { id: 'brand-guard', label: 'BrandGuard' },
      { id: 'human-approval', label: 'Approvals' },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { id: 'campaign-memory', label: 'Memory & Learnings' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'campaign-calendar', label: 'Calendar' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [{ id: 'settings', label: 'Settings' }],
  },
]

export default function Sidebar({ screen, navigate, mobileOpen, onClose }: SidebarProps) {
  return (
    <aside
      style={{
        width: 260,
        height: '100vh',
        background: '#0D0C0B',
        borderRight: '1px solid #1C1B19',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 50,
        transition: 'transform 0.2s ease',
      }}
      className={`fixed lg:static top-0 left-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid #1C1B19',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #C4813A 0%, #8A521E 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A0908',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'Fraunces, Georgia, serif',
            }}
          >
            B
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: 16,
                fontWeight: 400,
                color: '#EDE8DF',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              BrandForge <span style={{ color: '#C4813A', fontSize: 13, fontFamily: 'DM Mono, monospace' }}>AI</span>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#6B6560', marginTop: 2 }}>
              ARKIVA SUITE
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden"
          style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', fontSize: 18 }}
        >
          ✕
        </button>
      </div>

      {/* Navigation Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 12px' }}>
        {navSections.map(section => (
          <div key={section.title} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 9,
                letterSpacing: '0.12em',
                color: '#3A3830',
                padding: '0 12px',
                marginBottom: 8,
              }}
            >
              {section.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map(item => {
                const isActive = screen === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: isActive ? '#1E1D1B' : 'transparent',
                      border: 'none',
                      color: isActive ? '#EDE8DF' : '#8C857B',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#EDE8DF'
                        e.currentTarget.style.background = '#141312'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#8C857B'
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isActive && (
                        <div
                          style={{
                            width: 3,
                            height: 14,
                            background: '#C4813A',
                            borderRadius: 2,
                            position: 'absolute',
                            left: 2,
                          }}
                        />
                      )}
                      <span style={{ paddingLeft: isActive ? 4 : 0 }}>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isActive ? 'rgba(196,129,58,0.15)' : '#181715',
                          color: '#C4813A',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Profile */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #1C1B19',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#252320',
            border: '1px solid #3A3830',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#C4813A',
            fontSize: 12,
            fontFamily: 'DM Mono, monospace',
          }}
        >
          AS
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              color: '#EDE8DF',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            Arkiva Studio
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5BA373' }}>
            ● Engine Online
          </div>
        </div>
      </div>
    </aside>
  )
}
