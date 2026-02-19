import React from 'react';
import type { TEAMS_CONFIG } from '../hooks/useDevStats';

type TeamConfig = typeof TEAMS_CONFIG[number];

interface DevStatsFiltersProps {
  teams: readonly TeamConfig[];
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  selectedDeveloper: string;
  onDeveloperChange: (dev: string) => void;
  dropdownDevelopers: string[];
  loadingMembers: boolean;
  timeFrame: string;
  onTimeFrameChange: (tf: string) => void;
  customFromDate: string;
  onCustomFromDateChange: (d: string) => void;
  customToDate: string;
  onCustomToDateChange: (d: string) => void;
}

export const DevStatsFilters: React.FC<DevStatsFiltersProps> = ({
  teams,
  selectedTeam,
  onTeamChange,
  selectedDeveloper,
  onDeveloperChange,
  dropdownDevelopers,
  loadingMembers,
  timeFrame,
  onTimeFrameChange,
  customFromDate,
  onCustomFromDateChange,
  customToDate,
  onCustomToDateChange,
}) => (
  <div className="filter-controls">
    <div className="filter-row">
      <div className="filter-group">
        <label htmlFor="team-filter">Team:</label>
        <select
          id="team-filter"
          value={selectedTeam}
          onChange={e => onTeamChange(e.target.value)}
          className="filter-select"
        >
          {teams.map(team => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="developer-filter">Developer:</label>
        <select
          id="developer-filter"
          value={selectedDeveloper}
          onChange={e => onDeveloperChange(e.target.value)}
          className="filter-select"
          disabled={loadingMembers}
        >
          <option value="all">
            {selectedTeam === 'all' ? 'All Developers' : 'All Team Members'}
          </option>
          {dropdownDevelopers.map(dev => (
            <option key={dev} value={dev}>{dev}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="timeframe-filter">Time Frame:</label>
        <select
          id="timeframe-filter"
          value={timeFrame}
          onChange={e => onTimeFrameChange(e.target.value)}
          className="filter-select"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 6 months</option>
          <option value="365">Last year</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>
    </div>

    {timeFrame === 'custom' && (
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="from-date">From:</label>
          <input
            id="from-date"
            type="date"
            value={customFromDate}
            onChange={e => onCustomFromDateChange(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="to-date">To:</label>
          <input
            id="to-date"
            type="date"
            value={customToDate}
            onChange={e => onCustomToDateChange(e.target.value)}
            className="filter-input"
          />
        </div>
      </div>
    )}
  </div>
);
