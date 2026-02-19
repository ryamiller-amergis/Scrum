import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  version: z.string().min(1, 'Release name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  targetDate: z.string().min(1, 'Target date is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.string().min(1),
});

export type ReleaseFormValues = z.infer<typeof schema>;

interface ReleaseFormModalProps {
  isEditMode: boolean;
  defaultValues?: Partial<ReleaseFormValues>;
  onSubmit: (values: ReleaseFormValues) => void;
  onClose: () => void;
}

export const ReleaseFormModal: React.FC<ReleaseFormModalProps> = ({
  isEditMode,
  defaultValues,
  onSubmit,
  onClose,
}) => {
  const merged: ReleaseFormValues = { version: '', startDate: '', targetDate: '', description: '', status: 'New', ...defaultValues };
  const { register, handleSubmit, formState: { errors } } = useForm<ReleaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: merged,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{isEditMode ? 'Edit Release' : 'Create New Release'}</h3>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {isEditMode && (
            <div className="form-group">
              <label htmlFor="release-status">Status:</label>
              <select id="release-status" {...register('status')} className="status-select">
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="In Design">In Design</option>
                <option value="Done">Done</option>
                <option value="Removed">Removed</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="release-version">Release Name: <span style={{ color: 'red' }}>*</span></label>
            <input
              id="release-version"
              type="text"
              {...register('version')}
              placeholder="e.g., v1.0.0, 2024-Q1"
              disabled={isEditMode}
            />
            {errors.version && <p className="field-error">{errors.version.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="release-start-date">Start Date: <span style={{ color: 'red' }}>*</span></label>
            <input id="release-start-date" type="date" {...register('startDate')} />
            {errors.startDate && <p className="field-error">{errors.startDate.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="release-target-date">Target Date: <span style={{ color: 'red' }}>*</span></label>
            <input id="release-target-date" type="date" {...register('targetDate')} />
            {errors.targetDate && <p className="field-error">{errors.targetDate.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="release-description">Description: <span style={{ color: 'red' }}>*</span></label>
            <textarea
              id="release-description"
              {...register('description')}
              placeholder="Release description..."
              rows={4}
            />
            {errors.description && <p className="field-error">{errors.description.message}</p>}
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-primary">
              {isEditMode ? 'Update Release' : 'Create Release'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};
