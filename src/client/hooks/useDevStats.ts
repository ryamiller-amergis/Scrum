import { useState, useMemo, useEffect } from 'react';

export const TEAMS_CONFIG = [
  { id: 'all', name: 'All Teams' },
  { id: 'maxview-dev', name: 'MaxView - Dev', teamName: 'MaxView - Dev', project: 'MaxView' },
  { id: 'maxview-infra', name: 'MaxView Infra Team', teamName: 'MaxView Infra Team', project: 'MaxView' },
  { id: 'mobile-dev', name: 'Mobile - Dev', teamName: 'Mobile - Dev', project: 'MaxView' },
] as const;

export type TeamConfig = typeof TEAMS_CONFIG[number];

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface UseDevStatsReturn {
  selectedDeveloper: string;
  setSelectedDeveloper: (v: string) => void;
  timeFrame: string;
  setTimeFrame: (v: string) => void;
  customFromDate: string;
  setCustomFromDate: (v: string) => void;
  customToDate: string;
  setCustomToDate: (v: string) => void;
  selectedTeam: string;
  setSelectedTeam: (v: string) => void;
  loadingMembers: boolean;
  /** Combined team members for filtering (the currently-selected team or all teams) */
  activeMemberList: string[];
  teams: typeof TEAMS_CONFIG;
  dateRange: DateRange;
  isCustomDateInvalid: boolean;
}

export function useDevStats(): UseDevStatsReturn {
  const [selectedDeveloper, setSelectedDeveloper] = useState('all');
  const [timeFrame, setTimeFrame] = useState('30');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (selectedTeam === 'all') {
        try {
          setLoadingMembers(true);
          const response = await fetch('/api/dev-team-members', { credentials: 'include' });
          if (response.ok) {
            const members = await response.json();
            setAllTeamMembers(members);
            setTeamMembers([]);
          }
        } catch {
          setAllTeamMembers([]);
        } finally {
          setLoadingMembers(false);
        }
        return;
      }

      const team = TEAMS_CONFIG.find(t => t.id === selectedTeam);
      if (!team || !('teamName' in team)) return;

      try {
        setLoadingMembers(true);
        const params = new URLSearchParams({ project: team.project, teamName: team.teamName });
        const response = await fetch(`/api/team-members?${params}`, { credentials: 'include' });
        if (response.ok) {
          const members = await response.json();
          setTeamMembers(members);
          setAllTeamMembers([]);
        }
      } catch {
        setTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [selectedTeam]);

  const activeMemberList = selectedTeam === 'all' ? allTeamMembers : teamMembers;

  const dateRange = useMemo<DateRange>(() => {
    const toDate = new Date().toISOString().split('T')[0];
    if (timeFrame === 'custom') {
      return { fromDate: customFromDate, toDate: customToDate };
    }
    const from = new Date();
    from.setDate(from.getDate() - parseInt(timeFrame));
    return { fromDate: from.toISOString().split('T')[0], toDate };
  }, [timeFrame, customFromDate, customToDate]);

  const handleSetSelectedTeam = (team: string) => {
    setSelectedTeam(team);
    setSelectedDeveloper('all');
  };

  return {
    selectedDeveloper,
    setSelectedDeveloper,
    timeFrame,
    setTimeFrame,
    customFromDate,
    setCustomFromDate,
    customToDate,
    setCustomToDate,
    selectedTeam,
    setSelectedTeam: handleSetSelectedTeam,
    loadingMembers,
    activeMemberList,
    teams: TEAMS_CONFIG,
    dateRange,
    isCustomDateInvalid: timeFrame === 'custom' && (!customFromDate || !customToDate),
  };
}
