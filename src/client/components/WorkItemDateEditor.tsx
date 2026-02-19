import React, { useState } from 'react';

interface WorkItemDateEditorProps {
  label: string;
  value?: string;
  onSave: (value: string | null, reason?: string) => Promise<void>;
  requiresReason?: boolean;
  canEdit?: boolean;
  valueStyle?: React.CSSProperties;
}

const REASONS = [
  'Scope change',
  'Dependencies',
  'Resource availability',
  'Technical complexity',
  'Priority shift',
  'Customer request',
  'Other',
];

export const WorkItemDateEditor: React.FC<WorkItemDateEditorProps> = ({
  label,
  value,
  onSave,
  requiresReason = false,
  canEdit = true,
  valueStyle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showReason, setShowReason] = useState(false);

  const startEdit = () => {
    setTempValue(value || '');
    setReason('');
    setCustomReason('');
    setShowReason(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (tempValue && tempValue !== value) {
      if (requiresReason && !showReason) {
        setShowReason(true);
        return;
      }
      const finalReason = requiresReason
        ? (reason === 'Other' ? customReason : reason)
        : undefined;
      await onSave(tempValue, finalReason);
    }
    setIsEditing(false);
    setShowReason(false);
    setReason('');
    setCustomReason('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowReason(false);
    setTempValue('');
    setReason('');
    setCustomReason('');
  };

  const handleRemove = () => onSave(null);

  if (!isEditing) {
    return (
      <div className="detail-row">
        <span className="detail-label">{label}:</span>
        <div className="detail-date-display">
          <span className="detail-value" style={valueStyle}>{value || 'Not set'}</span>
          {canEdit && <button onClick={startEdit} className="date-edit-btn">Edit</button>}
          {canEdit && value && <button onClick={handleRemove} className="date-remove-btn">Remove</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="detail-row">
      <span className="detail-label">{label}:</span>
      <div className="detail-date-edit-container">
        <div className="detail-date-edit">
          <input
            type="date"
            className="detail-date-input"
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
          />
          <button onClick={handleSave} className="date-save-btn">✓</button>
          <button onClick={handleCancel} className="date-cancel-btn">✕</button>
        </div>
        {requiresReason && showReason && (
          <div className="detail-reason-input">
            <label className="reason-label">Reason for date change:</label>
            <select
              className="reason-select"
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            >
              <option value="">Select a reason...</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other' && (
              <textarea
                className="reason-textarea"
                placeholder="Please specify the reason..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                rows={3}
              />
            )}
            <div className="reason-buttons">
              <button
                onClick={handleSave}
                className="reason-confirm-btn"
                disabled={!reason || (reason === 'Other' && !customReason.trim())}
              >
                Confirm Change
              </button>
              <button onClick={handleCancel} className="reason-cancel-btn">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
