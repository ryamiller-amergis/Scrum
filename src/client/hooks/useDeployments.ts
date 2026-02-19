import { useState } from 'react';
import type { DeploymentEnvironment } from '../types/workitem';

export interface DeploymentForm {
  environment: DeploymentEnvironment;
  notes: string;
}

export function useDeployments(
  selectedRelease: string | null,
  releaseWorkItemIds: number[],
  onSuccess: () => void
) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<DeploymentForm>({ environment: 'dev', notes: '' });
  const [isCreating, setIsCreating] = useState(false);

  const openModal = () => setShowModal(true);
  const closeModal = () => {
    setShowModal(false);
    setForm({ environment: 'dev', notes: '' });
  };

  const createDeployment = async () => {
    if (!selectedRelease) return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseVersion: selectedRelease,
          environment: form.environment,
          workItemIds: releaseWorkItemIds,
          notes: form.notes,
        }),
      });
      if (response.ok) {
        closeModal();
        onSuccess();
      }
    } finally {
      setIsCreating(false);
    }
  };

  return { showModal, openModal, closeModal, form, setForm, createDeployment, isCreating };
}
