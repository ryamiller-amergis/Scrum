import React from 'react';
import type { DeploymentEnvironment } from '../types/workitem';
import type { DeploymentForm } from '../hooks/useDeployments';

interface DeploymentModalProps {
  form: DeploymentForm;
  onFormChange: (form: DeploymentForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  isCreating?: boolean;
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({
  form, onFormChange, onSubmit, onClose, isCreating,
}) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <h3>Record Deployment</h3>
      <div className="form-group">
        <label>Environment:</label>
        <select
          value={form.environment}
          onChange={e => onFormChange({ ...form, environment: e.target.value as DeploymentEnvironment })}
        >
          <option value="dev">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>
      <div className="form-group">
        <label>Notes (optional):</label>
        <textarea
          value={form.notes}
          onChange={e => onFormChange({ ...form, notes: e.target.value })}
          placeholder="Deployment notes..."
          rows={4}
        />
      </div>
      <div className="modal-actions">
        <button onClick={onSubmit} className="btn-primary" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Deployment'}
        </button>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
);
