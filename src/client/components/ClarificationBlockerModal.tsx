import React from 'react';
import type { ClarificationBlocker } from '../utils/clarificationGuard';
import styles from './ClarificationBlockerModal.module.css';

interface ClarificationBlockerModalProps {
  /** The action the user was trying to perform, e.g. "Plan UI Surface" or "Generate All Mocks" */
  action: string;
  blockers: ClarificationBlocker[];
  onClose: () => void;
}

const WarningIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      fill="#f59e0b"
      stroke="#d97706"
      strokeWidth="1"
    />
    <line x1="12" y1="9" x2="12" y2="13" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    <line x1="12" y1="17" x2="12.01" y2="17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const ClarificationBlockerModal: React.FC<ClarificationBlockerModalProps> = ({
  action,
  blockers,
  onClose,
}) => {
  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop} role="dialog" aria-modal="true" aria-labelledby="clarification-modal-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerIcon}><WarningIcon /></div>
          <div className={styles.headerText}>
            <h2 id="clarification-modal-title" className={styles.title}>
              Clarifications Required
            </h2>
            <p className={styles.subtitle}>
              Complete all clarification questions before running <strong>{action}</strong>.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.explanation}>
            The following items still have unanswered questions. Answering them helps the AI
            produce an accurate, relevant UI mock — skipping them can result in mocks that
            don't reflect the actual requirements.
          </p>

          <ul className={styles.blockerList}>
            {blockers.map((b, i) => (
              <li key={i} className={styles.blockerItem}>
                <div className={styles.blockerLabel}>{b.itemLabel}</div>
                <div className={styles.blockerGroups}>
                  {b.groups.map(g => (
                    <span key={g} className={styles.groupBadge}>{g} clarifications</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <p className={styles.instruction}>
            Open each item in the backlog panel and click <strong>"Answer Clarifications"</strong> to complete them.
          </p>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnClose} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
};

export default ClarificationBlockerModal;
