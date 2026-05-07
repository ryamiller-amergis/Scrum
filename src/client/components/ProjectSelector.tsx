import React from 'react';
import { useProjects } from '../hooks/useProjects';
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
          <svg viewBox="38 -4 78 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M41.5675 24.5315H48.7723C48.9238 24.5315 49.0593 24.4283 49.1071 24.2854C52.0832 14.5842 60.8596 8.70941 71.2793 8.06638C71.7024 8.04255 71.6861 7.38361 71.2633 7.35186C56.4235 6.2166 43.8096 15.5686 41.2324 24.087C41.1686 24.3093 41.3363 24.5315 41.5754 24.5315H41.5675Z" fill="#5ACCA6"/>
            <path d="M101.605 24.5313H108.499C108.754 24.5313 108.937 24.301 108.889 24.0549C106.36 10.5033 91.6402 -0.960387 71.6221 0.0637259C65.032 0.405096 59.5906 2.4692 56.5189 4.94612C56.1918 5.20811 56.4711 5.73206 56.87 5.5971C61.4737 4.05698 66.5637 3.42979 71.5503 3.62033C86.5499 4.19986 98.757 14.568 101.206 24.2058C101.254 24.3884 101.406 24.5313 101.597 24.5313H101.605Z" fill="#5ACCA6"/>
          </svg>
        </div>
        <h1 className={styles.title}>
          Amergis <span className={styles.titleAccent}>Scrum</span>
        </h1>
        <p className={styles.subtitle}>Select a project to get started</p>
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
