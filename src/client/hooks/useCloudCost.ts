import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { azureCostService, AzureSubscription, CostData, DashboardData } from '../services/azureCostService';

const STORAGE_KEYS = {
  SELECTED_SUBSCRIPTION: 'cloudCost_selectedSubscription',
  SELECTED_RESOURCE_GROUPS: 'cloudCost_selectedResourceGroups',
  TIME_PERIOD: 'cloudCost_timePeriod',
  CUSTOM_START_DATE: 'cloudCost_customStartDate',
  CUSTOM_END_DATE: 'cloudCost_customEndDate',
  SHOW_DASHBOARD: 'cloudCost_showDashboard',
  COST_DATA: 'cloudCost_costData',
};

function save(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function load<T>(key: string, fallback: T): T {
  try {
    const item = sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch { return fallback; }
}

export interface UseCloudCostReturn {
  subscriptions: AzureSubscription[];
  isLoadingSubscriptions: boolean;
  subscriptionError: Error | null;
  dashboardData: DashboardData[];
  isLoadingDashboard: boolean;
  refreshDashboard: () => void;
  selectedSubscription: string;
  setSelectedSubscription: (v: string) => void;
  handleSubscriptionChange: (v: string) => void;
  selectedResourceGroups: string[];
  setSelectedResourceGroups: (v: string[]) => void;
  toggleResourceGroup: (rg: string) => void;
  selectAllResourceGroups: () => void;
  clearAllResourceGroups: () => void;
  timePeriod: string;
  setTimePeriod: (v: string) => void;
  customStartDate: string;
  setCustomStartDate: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  showDashboard: boolean;
  setShowDashboard: (v: boolean) => void;
  costData: CostData | null;
  isFetchingCostData: boolean;
  fetchCostData: () => Promise<void>;
  navigateToDetailedAnalysis: (subscriptionId: string, resourceGroupName: string) => Promise<void>;
  currentSubscription: AzureSubscription | undefined;
  availableResourceGroups: string[];
  filteredResourceGroups: string[];
  resourceGroupSearch: string;
  setResourceGroupSearch: (v: string) => void;
}

export function useCloudCost(): UseCloudCostReturn {
  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading: isLoadingSubscriptions, error: subscriptionQueryError } = useQuery<AzureSubscription[]>({
    queryKey: ['azureSubscriptions'],
    queryFn: () => azureCostService.getSubscriptionsWithResourceGroups(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: dashboardData = [], isLoading: isLoadingDashboard } = useQuery<DashboardData[]>({
    queryKey: ['azureDashboard'],
    queryFn: () => azureCostService.getDashboardData(5),
    staleTime: 5 * 60 * 1000,
  });

  const [selectedSubscription, setSelectedSubscription] = useState(() => load(STORAGE_KEYS.SELECTED_SUBSCRIPTION, ''));
  const [selectedResourceGroups, setSelectedResourceGroups] = useState<string[]>(() => load(STORAGE_KEYS.SELECTED_RESOURCE_GROUPS, []));
  const [timePeriod, setTimePeriod] = useState(() => load(STORAGE_KEYS.TIME_PERIOD, '30d'));
  const [customStartDate, setCustomStartDate] = useState(() => load(STORAGE_KEYS.CUSTOM_START_DATE, ''));
  const [customEndDate, setCustomEndDate] = useState(() => load(STORAGE_KEYS.CUSTOM_END_DATE, ''));
  const [showDashboard, setShowDashboard] = useState(() => load(STORAGE_KEYS.SHOW_DASHBOARD, true));
  const [costData, setCostData] = useState<CostData | null>(() => load(STORAGE_KEYS.COST_DATA, null));
  const [isFetchingCostData, setIsFetchingCostData] = useState(false);
  const [resourceGroupSearch, setResourceGroupSearch] = useState('');

  // Persist preferences
  useEffect(() => { save(STORAGE_KEYS.SELECTED_SUBSCRIPTION, selectedSubscription); }, [selectedSubscription]);
  useEffect(() => { save(STORAGE_KEYS.SELECTED_RESOURCE_GROUPS, selectedResourceGroups); }, [selectedResourceGroups]);
  useEffect(() => { save(STORAGE_KEYS.TIME_PERIOD, timePeriod); }, [timePeriod]);
  useEffect(() => { save(STORAGE_KEYS.CUSTOM_START_DATE, customStartDate); }, [customStartDate]);
  useEffect(() => { save(STORAGE_KEYS.CUSTOM_END_DATE, customEndDate); }, [customEndDate]);
  useEffect(() => { save(STORAGE_KEYS.SHOW_DASHBOARD, showDashboard); }, [showDashboard]);
  useEffect(() => { save(STORAGE_KEYS.COST_DATA, costData); }, [costData]);

  // Auto-select first subscription
  useEffect(() => {
    if (subscriptions.length > 0 && !selectedSubscription) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSubscription(subscriptions[0].subscriptionId);
    }
  }, [subscriptions, selectedSubscription]);

  const currentSubscription = useMemo(
    () => subscriptions.find(s => s.subscriptionId === selectedSubscription),
    [subscriptions, selectedSubscription]
  );

  const availableResourceGroups = currentSubscription?.resourceGroups ?? [];

  const filteredResourceGroups = useMemo(() => {
    const groups = resourceGroupSearch
      ? availableResourceGroups.filter(rg => rg.toLowerCase().includes(resourceGroupSearch.toLowerCase()))
      : availableResourceGroups;
    return [...groups].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [availableResourceGroups, resourceGroupSearch]);

  const handleSubscriptionChange = (id: string) => {
    setSelectedSubscription(id);
    setSelectedResourceGroups([]);
    setResourceGroupSearch('');
  };

  const toggleResourceGroup = (rg: string) =>
    setSelectedResourceGroups(prev => prev.includes(rg) ? prev.filter(x => x !== rg) : [...prev, rg]);

  const selectAllResourceGroups = () => setSelectedResourceGroups(availableResourceGroups);
  const clearAllResourceGroups = () => setSelectedResourceGroups([]);

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['azureDashboard'] });
  };

  const fetchCostData = async () => {
    if (!selectedSubscription || selectedResourceGroups.length === 0) return;
    if (timePeriod === 'custom' && (!customStartDate || !customEndDate)) {
      alert('Please select both start and end dates for custom range');
      return;
    }
    setIsFetchingCostData(true);
    try {
      const data = await azureCostService.getCostData(
        selectedSubscription, selectedResourceGroups, timePeriod, customStartDate, customEndDate
      );
      setCostData(data);
    } finally {
      setIsFetchingCostData(false);
    }
  };

  const navigateToDetailedAnalysis = async (subscriptionId: string, resourceGroupName: string) => {
    const subscription = subscriptions.find(s => s.subscriptionId === subscriptionId);
    let matchingRg = resourceGroupName;
    if (subscription?.resourceGroups) {
      const exact = subscription.resourceGroups.find(rg => rg === resourceGroupName);
      if (exact) {
        matchingRg = exact;
      } else {
        const caseMatch = subscription.resourceGroups.find(rg => rg.toLowerCase() === resourceGroupName.toLowerCase());
        if (caseMatch) matchingRg = caseMatch;
      }
    }
    setSelectedSubscription(subscriptionId);
    setSelectedResourceGroups([matchingRg]);
    setResourceGroupSearch('');
    setShowDashboard(false);
    setIsFetchingCostData(true);
    try {
      const data = await azureCostService.getCostData(subscriptionId, [matchingRg], timePeriod, customStartDate, customEndDate);
      setCostData(data);
    } finally {
      setIsFetchingCostData(false);
    }
  };

  return {
    subscriptions, isLoadingSubscriptions, subscriptionError: (subscriptionQueryError as Error | null) ?? null,
    dashboardData, isLoadingDashboard, refreshDashboard,
    selectedSubscription, setSelectedSubscription, handleSubscriptionChange,
    selectedResourceGroups, setSelectedResourceGroups,
    toggleResourceGroup, selectAllResourceGroups, clearAllResourceGroups,
    timePeriod, setTimePeriod,
    customStartDate, setCustomStartDate,
    customEndDate, setCustomEndDate,
    showDashboard, setShowDashboard,
    costData, isFetchingCostData, fetchCostData, navigateToDetailedAnalysis,
    currentSubscription, availableResourceGroups, filteredResourceGroups,
    resourceGroupSearch, setResourceGroupSearch,
  };
}
