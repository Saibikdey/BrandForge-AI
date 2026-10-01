import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import {
  CheckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  ShieldIcon,
  SparkleIcon,
  RefreshIcon,
  ArrowRightIcon,
  PlusIcon,
} from '../components/Icons'
import { api } from '../services/api'
import type {
  CampaignData,
  StrategyDirection,
  CampaignContent,
  HumanApprovalResponse,
} from '../types/campaign'

interface Props {
  navigate: (s: Screen) => void
  activeCampaignId?: string | null
  activeStrategyId?: string | null
  activeContentId?: string | null
  onContentSelected?: (contentId: string) => void
  onStrategySelected?: (strategyId: string) => void
}

const S = {
  page: { padding: '48px 48px', maxWidth: 1180, margin: '0 auto' } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#3A3830',
  },
  card: { background: '#111110', border: '1px solid #252320', borderRadius: 8 },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: '#0D0C0B',
    border: '1px solid #252320',
    borderRadius: 6,
    color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    lineHeight: 1.5,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: '#0D0C0B',
    border: '1px solid #252320',
    borderRadius: 6,
    color: '#EDE8DF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    lineHeight: 1.6,
    outline: 'none',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
}

interface PlatformMeta {
  id: 'instagram' | 'linkedin' | 'x' | 'youtube_shorts'
  label: string
  color: string
}

const platformMetas: PlatformMeta[] = [
  { id: 'instagram', label: 'Instagram', color: '#C4813A' },
  { id: 'linkedin', label: 'LinkedIn', color: '#5B9BC4' },
  { id: 'x', label: 'X (Twitter)', color: '#EDE8DF' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', color: '#C45858' },
]

export default function HumanApproval({
  navigate,
  activeCampaignId,
  activeStrategyId,
  activeContentId,
  onContentSelected,
}: Props) {
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [strategies, setStrategies] = useState<StrategyDirection[]>([])
  const [activeStrategy, setActiveStrategy] = useState<StrategyDirection | null>(null)
  const [contents, setContents] = useState<CampaignContent[]>([])
  const [selectedContent, setSelectedContent] = useState<CampaignContent | null>(null)
  const [approvalState, setApprovalState] = useState<HumanApprovalResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editHook, setEditHook] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editVisual, setEditVisual] = useState('')
  const [editCta, setEditCta] = useState('')
  const [revisionReason, setRevisionReason] = useState('')

  // Modals
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false)
  const [feedbackInput, setFeedbackInput] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReasonInput, setRejectReasonInput] = useState('')

  // Resolve active campaign ID
  const effectiveCampaignId =
    activeCampaignId ||
    (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_campaign_id') : null)

  // Toast timer
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(t)
  }, [toastMessage])

  // Sync edit form with selected content/approval state
  const syncFormWithContent = (data: CampaignContent | HumanApprovalResponse) => {
    setEditTitle(data.title || '')
    setEditHook(data.hook || '')
    setEditBody(data.body || '')
    setEditVisual(data.visual_concept || '')
    setEditCta(data.call_to_action || '')
    setRevisionReason('')
  }

  // Load initial data
  useEffect(() => {
    async function loadData() {
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
          console.warn('Could not discover existing campaigns:', e)
        }
      }

      if (!campId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage(null)
      try {
        const [campData, stratList, contentList] = await Promise.all([
          api.getCampaign(campId),
          api.getStrategies(campId),
          api.getContent(campId),
        ])

        setCampaign(campData)
        setStrategies(stratList || [])

        // Resolve active strategy
        const targetStratId =
          activeStrategyId ||
          (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_strategy_id') : null)

        let resolvedStrat: StrategyDirection | undefined
        if (stratList && stratList.length > 0) {
          resolvedStrat =
            (targetStratId ? stratList.find(s => s.id === targetStratId || s.strategy_type === targetStratId) : undefined) ||
            stratList.find(s => s.is_selected) ||
            stratList.find(s => s.recommended) ||
            stratList[0]
          setActiveStrategy(resolvedStrat || null)
        }

        // Filter contents by resolved strategy
        const strategyContents = resolvedStrat
          ? (contentList || []).filter(c => c.strategy_id === resolvedStrat?.id)
          : contentList || []

        setContents(strategyContents)

        // Select active content
        const targetContentId =
          activeContentId ||
          (typeof window !== 'undefined' ? localStorage.getItem('brandforge_active_content_id') : null)

        let targetContent = strategyContents.find(c => c.id === targetContentId)
        if (!targetContent && strategyContents.length > 0) {
          targetContent = strategyContents[0]
        }

        setSelectedContent(targetContent || null)

        if (targetContent) {
          if (onContentSelected) {
            onContentSelected(targetContent.id)
          } else if (typeof window !== 'undefined') {
            localStorage.setItem('brandforge_active_content_id', targetContent.id)
          }

          // Fetch full approval state
          try {
            const approval = await api.getApprovalState(targetContent.id)
            setApprovalState(approval)
            syncFormWithContent(approval)
          } catch (err) {
            console.warn('Could not fetch approval state for content:', err)
            syncFormWithContent(targetContent)
          }
        }
      } catch (err: any) {
        console.error('Error loading Human Approval data:', err)
        setErrorMessage('Failed to load campaign content and approval state.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [effectiveCampaignId, activeStrategyId])

  // Switch selected content asset
  const handleSelectContent = async (item: CampaignContent) => {
    setSelectedContent(item)
    if (onContentSelected) {
      onContentSelected(item.id)
    } else if (typeof window !== 'undefined') {
      localStorage.setItem('brandforge_active_content_id', item.id)
    }

    setErrorMessage(null)
    setActionLoading(true)
    try {
      const approval = await api.getApprovalState(item.id)
      setApprovalState(approval)
      syncFormWithContent(approval)
    } catch (err: any) {
      console.error('Failed to load approval state for asset:', err)
      syncFormWithContent(item)
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Save Revision
  const handleSaveRevision = async () => {
    if (!selectedContent) return
    if (!editBody.trim()) {
      setErrorMessage('Content body cannot be empty.')
      return
    }
    if (!revisionReason.trim()) {
      setErrorMessage('Please provide a reason for this revision to document human changes.')
      return
    }

    setActionLoading(true)
    setErrorMessage(null)
    try {
      const updated = await api.createRevision(selectedContent.id, {
        title: editTitle.trim() || undefined,
        hook: editHook.trim() || undefined,
        body: editBody.trim(),
        visual_concept: editVisual.trim() || undefined,
        call_to_action: editCta.trim() || undefined,
        revision_reason: revisionReason.trim(),
      })

      setApprovalState(updated)
      syncFormWithContent(updated)
      setToastMessage(`Revision ${updated.revision_number} saved. Previous audit invalidated; new audit required.`)
    } catch (err: any) {
      console.error('Error saving revision:', err)
      setErrorMessage(err.message || 'Failed to save revision.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Run BrandGuard Re-audit directly
  const handleRunBrandGuard = async () => {
    if (!selectedContent) return

    setAuditing(true)
    setErrorMessage(null)
    try {
      await api.auditContent(selectedContent.id)
      // Refresh approval state
      const updated = await api.getApprovalState(selectedContent.id)
      setApprovalState(updated)
      setToastMessage('BrandGuard audit completed. Compliance status updated.')
    } catch (err: any) {
      console.error('Audit execution error:', err)
      setErrorMessage('Audit failed to complete. Please try again.')
    } finally {
      setAuditing(false)
    }
  }

  // Action: Request Changes
  const handleSubmitRequestChanges = async () => {
    if (!selectedContent) return
    if (!feedbackInput.trim()) {
      setErrorMessage('Please enter detailed feedback for requested changes.')
      return
    }

    setActionLoading(true)
    setErrorMessage(null)
    try {
      const updated = await api.requestChanges(selectedContent.id, feedbackInput.trim())
      setApprovalState(updated)
      setShowRequestChangesModal(false)
      setFeedbackInput('')
      setToastMessage('Changes requested. Reviewer feedback saved.')
    } catch (err: any) {
      console.error('Error requesting changes:', err)
      setErrorMessage(err.message || 'Failed to request changes.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Approve
  const handleApprove = async () => {
    if (!selectedContent) return

    setActionLoading(true)
    setErrorMessage(null)
    try {
      const updated = await api.approveContent(selectedContent.id)
      setApprovalState(updated)
      setToastMessage('✓ Content approved for publication!')
    } catch (err: any) {
      console.error('Error approving content:', err)
      setErrorMessage(err.message || 'Content could not be approved. Please ensure BrandGuard audit passes.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Reject
  const handleSubmitReject = async () => {
    if (!selectedContent) return

    setActionLoading(true)
    setErrorMessage(null)
    try {
      const updated = await api.rejectContent(selectedContent.id, rejectReasonInput.trim() || undefined)
      setApprovalState(updated)
      setShowRejectModal(false)
      setRejectReasonInput('')
      setToastMessage('Content marked as rejected.')
    } catch (err: any) {
      console.error('Error rejecting content:', err)
      setErrorMessage(err.message || 'Failed to reject content.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid #252320',
              borderTopColor: '#C4813A',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>
            Loading Human Approval queue...
          </div>
        </div>
      </div>
    )
  }

  const currentStatus = approvalState?.approval_status || 'pending_review'
  const isAuditCurrent = approvalState?.is_audit_current || false
  const auditStatus = approvalState?.latest_audit_status

  const isApproved = currentStatus === 'approved'
  const isChangesRequested = currentStatus === 'changes_requested'
  const isRejected = currentStatus === 'rejected'

  const canApprove = isAuditCurrent && (auditStatus === 'pass' || auditStatus === 'warning')

  return (
    <div className="w-full max-w-[1180px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 box-border">
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#1A1917',
            border: '1px solid #5BA373',
            borderRadius: 8,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#EDE8DF',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <CheckIcon size={14} style={{ color: '#5BA373' }} />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={S.label}>GOVERNANCE & HUMAN-IN-THE-LOOP</span>
            <span style={{ color: '#3A3830' }}>•</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A', letterSpacing: '0.08em' }}>
              MILESTONE 3C
            </span>
          </div>
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl"
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontWeight: 300,
              color: '#EDE8DF',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            Human Approval Queue
          </h1>
          <p style={{ color: '#8C857B', fontSize: 14, margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
            Review AI-generated assets, request revisions, edit copy with revision tracking, and grant final editorial approval.
          </p>
        </div>

        {/* Action Header Navigation */}
        <div className="flex flex-wrap gap-2.5 items-center w-full sm:w-auto">
          <button
            onClick={() => navigate('brand-guard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              background: '#181715',
              border: '1px solid #252320',
              borderRadius: 6,
              color: '#C4B89A',
              fontSize: 12,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldIcon size={12} style={{ color: '#C4813A' }} /> BrandGuard
          </button>
          <button
            onClick={() => navigate('content-studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              background: '#181715',
              border: '1px solid #252320',
              borderRadius: 6,
              color: '#C4B89A',
              fontSize: 12,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Content Studio →
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(196, 88, 88, 0.1)',
            border: '1px solid rgba(196, 88, 88, 0.3)',
            borderRadius: 6,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#EDE8DF',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircleIcon size={16} style={{ color: '#C45858' }} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#8C857B', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Context Bar */}
      <div
        style={{
          ...S.card,
          padding: '14px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ ...S.label, marginRight: 6 }}>CAMPAIGN:</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', fontWeight: 500 }}>
              {campaign?.name || 'Active Campaign'}
            </span>
          </div>
          <span style={{ color: '#252320' }}>|</span>
          <div>
            <span style={{ ...S.label, marginRight: 6 }}>STRATEGY:</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: activeStrategy?.color || '#C4813A', fontWeight: 500 }}>
              {activeStrategy?.label || 'Selected Strategy'}
            </span>
          </div>
        </div>

        {selectedContent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>REVISION:</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#181715', border: '1px solid #252320', color: '#C4813A' }}>
              REV #{approvalState?.revision_number || selectedContent.revision_number || 1}
            </span>
          </div>
        )}
      </div>

      {/* Asset Switcher Tabs */}
      {contents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>SELECT ASSET FOR HUMAN REVIEW</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {contents.map(item => {
              const meta = platformMetas.find(p => p.id === item.platform) || {
                id: item.platform,
                label: item.platform,
                color: '#C4813A',
              }
              const isSelected = selectedContent?.id === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectContent(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    borderRadius: 6,
                    background: isSelected ? '#1A1917' : '#111110',
                    border: `1px solid ${isSelected ? meta.color : '#252320'}`,
                    color: isSelected ? '#EDE8DF' : '#8C857B',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: isSelected ? 500 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        item.approval_status === 'approved'
                          ? '#5BA373'
                          : item.approval_status === 'changes_requested'
                          ? '#C4813A'
                          : item.approval_status === 'rejected'
                          ? '#C45858'
                          : '#6B6560',
                    }}
                  />
                  <span>{meta.label}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                    ({item.content_type})
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Body */}
      {!selectedContent ? (
        /* Empty State */
        <div style={{ ...S.card, padding: 64, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, color: '#EDE8DF', margin: '0 0 8px', fontWeight: 400 }}>
            No Content Selected
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B6560', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Generate platform content in Content Studio to submit pieces to the Human Approval queue.
          </p>
          <button
            onClick={() => navigate('content-studio')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 22px',
              background: '#C4813A',
              color: '#0A0908',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Go to Content Studio <ArrowRightIcon size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Dual Status Card: Approval Status + BrandGuard Audit Status */}
          <div
            style={{
              padding: '24px 28px',
              borderRadius: 8,
              background: isApproved
                ? 'rgba(91, 163, 115, 0.08)'
                : isChangesRequested
                ? 'rgba(196, 129, 58, 0.08)'
                : isRejected
                ? 'rgba(196, 88, 88, 0.08)'
                : '#111110',
              border: `1px solid ${
                isApproved
                  ? 'rgba(91, 163, 115, 0.3)'
                  : isChangesRequested
                  ? 'rgba(196, 129, 58, 0.3)'
                  : isRejected
                  ? 'rgba(196, 88, 88, 0.3)'
                  : '#252320'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 20,
            }}
          >
            {/* Left: Approval Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: isApproved
                    ? 'rgba(91, 163, 115, 0.15)'
                    : isChangesRequested
                    ? 'rgba(196, 129, 58, 0.15)'
                    : isRejected
                    ? 'rgba(196, 88, 88, 0.15)'
                    : '#181715',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isApproved
                    ? '#5BA373'
                    : isChangesRequested
                    ? '#C4813A'
                    : isRejected
                    ? '#C45858'
                    : '#C4B89A',
                }}
              >
                {isApproved ? (
                  <CheckCircleIcon size={24} />
                ) : isChangesRequested ? (
                  <AlertTriangleIcon size={24} />
                ) : isRejected ? (
                  <AlertCircleIcon size={24} />
                ) : (
                  <SparkleIcon size={20} />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 400, color: '#EDE8DF' }}>
                    {isApproved
                      ? 'Approved for Publication'
                      : isChangesRequested
                      ? 'Changes Requested'
                      : isRejected
                      ? 'Content Rejected'
                      : 'Awaiting Human Review'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: isApproved
                        ? 'rgba(91,163,115,0.2)'
                        : isChangesRequested
                        ? 'rgba(196,129,58,0.2)'
                        : isRejected
                        ? 'rgba(196,88,88,0.2)'
                        : '#1E1D1B',
                      color: isApproved
                        ? '#5BA373'
                        : isChangesRequested
                        ? '#C4813A'
                        : isRejected
                        ? '#C45858'
                        : '#C4B89A',
                      textTransform: 'uppercase',
                    }}
                  >
                    {currentStatus.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B' }}>
                  {isApproved
                    ? 'This asset has received final human editorial sign-off.'
                    : isChangesRequested
                    ? 'Reviewer requested copy or claim adjustments. Edit and re-audit below.'
                    : isRejected
                    ? 'This asset was rejected by the reviewer and is not eligible for publication.'
                    : 'Asset is currently pending human review and editorial decision.'}
                </div>
              </div>
            </div>

            {/* Right: BrandGuard Audit State */}
            <div
              style={{
                padding: '10px 16px',
                background: '#0D0C0B',
                border: '1px solid #1C1B19',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <div style={S.label}>GOVERNANCE STATUS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {!isAuditCurrent ? (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C4813A' }}>
                      ◌ AUDIT REQUIRED (STALE)
                    </span>
                  ) : auditStatus === 'pass' ? (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5BA373' }}>
                      ✓ BRANDGUARD PASSED
                    </span>
                  ) : auditStatus === 'warning' ? (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C4813A' }}>
                      ⚠ BRANDGUARD NEEDS REVIEW
                    </span>
                  ) : auditStatus === 'fail' ? (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C45858' }}>
                      ✕ BRANDGUARD FAILED
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B6560' }}>
                      ◌ NOT AUDITED
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleRunBrandGuard}
                disabled={auditing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: '#181715',
                  border: '1px solid #252320',
                  borderRadius: 5,
                  color: '#C4B89A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11,
                  cursor: auditing ? 'not-allowed' : 'pointer',
                }}
              >
                {auditing ? (
                  <>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #8C857B', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
                    Auditing...
                  </>
                ) : (
                  <>
                    <RefreshIcon size={11} /> Re-audit
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Reviewer Feedback Callout (if changes requested or rejected) */}
          {approvalState?.reviewer_feedback && (isChangesRequested || isRejected) && (
            <div
              style={{
                ...S.card,
                padding: '20px 24px',
                borderLeft: `3px solid ${isChangesRequested ? '#C4813A' : '#C45858'}`,
                background: '#141312',
              }}
            >
              <div style={{ ...S.label, color: isChangesRequested ? '#C4813A' : '#C45858', marginBottom: 6 }}>
                {isChangesRequested ? 'REVIEWER FEEDBACK & REQUESTED CHANGES' : 'REJECTION REASONING'}
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#EDE8DF', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                "{approvalState.reviewer_feedback}"
              </p>
            </div>
          )}

          {/* Dual Column: Preview (Left) vs Revision Editor (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
            {/* Left Column: Live Content Preview */}
            <div style={{ ...S.card, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={S.label}>LIVE CONTENT PREVIEW</span>
                  <span style={{ color: '#3A3830' }}>•</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C4813A' }}>
                    REV #{approvalState?.revision_number || 1}
                  </span>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560', textTransform: 'uppercase' }}>
                  {selectedContent.platform}
                </span>
              </div>

              {/* Title / Headline */}
              {editTitle && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...S.label, marginBottom: 4 }}>CONCEPT / HEADLINE</div>
                  <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 400, color: '#EDE8DF', margin: 0 }}>
                    {editTitle}
                  </h3>
                </div>
              )}

              {/* Hook */}
              {editHook && (
                <div style={{ padding: '12px 16px', background: '#181715', borderLeft: '3px solid #C4813A', borderRadius: '0 6px 6px 0', marginBottom: 16 }}>
                  <div style={{ ...S.label, color: '#C4813A', marginBottom: 4 }}>OPENING HOOK</div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#EDE8DF', margin: 0, fontWeight: 500 }}>
                    {editHook}
                  </p>
                </div>
              )}

              {/* Body */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...S.label, marginBottom: 6 }}>CONTENT BODY</div>
                <div
                  style={{
                    padding: '16px',
                    background: '#0D0C0B',
                    border: '1px solid #1C1B19',
                    borderRadius: 6,
                    fontFamily: selectedContent.platform === 'youtube_shorts' ? 'DM Mono, monospace' : 'Inter, sans-serif',
                    fontSize: selectedContent.platform === 'youtube_shorts' ? 12 : 13,
                    color: '#EDE8DF',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    minHeight: 120,
                  }}
                >
                  {editBody || <span style={{ color: '#4A4640' }}>No content body entered...</span>}
                </div>
              </div>

              {/* Visual Concept */}
              {editVisual && (
                <div style={{ padding: '12px 16px', background: 'rgba(196,129,58,0.06)', border: '1px solid rgba(196,129,58,0.2)', borderRadius: 6, marginBottom: 16 }}>
                  <div style={{ ...S.label, color: '#C4813A', marginBottom: 4 }}>VISUAL STAGING</div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#C4B89A', margin: 0 }}>
                    {editVisual}
                  </p>
                </div>
              )}

              {/* CTA */}
              {editCta && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#141312', border: '1px solid #252320', borderRadius: 6 }}>
                  <span style={{ ...S.label, color: '#8C857B' }}>CTA:</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C4B89A' }}>
                    {editCta}
                  </span>
                </div>
              )}
            </div>

            {/* Right Column: Revision Editor */}
            <div style={{ ...S.card, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...S.label, color: '#C4813A' }}>HUMAN REVISION EDITOR</span>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#8C857B' }}>
                  NEXT: REV #{(approvalState?.revision_number || 1) + 1}
                </span>
              </div>

              {/* Title Field */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>HEADLINE / TITLE</label>
                <input
                  style={S.input}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Enter headline or title..."
                />
              </div>

              {/* Hook Field */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>OPENING HOOK</label>
                <textarea
                  rows={2}
                  style={S.textarea}
                  value={editHook}
                  onChange={e => setEditHook(e.target.value)}
                  placeholder="Attention-grabbing opening hook..."
                />
              </div>

              {/* Body Field */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>MAIN CONTENT COPY / SCRIPT</label>
                <textarea
                  rows={6}
                  style={S.textarea}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  placeholder="Full copy or script..."
                />
              </div>

              {/* Visual Concept Field */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>VISUAL STAGING & ART DIRECTION</label>
                <textarea
                  rows={2}
                  style={S.textarea}
                  value={editVisual}
                  onChange={e => setEditVisual(e.target.value)}
                  placeholder="Visual description or staging instructions..."
                />
              </div>

              {/* CTA Field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>CALL TO ACTION (CTA)</label>
                <input
                  style={S.input}
                  value={editCta}
                  onChange={e => setEditCta(e.target.value)}
                  placeholder="e.g. Link in bio to experience Arkiva Pro..."
                />
              </div>

              {/* Revision Reason (Required) */}
              <div style={{ marginBottom: 20, padding: 14, background: '#141312', border: '1px solid #252320', borderRadius: 6 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, color: '#C4813A' }}>
                  REVISION REASON (REQUIRED FOR AUDIT TRAIL)
                </label>
                <input
                  style={S.input}
                  value={revisionReason}
                  onChange={e => setRevisionReason(e.target.value)}
                  placeholder="e.g. Removed unsupported sustainability claim and softened hook."
                />
              </div>

              {/* Save Revision Button */}
              <button
                onClick={handleSaveRevision}
                disabled={actionLoading}
                style={{
                  width: '100%',
                  padding: '11px',
                  background: '#181715',
                  border: '1px solid #C4813A',
                  borderRadius: 6,
                  color: '#C4813A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease',
                }}
              >
                {actionLoading ? (
                  'Saving Revision...'
                ) : (
                  <>
                    <PlusIcon size={14} /> Save Revision #{ (approvalState?.revision_number || 1) + 1 }
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Decision Action Bar */}
          <div
            style={{
              ...S.card,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Request Changes Button */}
              <button
                onClick={() => setShowRequestChangesModal(true)}
                disabled={actionLoading}
                style={{
                  padding: '10px 18px',
                  background: '#181715',
                  border: '1px solid #C4813A',
                  borderRadius: 6,
                  color: '#C4813A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertTriangleIcon size={14} /> Request Changes
              </button>

              {/* Reject Button */}
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                style={{
                  padding: '10px 16px',
                  background: '#141312',
                  border: '1px solid #3A3830',
                  borderRadius: 6,
                  color: '#8C857B',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Reject Content
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isApproved && (
                <button
                  onClick={() => navigate('campaign-calendar')}
                  style={{
                    padding: '11px 18px',
                    background: '#161514',
                    border: '1px solid #5BA373',
                    borderRadius: 6,
                    color: '#5BA373',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowRightIcon size={13} /> View in Calendar
                </button>
              )}

              {/* Approve Button */}
              {canApprove ? (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  style={{
                    padding: '11px 24px',
                    background: '#5BA373',
                    border: 'none',
                    borderRadius: 6,
                    color: '#0A0908',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CheckIcon size={14} /> {auditStatus === 'warning' ? 'Approve with Warnings' : 'Approve Content'}
                </button>
              ) : (
                <button
                  disabled
                  title={!isAuditCurrent ? 'Please re-run BrandGuard before approving.' : 'Approval blocked: Critical audit issues must be resolved.'}
                  style={{
                    padding: '11px 24px',
                    background: '#181715',
                    border: '1px solid #252320',
                    borderRadius: 6,
                    color: '#4A4640',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CheckIcon size={14} /> {!isAuditCurrent ? 'Re-audit Required Before Approval' : 'Resolve Critical Issues to Approve'}
                </button>
              )}
            </div>
          </div>

          {/* Revision & Approval History Timeline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Revisions History */}
            <div style={{ ...S.card, padding: 22 }}>
              <div style={{ ...S.label, marginBottom: 14 }}>REVISION TIMELINE ({approvalState?.revisions.length || 1})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(approvalState?.revisions || []).map(rev => (
                  <div
                    key={rev.id}
                    style={{
                      padding: '12px 14px',
                      background: '#0D0C0B',
                      border: '1px solid #1C1B19',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C4813A', fontWeight: 600 }}>
                          REV #{rev.revision_number}
                        </span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#EDE8DF' }}>
                          {rev.revision_reason || 'AI generated baseline'}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                        {new Date(rev.created_at).toLocaleDateString()} · {new Date(rev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval Action Trail */}
            <div style={{ ...S.card, padding: 22 }}>
              <div style={{ ...S.label, marginBottom: 14 }}>GOVERNANCE AUDIT TRAIL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(approvalState?.approval_history || []).map(action => {
                  const actionColor =
                    action.action === 'approved'
                      ? '#5BA373'
                      : action.action === 'changes_requested'
                      ? '#C4813A'
                      : action.action === 'rejected'
                      ? '#C45858'
                      : '#8C857B'

                  return (
                    <div
                      key={action.id}
                      style={{
                        padding: '12px 14px',
                        background: '#0D0C0B',
                        border: '1px solid #1C1B19',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: actionColor, textTransform: 'uppercase' }}>
                            [{action.action.replace('_', ' ')}]
                          </span>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#EDE8DF' }}>
                            {action.feedback || 'Action recorded'}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6B6560' }}>
                          {new Date(action.created_at).toLocaleDateString()} · {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showRequestChangesModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="w-full max-w-lg p-5 sm:p-8 max-h-[90vh] overflow-y-auto rounded-lg border border-[#252320] bg-[#141312] box-border">
            <div style={{ ...S.label, color: '#C4813A', marginBottom: 8 }}>REQUEST EDITORIAL CHANGES</div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 12px', fontWeight: 400 }}>
              What should be changed?
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', margin: '0 0 16px', lineHeight: 1.5 }}>
              Specify the exact tone, claim, or copy adjustments required before this piece can be approved.
            </p>
            <textarea
              rows={4}
              style={{ ...S.textarea, marginBottom: 20 }}
              value={feedbackInput}
              onChange={e => setFeedbackInput(e.target.value)}
              placeholder="e.g. Make the opening hook less promotional and remove the unsupported sustainability claim..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setShowRequestChangesModal(false)}
                style={{
                  padding: '9px 16px',
                  background: '#181715',
                  border: '1px solid #252320',
                  borderRadius: 6,
                  color: '#8C857B',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequestChanges}
                disabled={actionLoading || !feedbackInput.trim()}
                style={{
                  padding: '9px 20px',
                  background: '#C4813A',
                  border: 'none',
                  borderRadius: 6,
                  color: '#0A0908',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: actionLoading || !feedbackInput.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="w-full max-w-lg p-5 sm:p-8 max-h-[90vh] overflow-y-auto rounded-lg border border-[#252320] bg-[#141312] box-border">
            <div style={{ ...S.label, color: '#C45858', marginBottom: 8 }}>REJECT CONTENT</div>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, color: '#EDE8DF', margin: '0 0 12px', fontWeight: 400 }}>
              Are you sure you want to reject this content?
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8C857B', margin: '0 0 16px', lineHeight: 1.5 }}>
              Rejected content cannot be approved. Provide an optional explanation for why this piece was rejected.
            </p>
            <textarea
              rows={3}
              style={{ ...S.textarea, marginBottom: 20 }}
              value={rejectReasonInput}
              onChange={e => setRejectReasonInput(e.target.value)}
              placeholder="e.g. Content does not fit overall creative direction..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  padding: '9px 16px',
                  background: '#181715',
                  border: '1px solid #252320',
                  borderRadius: 6,
                  color: '#8C857B',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReject}
                disabled={actionLoading}
                style={{
                  padding: '9px 20px',
                  background: '#C45858',
                  border: 'none',
                  borderRadius: 6,
                  color: '#0A0908',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
