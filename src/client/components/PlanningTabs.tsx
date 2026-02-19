import React from 'react';

type PlanningTab = 'cycle-time' | 'dev-stats' | 'qa' | 'roadmap' | 'releases';

interface PlanningTabsProps {
  activeTab: PlanningTab;
  onNavigate: (tab: PlanningTab) => void;
}

const TABS: { id: PlanningTab; label: string }[] = [
  { id: 'cycle-time', label: 'Cycle Time' },
  { id: 'dev-stats', label: 'Developer Stats' },
  { id: 'qa', label: 'QA Metrics' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'releases', label: 'Releases' },
];

export const PlanningTabs: React.FC<PlanningTabsProps> = ({ activeTab, onNavigate }) => (
  <div className="planning-tabs">
    {TABS.map(({ id, label }) => (
      <button
        key={id}
        className={`tab-button ${activeTab === id ? 'active' : ''}`}
        onClick={() => onNavigate(id)}
      >
        {label}
      </button>
    ))}
  </div>
);
