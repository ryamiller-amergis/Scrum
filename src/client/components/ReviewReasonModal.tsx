import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import styles from './ReviewReasonModal.module.css';

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

const revisionSchema = z.object({
  reason: z.string().min(1, 'Revision notes are required'),
});

type FormValues = z.infer<typeof rejectSchema>;

interface ReviewReasonModalProps {
  mode: 'reject' | 'revision';
  itemName: string;
  docTypeName?: string;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const COPY = {
  reject: {
    title: (docType: string) => `Reject ${docType}`,
    body: 'Provide a reason for rejecting',
    placeholder: 'Reason for rejection…',
    pendingLabel: 'Rejecting…',
    confirmLabel: 'Confirm Reject',
  },
  revision: {
    title: () => 'Request Revision',
    body: 'Describe what needs to change in',
    placeholder: 'What needs to change?',
    pendingLabel: 'Submitting…',
    confirmLabel: 'Confirm',
  },
} as const;

export const ReviewReasonModal: React.FC<ReviewReasonModalProps> = ({
  mode,
  itemName,
  docTypeName = 'document',
  isPending,
  onConfirm,
  onCancel,
}) => {
  const schema = useMemo(
    () => (mode === 'reject' ? rejectSchema : revisionSchema),
    [mode],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const onSubmit = (values: FormValues) => {
    onConfirm(values.reason);
  };

  const copy = COPY[mode];
  const btnClass = mode === 'reject' ? styles.btnReject : styles.btnConfirm;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-reason-title"
    >
      <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
        <h2 className={styles.title} id="review-reason-title">
          {copy.title(docTypeName)}
        </h2>

        <p className={styles.body}>
          {copy.body}{' '}
          <span className={styles.itemName}>&ldquo;{itemName}&rdquo;</span>.
          This will be shown to the author.
        </p>

        <div className={styles.fieldGroup}>
          <textarea
            className={`${styles.textarea} ${errors.reason ? styles.textareaError : ''}`}
            rows={4}
            placeholder={copy.placeholder}
            autoFocus
            {...register('reason')}
          />
          {errors.reason && (
            <span className={styles.errorMsg}>{errors.reason.message}</span>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={isPending}
            type="button"
          >
            Cancel
          </button>
          <button
            className={btnClass}
            type="submit"
            disabled={isPending}
          >
            {isPending ? copy.pendingLabel : copy.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewReasonModal;
