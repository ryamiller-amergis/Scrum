import React, { useState } from 'react';
import './DueDateReasonModal.css';

interface DueDateReasonModalProps {
  workItemId: number;
  workItemTitle: string;
  oldDueDate: string | null;
  newDueDate: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const REASON_OPTIONS = [
  'Bug Findings',
  'Incorrect Estimate',
  'Incorrect Implementation',
  'Production Priorities',
  'Scope Creep',
  'Other',
];

export const DueDateReasonModal: React.FC<DueDateReasonModalProps> = ({
  workItemId,
  workItemTitle,
  oldDueDate,
  newDueDate,
  onConfirm,
  onCancel,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherText, setOtherText] = useState<string>('');

  const handleConfirm = () => {
    if (!selectedReason) {
      return;
    }

    const finalReason = selectedReason === 'Other' ? otherText : selectedReason;
    onConfirm(finalReason);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    
    // Parse the date string (YYYY-MM-DD) without timezone conversion
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    return localDate.toLocaleDateString();
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Due Date Changed</h2>
          <button className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-work-item">
            <strong>Work Item #{workItemId}:</strong> {workItemTitle}
          </p>
          <div className="date-change-info">
            <div className="date-item">
              <span className="date-label">Previous Due Date:</span>
              <span className="date-value">{formatDate(oldDueDate)}</span>
            </div>
            <div className="date-item">
              <span className="date-label">New Due Date:</span>
              <span className="date-value">{formatDate(newDueDate)}</span>
            </div>
          </div>
          <p className="modal-prompt">Please select a reason for this change:</p>
          <div className="reason-options">
            {REASON_OPTIONS.map((reason) => (
              <label key={reason} className="reason-option">
                <input
                  type="radio"
                  name="reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
          {selectedReason === 'Other' && (
            <div className="other-input-container">
              <label htmlFor="other-reason">Please specify:</label>
              <textarea
                id="other-reason"
                className="other-input"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Enter reason..."
                rows={3}
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-confirm"
            onClick={handleConfirm}
            disabled={!selectedReason || (selectedReason === 'Other' && !otherText.trim())}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
