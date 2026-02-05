import React, { useState, useMemo, useRef, useEffect } from 'react';
import { azureCostService, AzureSubscription, CostData } from '../services/azureCostService';
import './CloudCost.css';

interface CloudCostProps {
  project: string;
  areaPath: string;
}

export const CloudCost: React.FC<CloudCostProps> = ({ project, areaPath }) => {
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [selectedResourceGroups, setSelectedResourceGroups] = useState<string[]>([]);
  const [timePeriod, setTimePeriod] = useState<string>('30d');
  const [isResourceGroupDropdownOpen, setIsResourceGroupDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isFetchingCostData, setIsFetchingCostData] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch subscriptions on mount
  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await azureCostService.getSubscriptionsWithResourceGroups();
        setSubscriptions(data);
        
        // Auto-select first subscription if available
        if (data.length > 0) {
          setSelectedSubscription(data[0].subscriptionId);
        }
      } catch (err) {
        console.error('Failed to fetch Azure subscriptions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load Azure subscriptions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  const currentSubscription = useMemo(() => 
    subscriptions.find(sub => sub.subscriptionId === selectedSubscription),
    [subscriptions, selectedSubscription]
  );

  const availableResourceGroups = currentSubscription?.resourceGroups || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsResourceGroupDropdownOpen(false);
      }
    };

    if (isResourceGroupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isResourceGroupDropdownOpen]);

  const handleSubscriptionChange = (subscriptionId: string) => {
    setSelectedSubscription(subscriptionId);
    setSelectedResourceGroups([]); // Reset resource groups when subscription changes
  };

  const toggleResourceGroup = (rg: string) => {
    setSelectedResourceGroups(prev => 
      prev.includes(rg) 
        ? prev.filter(item => item !== rg)
        : [...prev, rg]
    );
  };

  const selectAllResourceGroups = () => {
    setSelectedResourceGroups(availableResourceGroups);
  };

  const clearAllResourceGroups = () => {
    setSelectedResourceGroups([]);
  };

  // Fetch cost data when selection changes
  useEffect(() => {
    const fetchCostData = async () => {
      if (!selectedSubscription || selectedResourceGroups.length === 0) {
        setCostData(null);
        return;
      }

      try {
        setIsFetchingCostData(true);
        console.log('Fetching cost data for:', {
          subscription: selectedSubscription,
          resourceGroups: selectedResourceGroups,
          timePeriod
        });
        const data = await azureCostService.getCostData(
          selectedSubscription,
          selectedResourceGroups,
          timePeriod
        );
        console.log('Received cost data:', {
          totalCost: data.totalCost,
          resourceGroups: data.costByResourceGroup,
          detailsCount: data.costDetails.length,
          uniqueRGs: [...new Set(data.costDetails.map(d => d.resourceGroup))],
          costByDay: data.costByDay,
          sampleDates: data.costByDay.slice(0, 3).map(d => ({ date: d.date, type: typeof d.date })),
          allServices: [...new Set(data.costDetails.map(d => d.service))],
          appInsightsResources: data.costDetails.filter(d => 
            d.service.toLowerCase().includes('insight') || 
            d.service.toLowerCase().includes('application')
          )
        });
        setCostData(data);
      } catch (err) {
        console.error('Failed to fetch cost data:', err);
        // Don't set error state, just log it
      } finally {
        setIsFetchingCostData(false);
      }
    };

    fetchCostData();
  }, [selectedSubscription, selectedResourceGroups, timePeriod]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  // Aggregate cost data based on time period for better visualization
  const aggregateCostData = (costByDay: Array<{ date: string; cost: number }>, period: string) => {
    if (!costByDay || costByDay.length === 0) return [];
    
    // For 7 days, show all days
    if (period === '7d') {
      return costByDay;
    }
    
    // For 30 days, group by week (show ~4-5 data points)
    if (period === '30d') {
      const grouped: Array<{ date: string; cost: number }> = [];
      for (let i = 0; i < costByDay.length; i += 7) {
        const weekData = costByDay.slice(i, i + 7);
        const totalCost = weekData.reduce((sum, day) => sum + day.cost, 0);
        grouped.push({
          date: weekData[0].date, // Use first day of week
          cost: totalCost
        });
      }
      return grouped;
    }
    
    // For 90 days, group by 2 weeks (show ~6-7 data points)
    if (period === '90d') {
      const grouped: Array<{ date: string; cost: number }> = [];
      for (let i = 0; i < costByDay.length; i += 14) {
        const periodData = costByDay.slice(i, i + 14);
        const totalCost = periodData.reduce((sum, day) => sum + day.cost, 0);
        grouped.push({
          date: periodData[0].date,
          cost: totalCost
        });
      }
      return grouped;
    }
    
    return costByDay;
  };

  const getInfoContent = (section: string) => {
    const content: { [key: string]: { title: string; description: string; keyPoints: string[]; insight: string } } = {
      'total-spend': {
        title: 'Total Spend',
        description: 'Sum of all Azure costs across selected resource groups',
        keyPoints: [
          'Includes all services, resources, and usage charges',
          'Covers the entire selected time period',
          'Percentage shows trend: first half vs second half'
        ],
        insight: 'Use this to track overall cloud spending and identify budget alignment'
      },
      'daily-average': {
        title: 'Daily Average',
        description: 'Total cost divided by number of days',
        keyPoints: [
          'Normalizes costs across different time ranges',
          'Enables comparison between periods',
          'Useful for forecasting future costs'
        ],
        insight: 'Identify unusual spending days and establish baseline costs'
      },
      'projected-monthly': {
        title: 'Projected Monthly Cost',
        description: 'Estimated monthly spending based on current daily average × 30',
        keyPoints: [
          'Assumes current usage patterns continue',
          'Helps predict upcoming bills',
          'Updates as usage patterns change'
        ],
        insight: 'Note: Actual costs may vary based on usage changes or new resources'
      },
      'cost-trend': {
        title: 'Cost Trend',
        description: 'Visual representation of daily spending patterns',
        keyPoints: [
          'Peak Day: Highest cost in the period',
          'Lowest Day: Minimum cost baseline',
          'Trend Direction: Overall cost trajectory'
        ],
        insight: 'Look for spikes that may indicate misconfigured resources or optimization opportunities'
      },
      'cost-by-rg': {
        title: 'Cost by Resource Group',
        description: 'Total costs grouped by Azure resource groups',
        keyPoints: [
          'Identifies which projects drive costs',
          'Shows team/application spending',
          '$0.00 = No billable usage in period'
        ],
        insight: 'Use this to allocate costs and identify high-spend areas'
      },
      'cost-details': {
        title: 'Cost Details',
        description: 'Granular breakdown by resource group, service, and resource',
        keyPoints: [
          'Daily Cost: Average per day',
          'Total Cost: Sum for entire period',
          'Trend: First half vs second half comparison'
        ],
        insight: 'Drill down to specific resources driving your Azure spending'
      }
    };
    return content[section] || { title: '', description: '', keyPoints: [], insight: '' };
  };

  return (
    <div className="cloud-cost">
      {openInfoModal && (
        <div className="info-modal-overlay" onClick={() => setOpenInfoModal(null)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h3>{getInfoContent(openInfoModal).title}</h3>
              <button className="close-button" onClick={() => setOpenInfoModal(null)}>×</button>
            </div>
            <div className="info-modal-content">
              <p className="modal-description">{getInfoContent(openInfoModal).description}</p>
              <div className="modal-section">
                <h4>Key Points</h4>
                <ul className="key-points-list">
                  {getInfoContent(openInfoModal).keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="modal-insight">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="insight-icon">
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </svg>
                <span>{getInfoContent(openInfoModal).insight}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="cloud-cost-header">
        <h2>Cloud Cost Analytics</h2>
        {isLoading ? (
          <div className="loading-message">Loading Azure subscriptions...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="cloud-cost-filters">
            <div className="filter-group">
              <label>Subscription:</label>
              <select 
                className="filter-select"
                value={selectedSubscription}
                onChange={(e) => handleSubscriptionChange(e.target.value)}
                disabled={subscriptions.length === 0}
              >
                {subscriptions.length === 0 ? (
                  <option value="">No subscriptions available</option>
                ) : (
                  subscriptions.map(sub => (
                    <option key={sub.subscriptionId} value={sub.subscriptionId}>
                      {sub.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          
          <div className="filter-group resource-group-filter" ref={dropdownRef}>
            <label>Resource Groups:</label>
            <div className="multi-select-container">
              <button 
                className="multi-select-trigger"
                onClick={() => setIsResourceGroupDropdownOpen(!isResourceGroupDropdownOpen)}
                disabled={subscriptions.length === 0 || availableResourceGroups.length === 0}
              >
                <span className="multi-select-value">
                  {selectedResourceGroups.length === 0 
                    ? 'Select resource groups...'
                    : selectedResourceGroups.length === availableResourceGroups.length
                    ? 'All resource groups'
                    : `${selectedResourceGroups.length} selected`
                  }
                </span>
                <span className={`multi-select-arrow ${isResourceGroupDropdownOpen ? 'open' : ''}`}>▼</span>
              </button>
              
              {isResourceGroupDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-actions">
                    <button 
                      className="select-action-btn"
                      onClick={selectAllResourceGroups}
                    >
                      Select All
                    </button>
                    <button 
                      className="select-action-btn"
                      onClick={clearAllResourceGroups}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="multi-select-options">
                    {availableResourceGroups.map(rg => (
                      <label key={rg} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={selectedResourceGroups.includes(rg)}
                          onChange={() => toggleResourceGroup(rg)}
                        />
                        <span>{rg}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>Time Period:</label>
            <select 
              className="filter-select"
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              disabled={subscriptions.length === 0}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>
        )}
      </div>

      <div className="cloud-cost-content">
        {selectedResourceGroups.length === 0 ? (
          <div className="no-selection-message">
            <p>Please select at least one resource group to view cost data.</p>
          </div>
        ) : isFetchingCostData ? (
          <div className="loading-cost-data">
            <div className="spinner"></div>
            <p>Loading cost data...</p>
          </div>
        ) : (
          <>
            <div className="cost-overview">
              <div className="cost-card">
                <div className="card-header">
                  <h3>Total Spend</h3>
                  <div className="info-icon" onClick={() => setOpenInfoModal('total-spend')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                    </svg>
                  </div>
                </div>
                <div className="cost-value">{formatCurrency(costData?.totalCost || 0)}</div>
                <div className={`cost-change ${(costData?.percentChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentChange(costData?.percentChange || 0)} from last period
                </div>
              </div>
              <div className="cost-card">
                <div className="card-header">
                  <h3>Daily Average</h3>
                  <div className="info-icon" onClick={() => setOpenInfoModal('daily-average')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                    </svg>
                  </div>
                </div>
                <div className="cost-value">{formatCurrency(costData?.dailyAverage || 0)}</div>
                <div className="cost-change">Over {timePeriod === '7d' ? '7' : timePeriod === '30d' ? '30' : '90'} days</div>
              </div>
              <div className="cost-card">
                <div className="card-header">
                  <h3>Projected Monthly</h3>
                  <div className="info-icon" onClick={() => setOpenInfoModal('projected-monthly')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                    </svg>
                  </div>
                </div>
                <div className="cost-value">{formatCurrency(costData?.projectedMonthly || 0)}</div>
                <div className="cost-change">Based on current usage</div>
              </div>
            </div>

            <div className="cost-charts">
              <div className="chart-container">
                <div className="section-header">
                  <h3>Cost Trend</h3>
                  <div className="info-icon" onClick={() => setOpenInfoModal('cost-trend')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                    </svg>
                  </div>
                </div>
                {costData && costData.costByDay.length > 0 ? (
                  <>
                    <div className="trend-summary">
                      <div className="trend-stat">
                        <span className="trend-label">Peak Day</span>
                        <span className="trend-value">
                          {formatCurrency(Math.max(...costData.costByDay.map(d => d.cost)))}
                        </span>
                      </div>
                      <div className="trend-stat">
                        <span className="trend-label">Lowest Day</span>
                        <span className="trend-value">
                          {formatCurrency(Math.min(...costData.costByDay.map(d => d.cost)))}
                        </span>
                      </div>
                      <div className="trend-stat">
                        <span className="trend-label">Trend Direction</span>
                        <span className={`trend-value ${costData.percentChange >= 0 ? 'trend-up' : 'trend-down'}`}>
                          {costData.percentChange >= 0 ? '↗' : '↘'} {formatPercentChange(costData.percentChange)}
                        </span>
                      </div>
                    </div>
                    <div className="cost-chart">
                      <div className="chart-y-axis">
                        {(() => {
                          const aggregatedData = aggregateCostData(costData.costByDay, timePeriod);
                          const maxCost = Math.max(...aggregatedData.map(d => d.cost));
                          const steps = 5;
                          const stepValue = maxCost / steps;
                          return Array.from({ length: steps + 1 }, (_, i) => (
                            <div key={i} className="y-axis-label">
                              <span>{formatCurrency(stepValue * (steps - i))}</span>
                            </div>
                          ));
                        })()}
                      </div>
                      <div className="chart-content">
                        <div className="chart-grid">
                          {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} className="grid-line" />
                          ))}
                        </div>
                        <div className="chart-bars">
                          {aggregateCostData(costData.costByDay, timePeriod).map((day, index, array) => {
                            const aggregatedData = aggregateCostData(costData.costByDay, timePeriod);
                            const maxCost = Math.max(...aggregatedData.map(d => d.cost));
                            const heightPercent = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
                            
                            // Parse date - handle both YYYY-MM-DD and YYYYMMDD formats
                            let formattedDate = '';
                            try {
                              let dateStr = day.date.toString();
                              let year, month, dayNum;
                              
                              if (dateStr.includes('-')) {
                                // Format: YYYY-MM-DD
                                const dateParts = dateStr.split('-');
                                year = parseInt(dateParts[0]);
                                month = parseInt(dateParts[1]) - 1;
                                dayNum = parseInt(dateParts[2]);
                              } else if (dateStr.length === 8) {
                                // Format: YYYYMMDD
                                year = parseInt(dateStr.substring(0, 4));
                                month = parseInt(dateStr.substring(4, 6)) - 1;
                                dayNum = parseInt(dateStr.substring(6, 8));
                              } else {
                                formattedDate = dateStr;
                                throw new Error('Unknown format');
                              }
                              
                              const dateObj = new Date(year, month, dayNum);
                              formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            } catch (e) {
                              console.error('Date parsing error:', e, 'for date:', day.date);
                              formattedDate = day.date.toString();
                            }
                            
                            return (
                              <div key={index} className="chart-bar-wrapper">
                                <div 
                                  className="chart-bar" 
                                  style={{ height: `${heightPercent}%` }}
                                  title={`${formattedDate}: ${formatCurrency(day.cost)}`}
                                >
                                  <span className="bar-value">{formatCurrency(day.cost)}</span>
                                </div>
                                <span className="bar-label">{formattedDate}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="chart-placeholder">
                    <p>No cost trend data available</p>
                  </div>
                )}
              </div>
              <div className="chart-container">
                <div className="section-header">
                  <h3>Cost by Resource Group</h3>
                  <div className="info-icon" onClick={() => setOpenInfoModal('cost-by-rg')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                    </svg>
                  </div>
                </div>
                <div className="rg-breakdown">
                  {costData && costData.costByResourceGroup.length > 0 ? (
                    <table className="rg-breakdown-table">
                      <thead>
                        <tr>
                          <th>Resource Group</th>
                          <th>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costData.costByResourceGroup
                          .sort((a, b) => b.cost - a.cost)
                          .map((rg, index) => (
                            <tr key={index}>
                              <td>{rg.name}</td>
                              <td className="total-cost">{formatCurrency(rg.cost)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No resource group data available</p>
                  )}
                </div>
              </div>
            </div>

            <div className="cost-details">
              <div className="section-header">
                <h3>Cost Details</h3>
                <div className="info-icon" onClick={() => setOpenInfoModal('cost-details')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                  </svg>
                </div>
              </div>
              
              {costData && costData.costDetails.some(d => d.service.toLowerCase().includes('operationalinsights')) && (
                <div className="cost-info-banner">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="banner-icon">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                  </svg>
                  <div className="banner-content">
                    <strong>Workspace-Based Services:</strong> Log Analytics workspace costs include charges from connected services like Application Insights, Container Insights, and VM Insights. These services store their data in the workspace and are billed under the workspace resource.
                  </div>
                </div>
              )}
              
              <div className="cost-table">
                <table>
                  <thead>
                    <tr>
                      <th>Resource Group</th>
                      <th>Service</th>
                      <th>Resource</th>
                      <th>Daily Cost</th>
                      <th>Total Cost</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costData && costData.costDetails.length > 0 ? (
                      costData.costDetails.map((detail, index) => (
                        <tr key={index}>
                          <td>{detail.resourceGroup}</td>
                          <td>{detail.service}</td>
                          <td>{detail.resource}</td>
                          <td>{formatCurrency(detail.dailyCost)}</td>
                          <td className="total-cost">{formatCurrency(detail.totalCost)}</td>
                          <td className={`trend ${detail.trend >= 0 ? 'up' : 'down'}`}>
                            {formatPercentChange(detail.trend)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="no-data">
                          No billable resources found with costs in the selected time period.
                          Resources with $0.00 spend are not displayed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
