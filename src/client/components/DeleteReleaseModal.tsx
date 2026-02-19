import React from 'react';

interface DeleteReleaseModalProps {
  epicId: number;
  epicVersion?: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteReleaseModal: React.FC<DeleteReleaseModalProps> = ({
  epicId, epicVersion, isDeleting, onConfirm, onClose,
}) => (
  <div className="modal-overlay" onClick={() => !isDeleting && onClose()}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Confirm Delete Release Epic</h3>
        <button className="modal-close" onClick={onClose} disabled={isDeleting}>✕</button>
      </div>
      <div className="modal-body">
        <div className="modal-icon-danger">🗑️</div>
        <p className="modal-message">Are you sure you want to delete this release epic?</p>
        <div className="modal-epic-info-delete">
          {epicVersion && <span className="modal-epic-version">{epicVersion}</span>}
          <span className="modal-epic-id">#{epicId}</span>
        </div>
        <div className="modal-warning-danger">
          ⚠️ <strong>Warning:</strong> This will permanently delete the epic and remove all hierarchical relationships
          with child work items. The child work items themselves will NOT be deleted, only the links to this epic.
        </div>
        <div className="modal-info">ℹ️ This action cannot be undone.</div>
      </div>
      <div className="modal-footer">
        <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={isDeleting}>
          Cancel
        </button>
        <button className="modal-btn modal-btn-danger" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete Epic'}
        </button>
      </div>
    </div>
  </div>
);
