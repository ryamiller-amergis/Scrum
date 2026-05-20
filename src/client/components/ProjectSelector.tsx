import React from 'react';
import { useProjects } from '../hooks/useProjects';
import { BrandLogo } from './BrandLogo';
import styles from './ProjectSelector.module.css';

interface ProjectSelectorProps {
  selectedProject: string;
  onSelect: (project: string) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  selectedProject,
  onSelect,
}) => {
  const { data: projects = [], isLoading, isError } = useProjects();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.logoMark}>
          <BrandLogo />
        </div>
        <p className={styles.subtitle}>Select a project to start planning</p>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Loading projects…</span>
        </div>
      ) : isError ? (
        <p className={styles.errorMsg}>Could not load projects. Check your ADO connection.</p>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`${styles.card} ${project.name === selectedProject ? styles.cardSelected : ''}`}
              onClick={() => onSelect(project.name)}
              type="button"
            >
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className={styles.cardBody}>
                <span className={styles.cardName}>{project.name}</span>
                {project.description && (
                  <span className={styles.cardMeta}>{project.description}</span>
                )}
              </div>
              {project.name === selectedProject && (
                <div className={styles.cardBadge}>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
