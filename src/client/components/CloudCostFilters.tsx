import React, { useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AzureSubscription } from '../services/azureCostService';

const fetchSchema = z.object({
  subscription: z.string().min(1, 'Please select a subscription'),
  resourceGroups: z.array(z.string()).min(1, 'Please select at least one resource group'),
  timePeriod: z.string(),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
}).refine(
  d => d.timePeriod !== 'custom' || (!!d.customStartDate && !!d.customEndDate),
  { message: 'Both start and end dates are required for a custom range', path: ['customStartDate'] }
);

interface CloudCostFiltersProps {
  subscriptions: AzureSubscription[];
  selectedSubscription: string;
  onSubscriptionChange: (id: string) => void;
  selectedResourceGroups: string[];
  filteredResourceGroups: string[];
  availableResourceGroups: string[];
  onToggleResourceGroup: (rg: string) => void;
  onSelectAllResourceGroups: () => void;
  onClearAllResourceGroups: () => void;
  resourceGroupSearch: string;
  onResourceGroupSearchChange: (v: string) => void;
  timePeriod: string;
  onTimePeriodChange: (v: string) => void;
  customStartDate: string;
  onCustomStartDateChange: (v: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (v: string) => void;
  isFetchingCostData: boolean;
  onFetchCostData: () => void;
}

export const CloudCostFilters: React.FC<CloudCostFiltersProps> = ({
  subscriptions,
  selectedSubscription,
  onSubscriptionChange,
  selectedResourceGroups,
  filteredResourceGroups,
  availableResourceGroups,
  onToggleResourceGroup,
  onSelectAllResourceGroups,
  onClearAllResourceGroups,
  resourceGroupSearch,
  onResourceGroupSearchChange,
  timePeriod,
  onTimePeriodChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  isFetchingCostData,
  onFetchCostData,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(fetchSchema),
    values: {
      subscription: selectedSubscription,
      resourceGroups: selectedResourceGroups,
      timePeriod,
      customStartDate,
      customEndDate,
    },
  });

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isDropdownOpen]);

  const onSubmit = () => {
    onFetchCostData();
  };

  return (
    <form className="cloud-cost-filters" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="filter-group">
        <label>Subscription:</label>
        <select
          className="filter-select"
          value={selectedSubscription}
          onChange={e => onSubscriptionChange(e.target.value)}
          disabled={subscriptions.length === 0}
        >
          {subscriptions.length === 0 ? (
            <option value="">No subscriptions available</option>
          ) : (
            <>
              <option value="">Select a subscription...</option>
              {subscriptions.map(sub => (
                <option key={sub.subscriptionId} value={sub.subscriptionId}>{sub.name}</option>
              ))}
            </>
          )}
        </select>
        {errors.subscription && <p className="field-error">{errors.subscription.message}</p>}
      </div>

      <div className="filter-group resource-group-filter" ref={dropdownRef}>
        <label>Resource Groups:</label>
        <div className="multi-select-container">
          <button
            type="button"
            className="multi-select-trigger"
            onClick={() => setIsDropdownOpen(v => !v)}
            disabled={subscriptions.length === 0 || availableResourceGroups.length === 0}
          >
            <span className="multi-select-value">
              {selectedResourceGroups.length === 0
                ? 'Select resource groups...'
                : selectedResourceGroups.length === availableResourceGroups.length
                  ? 'All resource groups'
                  : `${selectedResourceGroups.length} selected`}
            </span>
            <span className={`multi-select-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
          </button>

          {isDropdownOpen && (
            <div className="multi-select-dropdown">
              <div className="multi-select-search">
                <input
                  type="text"
                  placeholder="Search resource groups..."
                  value={resourceGroupSearch}
                  onChange={e => onResourceGroupSearchChange(e.target.value)}
                  className="resource-group-search-input"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="multi-select-actions">
                <button type="button" className="select-action-btn" onClick={onSelectAllResourceGroups}>Select All</button>
                <button type="button" className="select-action-btn" onClick={onClearAllResourceGroups}>Clear All</button>
              </div>
              <div className="multi-select-options">
                {filteredResourceGroups.length > 0 ? (
                  filteredResourceGroups.map(rg => (
                    <label key={rg} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={selectedResourceGroups.includes(rg)}
                        onChange={() => onToggleResourceGroup(rg)}
                      />
                      <span>{rg}</span>
                    </label>
                  ))
                ) : (
                  <div className="no-results">No resource groups found</div>
                )}
              </div>
            </div>
          )}
        </div>
        {errors.resourceGroups && <p className="field-error">{errors.resourceGroups.message}</p>}
      </div>

      <div className="filter-group">
        <label>Time Period:</label>
        <select
          className="filter-select"
          value={timePeriod}
          onChange={e => onTimePeriodChange(e.target.value)}
          disabled={subscriptions.length === 0}
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {timePeriod === 'custom' && (
        <>
          <div className="filter-group">
            <label>Start Date:</label>
            <input
              type="date"
              className="filter-select date-input"
              value={customStartDate}
              onChange={e => onCustomStartDateChange(e.target.value)}
              max={customEndDate || new Date().toISOString().split('T')[0]}
            />
            {errors.customStartDate && <p className="field-error">{errors.customStartDate.message}</p>}
          </div>
          <div className="filter-group">
            <label>End Date:</label>
            <input
              type="date"
              className="filter-select date-input"
              value={customEndDate}
              onChange={e => onCustomEndDateChange(e.target.value)}
              min={customStartDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </>
      )}

      <div className="filter-group">
        <button
          type="submit"
          className="fetch-cost-btn"
          disabled={isFetchingCostData}
        >
          {isFetchingCostData ? 'Loading...' : 'Get Cost Data'}
        </button>
      </div>
    </form>
  );
};
