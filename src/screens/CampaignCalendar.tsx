import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  SparkleIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  RefreshIcon,
  PlusIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  ContentSchedule,
  PublishingEvent,
  CalendarOverviewResponse,
  ScheduleStatus,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
}

const S = {
  page: { padding: '48px 48px', maxWidth: 1150, margin: '0 auto' } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#3A3830',
  },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
}

const platformColors: Record<string, string> = {
  instagram: '#C4813A',
  linkedin: '#5B9BC4',
  x: '#EDE8DF',
  youtube_shorts: '#C45858',
}

export default function CampaignCalendar({ navigate }: Props) {
  const [calendarData, setCalendarData] = useState<CalendarOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'month'>('list')
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  const [rescheduleItem, setRescheduleItem] = useState<ContentSchedule | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>('')
  const [rescheduleTime, setRescheduleTime] = useState<string>('19:00')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    loadCalendar()
  }, [platformFilter, statusFilter])

  async function loadCalendar() {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await api.getCalendar({
        platform: platformFilter === 'all' ? undefined : platformFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setCalendarData(data)
    } catch (err: any) {
      console.error('Failed to load calendar:', err)
      setErrorMessage(err.message || 'Failed to load publishing calendar.')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handlePublishDemo = async (scheduleId: string, simulateFailure = false) => {
    setPublishingId(scheduleId)
    try {
      const result = await api.publishDemo(scheduleId, simulateFailure)
      if (simulateFailure) {
        showToast(`Simulated provider failure triggered for ${result.platform.toUpperCase()}.`, 'error')
      } else {
        showToast(`Demo published successfully! Synthetic ID: ${result.external_post_id}`, 'success')
      }
      await loadCalendar()
    } catch (err: any) {
      console.error('Publishing failed:', err)
      showToast(err.message || 'Publishing failed', 'error')
      await loadCalendar()
    } finally {
      setPublishingId(null)
    }
  }

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled publication?')) return
    try {
      await api.cancelSchedule(scheduleId, 'User cancelled from calendar interface')
      showToast('Scheduled publication cancelled.', 'success')
      await loadCalendar()
    } catch (err: any) {
      console.error('Failed to cancel schedule:', err)
      showToast(err.message || 'Failed to cancel schedule.', 'error')
    }
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleItem || !rescheduleDate) return
    try {
      const combinedDateTime = new Date(`${rescheduleDate}T${rescheduleTime || '19:00'}:00`).toISOString()
      await api.updateSchedule(rescheduleItem.id, {
        scheduled_at: combinedDateTime,
        timezone: rescheduleItem.timezone,
      })
      showToast('Publication rescheduled successfully.', 'success')
      setRescheduleItem(null)
      await loadCalendar()
    } catch (err: any) {
      console.error('Failed to reschedule:', err)
      showToast(err.message || 'Failed to reschedule.', 'error')
    }
  }

  const formatScheduledTime = (isoString: string, tz: string) => {
    try {
      const date = new Date(isoString)
      const dateFormatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const timeFormatted = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      const tzAbbr = tz === 'Asia/Kolkata' ? 'IST' : tz
      return `${dateFormatted} · ${timeFormatted} ${tzAbbr}`
    } catch (e) {
      return `${isoString} (${tz})`
    }
  }

  const getStatusBadge = (status: ScheduleStatus, externalId?: string | null) => {
    switch (status) {
      case 'scheduled':
        return {
          label: 'SCHEDULED',
          color: '#5B9BC4',
          bg: 'rgba(91,155,196,0.12)',
          border: 'rgba(91,155,196,0.3)',
        }
      case 'publishing':
        return {
          label: 'PUBLISHING...',
          color: '#C4813A',
          bg: 'rgba(196,129,58,0.12)',
          border: 'rgba(196,129,58,0.3)',
        }
      case 'published':
        return {
          label: 'DEMO PUBLISHED',
          color: '#5BA373',
          bg: 'rgba(91,163,115,0.12)',
          border: 'rgba(91,163,115,0.3)',
          sub: externalId ? `ID: ${externalId}` : undefined,
        }
      case 'failed':
        return {
          label: 'FAILED',
          color: '#C45858',
          bg: 'rgba(196,88,88,0.12)',
          border: 'rgba(196,88,88,0.3)',
        }
      case 'cancelled':
        return {
          label: 'CANCELLED',
          color: '#6B6560',
          bg: 'rgba(107,101,96,0.12)',
          border: 'rgba(107,101,96,0.3)',
        }
      default:
        return {
          label: status.toUpperCase(),
          color: '#EDE8DF',
          bg: 'rgba(255,255,255,0.05)',
          border: '#252320',
        }
    }
  }

  const items = calendarData?.items || []

  return (
    <div style={S.page}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 100,
            padding: '12px 20px',
            background: toastMessage.type === 'success' ? '#14251B' : '#2A1313',
            border: `1px solid ${toastMessage.type === 'success' ? '#5BA373' : '#C45858'}`,
            borderRadius: 6,
            color: '#EDE8DF',
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {toastMessage.type === 'success' ? (
            <CheckIcon size={16} style={{ color: '#5BA373' }} />
          ) : (
            <AlertTriangleIcon size={16} style={{ color: '#C45858' }} />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ ...S.label, color: '#C4813A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClockIcon size={12} style={{ color: '#C4813A' }} />
            MULTI-CHANNEL PUBLISHING
          </div>
          <h1
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 34,
              fontWeight: 300,
              color: '#EDE8DF',
              margin: '8px 0 8px',
              letterSpacing: '-0.03em',
            }}
          >
            Campaign Calendar
          </h1>
          <p style={{ color: '#6B6560', fontSize: 13, margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
            Orchestrate publication rollouts across Instagram, LinkedIn, X, and YouTube Shorts. Only governance-verified and approved content enters the publishing queue.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={loadCalendar}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#161514',
              border: '1px solid #252320',
              borderRadius: 6,
              color: '#EDE8DF',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4813A')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#252320')}
          >
            <RefreshIcon size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={() => navigate('content-studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#C4813A',
              border: 'none',
              borderRadius: 6,
              color: '#0A0908',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <PlusIcon size={14} /> Schedule from Studio
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(196,88,88,0.1)',
            border: '1px solid #C45858',
            borderRadius: 6,
            color: '#EDE8DF',
            fontSize: 13,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangleIcon size={16} style={{ color: '#C45858' }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Summary Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div style={{ ...S.card, padding: '18px 20px', borderLeft: '3px solid #5B9BC4' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Scheduled Queue</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, color: '#5B9BC4' }}>
            {loading ? '—' : calendarData?.total_scheduled || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Pending publication execution
          </div>
        </div>

        <div style={{ ...S.card, padding: '18px 20px', borderLeft: '3px solid #5BA373' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Demo Published</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, color: '#5BA373' }}>
            {loading ? '—' : calendarData?.total_published || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Simulated external posts
          </div>
        </div>

        <div style={{ ...S.card, padding: '18px 20px', borderLeft: '3px solid #C45858' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Failed Attempts</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, color: '#C45858' }}>
            {loading ? '—' : calendarData?.total_failed || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Simulated provider errors
          </div>
        </div>

        <div style={{ ...S.card, padding: '18px 20px', borderLeft: '3px solid #6B6560' }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Cancelled / Revised</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, color: '#EDE8DF' }}>
            {loading ? '—' : calendarData?.total_cancelled || 0}
          </div>
          <div style={{ fontSize: 11, color: '#6B6560', marginTop: 4 }}>
            Invalidated by content revision
          </div>
        </div>
      </div>

      {/* Filter and View Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
          background: '#131211',
          border: '1px solid #201E1C',
          borderRadius: 8,
          marginBottom: 28,
        }}
      >
        {/* Platform Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560', textTransform: 'uppercase' }}>
            Platform:
          </span>
          {['all', 'instagram', 'linkedin', 'x', 'youtube_shorts'].map(p => {
            const active = platformFilter === p
            return (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 5,
                  background: active ? '#1F1D1A' : 'transparent',
                  border: `1px solid ${active ? '#C4813A' : 'transparent'}`,
                  color: active ? '#C4813A' : '#6B6560',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11.5,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  textTransform: 'capitalize',
                }}
              >
                {p === 'youtube_shorts' ? 'YouTube Shorts' : p}
              </button>
            )
          })}
        </div>

        {/* Status Filters & View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560', textTransform: 'uppercase' }}>
              Status:
            </span>
            {['all', 'scheduled', 'published', 'failed', 'cancelled'].map(st => {
              const active = statusFilter === st
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 5,
                    background: active ? '#1F1D1A' : 'transparent',
                    border: `1px solid ${active ? '#C4813A' : 'transparent'}`,
                    color: active ? '#C4813A' : '#6B6560',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11.5,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    textTransform: 'capitalize',
                  }}
                >
                  {st}
                </button>
              )
            })}
          </div>

          <div style={{ borderLeft: '1px solid #252320', paddingLeft: 12, display: 'flex', gap: 4 }}>
            {(['list', 'week', 'month'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  background: viewMode === v ? '#C4813A' : 'transparent',
                  color: viewMode === v ? '#0A0908' : '#6B6560',
                  border: 'none',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar Content Display */}
      {loading ? (
        <div style={{ ...S.card, padding: 48, textAlign: 'center' }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid rgba(196,129,58,0.2)',
              borderTop: '2px solid #C4813A',
              borderRadius: '50%',
              margin: '0 auto 16px',
            }}
            className="animate-spin"
          />
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560' }}>
            Loading publishing calendar & queue...
          </div>
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...S.card, padding: 56, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#C4B89A', marginBottom: 8 }}>
            Your publishing calendar is empty
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B6560', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
            No content matches the selected filters. Approve content in Content Studio or Human Approval and schedule it to build your campaign calendar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('content-studio')}
              style={{
                padding: '10px 20px',
                background: '#C4813A',
                border: 'none',
                borderRadius: 6,
                color: '#0A0908',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open Content Studio
            </button>
            <button
              onClick={() => navigate('human-approval')}
              style={{
                padding: '10px 20px',
                background: '#161514',
                border: '1px solid #252320',
                borderRadius: 6,
                color: '#EDE8DF',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Check Approval Queue
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map(item => {
            const statusBadge = getStatusBadge(item.status, item.external_post_id)
            const pColor = platformColors[item.platform] || '#C4813A'
            const isPublishing = publishingId === item.id
            const isHistoryOpen = historyOpenId === item.id

            return (
              <div
                key={item.id}
                style={{
                  ...S.card,
                  padding: 24,
                  borderLeft: `3px solid ${pColor}`,
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Header info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 10.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: pColor,
                        padding: '3px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 4,
                        border: '1px solid #1F1D1A',
                        fontWeight: 600,
                      }}
                    >
                      {item.platform.replace('_', ' ')}
                    </span>

                    <span
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 9.5,
                        letterSpacing: '0.08em',
                        color: statusBadge.color,
                        background: statusBadge.bg,
                        border: `1px solid ${statusBadge.border}`,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      {statusBadge.label}
                    </span>

                    {statusBadge.sub && (
                      <span
                        style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 9.5,
                          color: '#5BA373',
                          background: '#142218',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {statusBadge.sub}
                      </span>
                    )}

                    {/* Governance verification tags */}
                    <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                      <span
                        style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 8.5,
                          color: '#5BA373',
                          background: 'rgba(91,163,115,0.08)',
                          padding: '2px 6px',
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <ShieldCheckIcon size={10} /> BRANDGUARD PASSED
                      </span>
                      <span
                        style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 8.5,
                          color: '#A78BFA',
                          background: 'rgba(167,139,250,0.08)',
                          padding: '2px 6px',
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <CheckIcon size={10} /> APPROVED
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4813A', fontFamily: 'DM Mono, monospace', fontSize: 11.5 }}>
                    <ClockIcon size={13} />
                    <span>{formatScheduledTime(item.scheduled_at, item.timezone)}</span>
                  </div>
                </div>

                {/* Content Title & Preview */}
                <div style={{ marginBottom: 14 }}>
                  <h3
                    style={{
                      fontFamily: 'Fraunces, Georgia, serif',
                      fontSize: 17,
                      fontWeight: 400,
                      color: '#EDE8DF',
                      margin: '0 0 6px',
                    }}
                  >
                    {item.content_title || `${item.platform.toUpperCase()} Publication`}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12.5,
                      color: '#8A8278',
                      margin: 0,
                      lineHeight: 1.55,
                      maxHeight: 64,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.content_body || 'No text body'}
                  </p>
                </div>

                {/* Failure Reason Alert if failed */}
                {item.status === 'failed' && item.failure_reason && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(196,88,88,0.08)',
                      border: '1px solid #C45858',
                      borderRadius: 6,
                      color: '#EDE8DF',
                      fontSize: 12,
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertTriangleIcon size={14} style={{ color: '#C45858', flexShrink: 0 }} />
                    <span>{item.failure_reason}</span>
                  </div>
                )}

                {/* Card Action Controls & History Drawer Toggle */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #1C1B19',
                    paddingTop: 14,
                    marginTop: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    {item.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => handlePublishDemo(item.id, false)}
                          disabled={isPublishing}
                          style={{
                            padding: '6px 14px',
                            background: '#5BA373',
                            border: 'none',
                            borderRadius: 5,
                            color: '#0A0908',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: isPublishing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <SparkleIcon size={12} />
                          {isPublishing ? 'Publishing...' : 'Publish Demo'}
                        </button>

                        <button
                          onClick={() => handlePublishDemo(item.id, true)}
                          disabled={isPublishing}
                          style={{
                            padding: '6px 12px',
                            background: '#1F1D1B',
                            border: '1px solid #332F2A',
                            borderRadius: 5,
                            color: '#C4813A',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 11.5,
                            cursor: isPublishing ? 'not-allowed' : 'pointer',
                          }}
                          title="Simulate external provider outage for demo verification"
                        >
                          Simulate Failure
                        </button>

                        <button
                          onClick={() => {
                            setRescheduleItem(item)
                            const dt = new Date(item.scheduled_at)
                            setRescheduleDate(dt.toISOString().split('T')[0])
                            setRescheduleTime(dt.toTimeString().slice(0, 5))
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid #252320',
                            borderRadius: 5,
                            color: '#EDE8DF',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 11.5,
                            cursor: 'pointer',
                          }}
                        >
                          Reschedule
                        </button>

                        <button
                          onClick={() => handleCancelSchedule(item.id)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid #252320',
                            borderRadius: 5,
                            color: '#C45858',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 11.5,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {item.status === 'failed' && (
                      <button
                        onClick={() => handlePublishDemo(item.id, false)}
                        disabled={isPublishing}
                        style={{
                          padding: '6px 14px',
                          background: '#C4813A',
                          border: 'none',
                          borderRadius: 5,
                          color: '#0A0908',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isPublishing ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Retry Publishing
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setHistoryOpenId(prev => (prev === item.id ? null : item.id))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6B6560',
                      fontSize: 11.5,
                      fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EDE8DF')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6B6560')}
                  >
                    <span>{isHistoryOpen ? 'Hide History' : 'Publishing History'} ({item.publishing_events?.length || 0})</span>
                    <span style={{ fontSize: 9 }}>{isHistoryOpen ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Traceable Event Timeline History Drawer */}
                {isHistoryOpen && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      background: '#0D0C0B',
                      border: '1px solid #1C1B19',
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 10,
                        color: '#6B6560',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 12,
                      }}
                    >
                      Publishing State Transitions & Audit Trail
                    </div>

                    {(!item.publishing_events || item.publishing_events.length === 0) ? (
                      <div style={{ fontSize: 12, color: '#4A4640', fontStyle: 'italic' }}>
                        No events logged yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {item.publishing_events.map((evt, eIdx) => (
                          <div
                            key={evt.id || eIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: '#131211',
                              border: '1px solid #1A1918',
                              borderRadius: 4,
                              fontSize: 11.5,
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', color: '#C4813A', fontSize: 10 }}>
                                [{evt.event_type.toUpperCase()}]
                              </span>
                              <span style={{ color: '#EDE8DF', fontFamily: 'Inter, sans-serif' }}>
                                {evt.message}
                              </span>
                            </div>

                            <span style={{ fontFamily: 'DM Mono, monospace', color: '#6B6560', fontSize: 10, whiteSpace: 'nowrap' }}>
                              {new Date(evt.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            style={{
              background: '#111110',
              border: '1px solid #252320',
              borderRadius: 8,
              padding: 28,
              maxWidth: 440,
              width: '100%',
            }}
          >
            <h3
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: 20,
                fontWeight: 400,
                color: '#EDE8DF',
                margin: '0 0 8px',
              }}
            >
              Reschedule Publication
            </h3>
            <p style={{ color: '#6B6560', fontSize: 12.5, margin: '0 0 20px', lineHeight: 1.5 }}>
              Choose a new target date and time for {rescheduleItem.platform.toUpperCase()} publication.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ ...S.label, marginBottom: 6 }}>Scheduled Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0D0C0B',
                    border: '1px solid #252320',
                    borderRadius: 6,
                    color: '#EDE8DF',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ ...S.label, marginBottom: 6 }}>Scheduled Time ({rescheduleItem.timezone})</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0D0C0B',
                    border: '1px solid #252320',
                    borderRadius: 6,
                    color: '#EDE8DF',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setRescheduleItem(null)}
                style={{
                  padding: '9px 16px',
                  background: 'transparent',
                  border: '1px solid #252320',
                  borderRadius: 6,
                  color: '#EDE8DF',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                style={{
                  padding: '9px 18px',
                  background: '#C4813A',
                  border: 'none',
                  borderRadius: 6,
                  color: '#0A0908',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
