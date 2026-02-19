import React, { useMemo } from 'react';
import type { WorkItem } from '../types/workitem';
import { useDevStats } from '../hooks/useDevStats';
import { useDueDateStats } from '../hooks/useDueDateStats';
import { DevStatsFilters } from './DevStatsFilters';
import { DueDateChangesSection } from './DueDateChangesSection';
import { DueDateHitRateSection } from './DueDateHitRateSection';
import { PullRequestTimeSection } from './PullRequestTimeSection';
import { QABugStatsSection } from './QABugStatsSection';
import './DevStats.css';

interface DevStatsProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
  onSelectItem?: (item: WorkItem) => void;
}

export const DevStats: React.FC<DevStatsProps> = ({ workItems, onSelectItem }) => {
  const {
    selectedDeveloper, setSelectedDeveloper,
    timeFrame, setTimeFrame,
    customFromDate, setCustomFromDate,
    customToDate, setCustomToDate,
    selectedTeam, setSelectedTeam,
    loadingMembers, activeMemberList,
    teams, dateRange, isCustomDateInvalid,
  } = useDevStats();

  const { dueDateChanges, hitRate, prTime, qaBugs, allDevelopers } = useDueDateStats({
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    developer: selectedDeveloper,
  });

  const dropdownDevelopers = useMemo(() => {
    const combined = new Set<string>([...activeMemberList, ...allDevelopers]);
    return Array.from(combined).sort();
  }, [activeMemberList, allDevelopers]);

  const filterStats = useMemo(() => {
    const memberSet = activeMemberList.length > 0 ? new Set(activeMemberList) : null;
    return <T extends { developer: string }>(stats: T[]): T[] => {
      let result = stats;
      if (memberSet) {
        result = result.filter(s => memberSet.has(s.developer));
      }
      if (selectedDeveloper !== 'all') {
        result = result.filter(s => s.developer === selectedDeveloper);
      }
      return result;
    };
  }, [activeMemberList, selectedDeveloper]);

  return (
    <div className="dev-stats-container">
      <h2>Developer Statistics</h2>

      <DevStatsFilters
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        selectedDeveloper={selectedDeveloper}
        onDeveloperChange={setSelectedDeveloper}
        dropdownDevelopers={dropdownDevelopers}
        loadingMembers={loadingMembers}
        timeFrame={timeFrame}
        onTimeFrameChange={setTimeFrame}
        customFromDate={customFromDate}
        onCustomFromDateChange={setCustomFromDate}
        customToDate={customToDate}
        onCustomToDateChange={setCustomToDate}
      />

      <DueDateChangesSection
        stats={filterStats(dueDateChanges.data)}
        isLoading={dueDateChanges.isLoading}
        error={dueDateChanges.error}
        hasLoaded={dueDateChanges.hasLoaded}
        isCustomDateInvalid={isCustomDateInvalid}
        onLoad={dueDateChanges.load}
      />

      <DueDateHitRateSection
        stats={filterStats(hitRate.data)}
        isLoading={hitRate.isLoading}
        error={hitRate.error}
        hasLoaded={hitRate.hasLoaded}
        isCustomDateInvalid={isCustomDateInvalid}
        onLoad={hitRate.load}
        workItems={workItems}
        onSelectItem={onSelectItem}
      />

      <PullRequestTimeSection
        stats={filterStats(prTime.data)}
        isLoading={prTime.isLoading}
        error={prTime.error}
        hasLoaded={prTime.hasLoaded}
        isCustomDateInvalid={isCustomDateInvalid}
        onLoad={prTime.load}
        workItems={workItems}
        onSelectItem={onSelectItem}
      />

      <QABugStatsSection
        stats={filterStats(qaBugs.data)}
        isLoading={qaBugs.isLoading}
        error={qaBugs.error}
        hasLoaded={qaBugs.hasLoaded}
        isCustomDateInvalid={isCustomDateInvalid}
        onLoad={qaBugs.load}
        workItems={workItems}
        onSelectItem={onSelectItem}
      />
    </div>
  );
};


