import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppShell } from '../hooks/useAppShell';
import {
  usePrototypesForPrd,
  usePrototype,
  usePrototypeComments,
  useRegeneratePrototype,
  useRetryPrototype,
  useReviewPrototype,
  useAddPrototypeComment,
  useResolvePrototypeComment,
} from '../hooks/useDesignPrototypes';
import { UiMockPreview } from './UiMockPreview';
import { ReviewReasonModal } from './ReviewReasonModal';
import {
  designPrototypeStatusLabel,
} from '../../shared/types/designPrototype';
import type { DesignPrototypeSummary } from '../../shared/types/designPrototype';
import type { UiMock } from '../../shared/types/backlog';
import styles from './DesignPrototypeReviewView.module.css';

function badgeClass(status: DesignPrototypeSummary['status']): string {
  switch (status) {
    case 'generating': return styles.badgeGenerating;
    case 'generation_failed': return styles.badgeGenerationFailed;
    case 'pending_review': return styles.badgePendingReview;
    case 'revision_requested': return styles.badgeRevisionRequested;
    case 'regenerating': return styles.badgeRegenerating;
    case 'approved': return styles.badgeApproved;
  }
}

const DesignPrototypeReviewView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { can, authenticatedUser } = useAppShell();

  const prdId = location.pathname.split('/').pop() ?? '';

  const { data: prototypes = [], isLoading: isLoadingList } = usePrototypesForPrd(prdId);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedProto = prototypes[selectedIndex] ?? null;
  const { data: fullPrototype = null } = usePrototype(selectedProto?.id ?? null);
  const { data: comments = [] } = usePrototypeComments(selectedProto?.id ?? null);

  const [feedback, setFeedback] = useState('');
  const [commentText, setCommentText] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  const regenerate = useRegeneratePrototype();
  const retry = useRetryPrototype();
  const review = useReviewPrototype();
  const addComment = useAddPrototypeComment();
  const resolveComment = useResolvePrototypeComment();

  const approvedCount = prototypes.filter(p => p.status === 'approved').length;
  const totalCount = prototypes.length;

  const isBusy = regenerate.isPending || retry.isPending || review.isPending;
  const mutationError = review.error ?? regenerate.error ?? addComment.error;

  const handleRegenerate = useCallback(() => {
    if (!selectedProto || !feedback.trim()) return;
    regenerate.mutate({ id: selectedProto.id, feedback: feedback.trim() });
    setFeedback('');
  }, [selectedProto, feedback, regenerate]);

  const handleRetry = useCallback(() => {
    if (!selectedProto) return;
    retry.mutate(selectedProto.id);
  }, [selectedProto, retry]);

  const handleApprove = useCallback(() => {
    if (!selectedProto) return;
    review.mutate({ id: selectedProto.id, action: 'approve' });
  }, [selectedProto, review]);

  const handleRequestRevision = useCallback((comment: string) => {
    if (!selectedProto) return;
    review.mutate(
      { id: selectedProto.id, action: 'revision_requested', comment },
      {
        onSuccess: () => {
          regenerate.mutate({ id: selectedProto.id, feedback: comment });
        },
      },
    );
    setShowRevisionModal(false);
  }, [selectedProto, review, regenerate]);

  const handleAddComment = useCallback(() => {
    if (!selectedProto || !commentText.trim()) return;
    addComment.mutate({
      prototypeId: selectedProto.id,
      text: commentText.trim(),
      mockVersion: selectedProto.mockVersion,
    });
    setCommentText('');
  }, [selectedProto, commentText, addComment]);

  const handleResolveComment = useCallback((commentId: string) => {
    if (!selectedProto) return;
    resolveComment.mutate({ commentId, prototypeId: selectedProto.id });
  }, [selectedProto, resolveComment]);

  const mockForPreview: UiMock | null = fullPrototype?.mockHtml
    ? {
        decision: 'new-page',
        rationale: '',
        mockHtml: fullPrototype.mockHtml,
        mockVersion: fullPrototype.mockVersion,
        status: 'draft',
        history: fullPrototype.history.map(h => ({
          version: h.version,
          decision: 'new-page' as const,
          rationale: '',
          mockHtml: h.html,
          feedback: h.feedback,
          createdAt: h.createdAt,
        })),
      }
    : null;

  const canReview = can('design-prototypes:review') && selectedProto?.authorId !== authenticatedUser?.oid;
  const isReviewable = selectedProto?.status === 'pending_review';

  const renderPreviewContent = () => {
    const isGenerating = selectedProto?.status === 'generating' || selectedProto?.status === 'regenerating';
    if (isGenerating) {
      const label = selectedProto?.status === 'generating' ? 'Generating prototype...' : 'Regenerating with feedback...';
      return (
        <div className={styles.statusOverlay}>
          <div className={styles.spinner} />
          <div className={styles.statusText}>{label}</div>
        </div>
      );
    }

    if (selectedProto?.status === 'generation_failed') {
      return (
        <div className={styles.statusOverlay}>
          <div className={styles.errorText}>
            Generation failed: {selectedProto.generationError ?? 'Unknown error'}
          </div>
          <button className={styles.retryBtn} onClick={handleRetry} disabled={isBusy}>
            Retry Generation
          </button>
        </div>
      );
    }

    if (mockForPreview) {
      return (
        <div className={styles.previewArea}>
          <UiMockPreview
            mock={mockForPreview}
            feedback={feedback}
            onFeedbackChange={setFeedback}
            onRegenerate={handleRegenerate}
            isBusy={isBusy}
          />
        </div>
      );
    }

    return (
      <div className={styles.statusOverlay}>
        <div className={styles.statusText}>No prototype available</div>
      </div>
    );
  };

  if (isLoadingList) {
    return (
      <div className={styles.container}>
        <div className={styles.statusOverlay}>
          <div className={styles.spinner} />
          <div className={styles.statusText}>Loading prototypes...</div>
        </div>
      </div>
    );
  }

  if (prototypes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={() => navigate(`/backlog/prd/${prdId}`)}>
              Back to PRD
            </button>
          </div>
        </div>
        <div className={styles.emptyState}>
          <div>No design prototypes have been generated for this PRD yet.</div>
          <div>Prototypes are generated automatically when the PRD is approved.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate(`/backlog/prd/${prdId}`)}>
            Back to PRD
          </button>
          <span className={styles.headerTitle}>Design Prototypes</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.progressText}>
            {approvedCount} of {totalCount} approved
          </span>
        </div>
      </div>

      {/* Split pane */}
      <div className={styles.splitPane}>
        {/* Left: Feature tabs + PBI requirements */}
        <div className={styles.leftPanel}>
          <div className={styles.featureTabs}>
            {prototypes.map((proto, idx) => (
              <button
                key={proto.id}
                className={`${styles.featureTab}${idx === selectedIndex ? ` ${styles.featureTabActive}` : ''}`}
                onClick={() => setSelectedIndex(idx)}
              >
                <span className={styles.featureTabName}>{proto.featureName}</span>
                <span className={`${styles.badge} ${badgeClass(proto.status)}`}>
                  {designPrototypeStatusLabel(proto.status)}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.pbiList}>
            <div className={styles.pbiListTitle}>PBI Requirements</div>
            {fullPrototype?.pbiRequirements?.length ? (
              fullPrototype.pbiRequirements.map((pbi, idx) => (
                <div key={idx} className={styles.pbiCard}>
                  <div className={styles.pbiCardTitle}>{pbi.title}</div>
                  {pbi.description && (
                    <div className={styles.pbiCardDesc}>{pbi.description}</div>
                  )}
                  {pbi.acceptanceCriteria && (
                    <div className={styles.pbiCardAc}>
                      <span className={styles.pbiCardAcLabel}>AC: </span>
                      {pbi.acceptanceCriteria}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className={styles.pbiCardDesc}>Loading requirements...</div>
            )}
          </div>
        </div>

        {/* Right: Preview + actions */}
        <div className={styles.rightPanel}>
          {renderPreviewContent()}

          {/* Comments */}
          {comments.length > 0 && (
            <div className={styles.commentsSection}>
              <div className={styles.commentsSectionTitle}>
                Comments ({comments.filter(c => !c.resolved).length} open)
              </div>
              {comments.map((c, idx) => (
                <div key={c.id} className={styles.commentItem}>
                  <div className={`${styles.commentPin}${c.pinX == null ? ` ${styles.commentPinGeneral}` : ''}`}>
                    {idx + 1}
                  </div>
                  <span className={`${styles.commentText}${c.resolved ? ` ${styles.commentResolved}` : ''}`}>
                    {c.text}
                  </span>
                  {!c.resolved && can('interviews:manage') && (
                    <button
                      className={styles.commentResolveBtn}
                      onClick={() => handleResolveComment(c.id)}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error toast */}
          {mutationError && (
            <div className={styles.errorBanner}>
              {(mutationError as Error).message}
            </div>
          )}

          {/* Actions bar */}
          {selectedProto && selectedProto.status !== 'generating' && selectedProto.status !== 'regenerating' && selectedProto.status !== 'generation_failed' && (
            <div className={styles.actionsBar}>
              <div className={styles.actionsLeft}>
                {can('interviews:manage') && (
                  <>
                    <input
                      className={styles.feedbackInput}
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                    />
                    <button
                      className={styles.btnSecondary}
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                    >
                      Comment
                    </button>
                  </>
                )}
              </div>
              <div className={styles.actionsRight}>
                {selectedProto.status === 'revision_requested' && can('interviews:manage') && (
                  <button
                    className={styles.btnPrimary}
                    onClick={handleRegenerate}
                    disabled={isBusy || !feedback.trim()}
                    title={!feedback.trim() ? 'Enter feedback in the preview panel first' : undefined}
                  >
                    Regenerate
                  </button>
                )}
                {isReviewable && canReview && (
                  <>
                    <button
                      className={`${styles.btnSecondary} ${styles.btnRevision}`}
                      onClick={() => setShowRevisionModal(true)}
                      disabled={isBusy}
                    >
                      Request Changes
                    </button>
                    <button
                      className={`${styles.btnPrimary} ${styles.btnApprove}`}
                      onClick={handleApprove}
                      disabled={isBusy}
                    >
                      Approve
                    </button>
                  </>
                )}
                {selectedProto.status === 'approved' && (
                  <span className={`${styles.badge} ${styles.badgeApproved}`}>
                    Approved
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revision modal */}
      {showRevisionModal && (
        <ReviewReasonModal
          title="Request Changes"
          placeholder="Describe what needs to change..."
          confirmLabel="Request Changes"
          onConfirm={handleRequestRevision}
          onCancel={() => setShowRevisionModal(false)}
        />
      )}
    </div>
  );
};

export default DesignPrototypeReviewView;
