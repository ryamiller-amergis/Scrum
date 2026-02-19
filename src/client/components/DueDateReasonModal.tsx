import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import styles from './DueDateReasonModal.module.css';

const REASON_OPTIONS = [
  'Initialize',
  'Bug Findings',
  'Incorrect Estimate',
  'Incorrect Implementation',
  'Production Priorities',
  'Scope Creep',
  'Other',
] as const;

const schema = z.discriminatedUnion('reason', [
  z.object({ reason: z.enum(REASON_OPTIONS).exclude(['Other']), otherText: z.string().optional() }),
  z.object({ reason: z.literal('Other'), otherText: z.string().min(1, 'Please specify a reason') }),
]);

type FormValues = z.infer<typeof schema>;

interface DueDateReasonModalProps {
  workItemId: number;
  workItemTitle: string;
  oldDueDate: string | null;
  newDueDate: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function formatDate(date: string | null): string {
  if (!date) return 'Not set';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

export const DueDateReasonModal: React.FC<DueDateReasonModalProps> = ({
  workItemId,
  workItemTitle,
  oldDueDate,
  newDueDate,
  onConfirm,
  onCancel,
}) => {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: undefined as unknown as typeof REASON_OPTIONS[number], otherText: '' },
  });

  const selectedReason = watch('reason');

  const onSubmit = (values: FormValues) => {
    onConfirm(values.reason === 'Other' ? (values.otherText ?? '') : values.reason);
  };

  return (
    <div className={styles['modal-overlay']} onClick={onCancel}>
      <div className={styles['modal-content']} onClick={e => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h2>Due Date Changed</h2>
          <button className={styles['modal-close']} onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={styles['modal-body']}>
            <p className={styles['modal-work-item']}>
              <strong>Work Item #{workItemId}:</strong> {workItemTitle}
            </p>
            <div className={styles['date-change-info']}>
              <div className={styles['date-item']}>
                <span className={styles['date-label']}>Previous Due Date:</span>
                <span className={styles['date-value']}>{formatDate(oldDueDate)}</span>
              </div>
              <div className={styles['date-item']}>
                <span className={styles['date-label']}>New Due Date:</span>
                <span className={styles['date-value']}>{formatDate(newDueDate)}</span>
              </div>
            </div>
            <p className={styles['modal-prompt']}>Please select a reason for this change:</p>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <div className={styles['reason-options']}>
                  {REASON_OPTIONS.map(reason => (
                    <label key={reason} className={styles['reason-option']}>
                      <input
                        type="radio"
                        value={reason}
                        checked={field.value === reason}
                        onChange={() => field.onChange(reason)}
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              )}
            />
            {errors.reason && <p className={styles['field-error']}>{errors.reason.message}</p>}
            {selectedReason === 'Other' && (
              <div className={styles['other-input-container']}>
                <Controller
                  control={control}
                  name="otherText"
                  render={({ field }) => (
                    <>
                      <label htmlFor="other-reason">Please specify:</label>
                      <textarea
                        {...field}
                        id="other-reason"
                        className={styles['other-input']}
                        placeholder="Enter reason..."
                        rows={3}
                      />
                    </>
                  )}
                />
                {errors.otherText && <p className={styles['field-error']}>{errors.otherText.message}</p>}
              </div>
            )}
          </div>
          <div className={styles['modal-footer']}>
            <button type="button" className={styles['modal-btn'] + ' ' + styles['modal-btn-cancel']} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles['modal-btn'] + ' ' + styles['modal-btn-confirm']}>
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
