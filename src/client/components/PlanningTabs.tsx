import React from 'react';

type PlanningTab = 'cycle-time' | 'dev-stats' | 'qa' | 'ai-analysis' | 'roadmap' | 'releases';

interface PlanningTabsProps {
  activeTab: PlanningTab;
  onNavigate: (tab: PlanningTab) => void;
}

const TABS: { id: PlanningTab; label: string }[] = [
  // { id: 'cycle-time', label: 'Cycle Time' }, // Hidden — not currently in use
  { id: 'dev-stats', label: 'Developer Stats' },
  { id: 'qa', label: 'QA Metrics' },
  { id: 'ai-analysis', label: 'AI Analysis' },
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
