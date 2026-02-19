import React, { useState } from 'react';
import { useCloudCost } from '../hooks/useCloudCost';
import { CloudCostFilters } from './CloudCostFilters';
import './CloudCost.css';

interface CloudCostProps {
  project: string;
  areaPath: string;
}

const INFO_CONTENT: Record<string, { title: string; description: string; keyPoints: string[]; insight: string }> = {
  'total-spend': {
    title: 'Total Spend',
    description: 'Sum of all Azure costs across selected resource groups',
    keyPoints: ['Includes all services, resources, and usage charges', 'Covers the entire selected time period', 'Percentage shows trend: first half vs second half'],
    insight: 'Use this to track overall cloud spending and identify budget alignment',
  },
  'daily-average': {
    title: 'Daily Average',
    description: 'Total cost divided by number of days',
    keyPoints: ['Normalizes costs across different time ranges', 'Enables comparison between periods', 'Useful for forecasting future costs'],
    insight: 'Identify unusual spending days and establish baseline costs',
  },
  'projected-monthly': {
    title: 'Projected Monthly Cost',
    description: 'Estimated monthly spending based on current daily average × 30',
    keyPoints: ['Assumes current usage patterns continue', 'Helps predict upcoming bills', 'Updates as usage patterns change'],
    insight: 'Note: Actual costs may vary based on usage changes or new resources',
  },
  'cost-trend': {
    title: 'Cost Trend',
    description: 'Visual representation of daily spending patterns',
    keyPoints: ['Peak Day: Highest cost in the period', 'Lowest Day: Minimum cost baseline', 'Trend Direction: Overall cost trajectory'],
    insight: 'Look for spikes that may indicate misconfigured resources or optimization opportunities',
  },
  'cost-by-rg': {
    title: 'Cost by Resource Group',
    description: 'Total costs grouped by Azure resource groups',
    keyPoints: ['Identifies which projects drive costs', 'Shows team/application spending', '$0.00 = No billable usage in period'],
    insight: 'Use this to allocate costs and identify high-spend areas',
  },
  'cost-details': {
    title: 'Cost Details',
    description: 'Granular breakdown by resource group, service, and resource',
    keyPoints: ['Daily Cost: Average per day', 'Total Cost: Sum for entire period', 'Trend: First half vs second half comparison'],
    insight: 'Drill down to specific resources driving your Azure spending',
  },
};

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
  </svg>
);

function aggregateCostData(costByDay: Array<{ date: string; cost: number }>, period: string) {
  if (!costByDay?.length) return [];
  if (period === '7d') return costByDay;
  const chunkSize = period === '30d' ? 7 : 14;
  const grouped: Array<{ date: string; cost: number }> = [];
  for (let i = 0; i < costByDay.length; i += chunkSize) {
    const chunk = costByDay.slice(i, i + chunkSize);
    grouped.push({ date: chunk[0].date, cost: chunk.reduce((s, d) => s + d.cost, 0) });
  }
  return grouped;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function formatPercentChange(change: number) {
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function formatBarDate(dateStr: string) {
  try {
    const s = dateStr.toString();
    let year: number, month: number, day: number;
    if (s.includes('-')) {
      [year, month, day] = s.split('-').map(Number);
      month -= 1;
    } else if (s.length === 8) {
      year = +s.slice(0, 4); month = +s.slice(4, 6) - 1; day = +s.slice(6, 8);
    } else {
      return s;
    }
    return new Date(year, month, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const CloudCost: React.FC<CloudCostProps> = () => {
  const [openInfoModal, setOpenInfoModal] = useState<string | null>(null);

  const {
    subscriptions, isLoadingSubscriptions, subscriptionError,
    dashboardData, isLoadingDashboard, refreshDashboard,
    selectedSubscription, handleSubscriptionChange,
    selectedResourceGroups, toggleResourceGroup, selectAllResourceGroups, clearAllResourceGroups,
    timePeriod, setTimePeriod,
    customStartDate, setCustomStartDate,
    customEndDate, setCustomEndDate,
    showDashboard, setShowDashboard,
    costData, isFetchingCostData, fetchCostData, navigateToDetailedAnalysis,
    availableResourceGroups, filteredResourceGroups, resourceGroupSearch, setResourceGroupSearch,
  } = useCloudCost();

  const info = openInfoModal ? INFO_CONTENT[openInfoModal] : null;

  return (
    <div className="cloud-cost">
      {openInfoModal && info && (
        <div className="info-modal-overlay" onClick={() => setOpenInfoModal(null)}>
          <div className="info-modal" onClick={e => e.stopPropagation()}>
            <div className="info-modal-header">
              <h3>{info.title}</h3>
              <button className="close-button" onClick={() => setOpenInfoModal(null)}>×</button>
            </div>
            <div className="info-modal-content">
              <p className="modal-description">{info.description}</p>
              <div className="modal-section">
                <h4>Key Points</h4>
                <ul className="key-points-list">{info.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
              <div className="modal-insight">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="insight-icon">
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </svg>
                <span>{info.insight}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="cloud-cost-header">
        <div className="header-title-row">
          <h2>Cloud Cost Analytics</h2>
          <div className="header-actions">
            <div className="view-toggle">
              <button className={`toggle-btn ${showDashboard ? 'active' : ''}`} onClick={() => setShowDashboard(true)}>Dashboard</button>
              <button className={`toggle-btn ${!showDashboard ? 'active' : ''}`} onClick={() => setShowDashboard(false)}>Detailed Analysis</button>
            </div>
            {showDashboard && (
              <button className="refresh-btn" onClick={refreshDashboard} disabled={isLoadingDashboard} title="Refresh dashboard data">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={isLoadingDashboard ? 'spinning' : ''}>
                  <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                  <path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                </svg>
                Refresh
              </button>
            )}
          </div>
        </div>

        {subscriptionError ? (
          <div className="error-message">{subscriptionError.message}</div>
        ) : isLoadingSubscriptions ? (
          <div className="loading-message">Loading Azure subscriptions...</div>
        ) : !showDashboard ? (
          <CloudCostFilters
            subscriptions={subscriptions}
            selectedSubscription={selectedSubscription}
            onSubscriptionChange={handleSubscriptionChange}
            selectedResourceGroups={selectedResourceGroups}
            filteredResourceGroups={filteredResourceGroups}
            availableResourceGroups={availableResourceGroups}
            onToggleResourceGroup={toggleResourceGroup}
            onSelectAllResourceGroups={selectAllResourceGroups}
            onClearAllResourceGroups={clearAllResourceGroups}
            resourceGroupSearch={resourceGroupSearch}
            onResourceGroupSearchChange={setResourceGroupSearch}
            timePeriod={timePeriod}
            onTimePeriodChange={setTimePeriod}
            customStartDate={customStartDate}
            onCustomStartDateChange={setCustomStartDate}
            customEndDate={customEndDate}
            onCustomEndDateChange={setCustomEndDate}
            isFetchingCostData={isFetchingCostData}
            onFetchCostData={fetchCostData}
          />
        ) : null}
      </div>

      <div className="cloud-cost-content">
        {showDashboard ? (
          isLoadingDashboard ? (
            <div className="loading-cost-data"><div className="spinner" /><p>Loading dashboard data...</p></div>
          ) : dashboardData.length === 0 ? (
            <div className="no-selection-message"><p>No cost data available across subscriptions.</p></div>
          ) : (
            <div className="dashboard-view">
              <div className="dashboard-header">
                <h3>Top Resource Groups by Cost (Last 30 Days)</h3>
                <p className="dashboard-subtitle">Quick overview of cost drivers across all subscriptions</p>
              </div>
              <div className="dashboard-grid">
                {dashboardData.map(sub => (
                  <div key={sub.subscriptionId} className="dashboard-subscription-card">
                    <div className="subscription-header">
                      <h4>{sub.subscriptionName}</h4>
                      <span className="subscription-id">{sub.subscriptionId}</span>
                    </div>
                    {sub.topResourceGroups.length === 0 ? (
                      <div className="no-costs"><p>No billable resources in this subscription</p></div>
                    ) : (
                      <div className="resource-group-list">
                        {sub.topResourceGroups.map((rg, i) => (
                          <div key={rg.name} className="rg-item clickable" onClick={() => navigateToDetailedAnalysis(sub.subscriptionId, rg.name)} title="Click to view detailed analysis">
                            <div className="rg-rank">{i + 1}</div>
                            <div className="rg-details">
                              <div className="rg-name">{rg.name}</div>
                              <div className="rg-cost-row">
                                <span className="rg-cost">{formatCurrency(rg.cost)}</span>
                                <span className={`rg-trend ${rg.trend >= 0 ? 'trend-up' : 'trend-down'}`}>
                                  {rg.trend >= 0 ? '↗' : '↘'} {formatPercentChange(rg.trend)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="dashboard-footer">
                <p>Click any resource group to view detailed analysis, or use "Detailed Analysis" above to create custom filters</p>
              </div>
            </div>
          )
        ) : (
          <>
            {!costData && !isFetchingCostData ? (
              <div className="no-selection-message"><p>Please select a subscription, resource group(s), and click "Get Cost Data" to view analytics.</p></div>
            ) : isFetchingCostData ? (
              <div className="loading-cost-data"><div className="spinner" /><p>Loading cost data...</p></div>
            ) : costData && (
              <>
                <div className="cost-overview">
                  {[
                    { key: 'total-spend', title: 'Total Spend', value: formatCurrency(costData.totalCost), sub: <span className={`cost-change ${costData.percentChange >= 0 ? 'positive' : 'negative'}`}>{formatPercentChange(costData.percentChange)} from last period</span> },
                    { key: 'daily-average', title: 'Daily Average', value: formatCurrency(costData.dailyAverage), sub: <span className="cost-change">Over {timePeriod === '7d' ? '7' : timePeriod === '30d' ? '30' : '90'} days</span> },
                    { key: 'projected-monthly', title: 'Projected Monthly', value: formatCurrency(costData.projectedMonthly), sub: <span className="cost-change">Based on current usage</span> },
                  ].map(card => (
                    <div key={card.key} className="cost-card">
                      <div className="card-header">
                        <h3>{card.title}</h3>
                        <div className="info-icon" onClick={() => setOpenInfoModal(card.key)}><InfoIcon /></div>
                      </div>
                      <div className="cost-value">{card.value}</div>
                      {card.sub}
                    </div>
                  ))}
                </div>

                <div className="cost-charts">
                  <div className="chart-container">
                    <div className="section-header">
                      <h3>Cost Trend</h3>
                      <div className="info-icon" onClick={() => setOpenInfoModal('cost-trend')}><InfoIcon /></div>
                    </div>
                    {costData.costByDay.length > 0 ? (
                      <>
                        <div className="trend-summary">
                          <div className="trend-stat"><span className="trend-label">Peak Day</span><span className="trend-value">{formatCurrency(Math.max(...costData.costByDay.map(d => d.cost)))}</span></div>
                          <div className="trend-stat"><span className="trend-label">Lowest Day</span><span className="trend-value">{formatCurrency(Math.min(...costData.costByDay.map(d => d.cost)))}</span></div>
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
                              const agg = aggregateCostData(costData.costByDay, timePeriod);
                              const max = Math.max(...agg.map(d => d.cost));
                              return Array.from({ length: 6 }, (_, i) => (
                                <div key={i} className="y-axis-label"><span>{formatCurrency((max / 5) * (5 - i))}</span></div>
                              ));
                            })()}
                          </div>
                          <div className="chart-content">
                            <div className="chart-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="grid-line" />)}</div>
                            <div className="chart-bars">
                              {aggregateCostData(costData.costByDay, timePeriod).map((day, i, arr) => {
                                const max = Math.max(...arr.map(d => d.cost));
                                const h = max > 0 ? (day.cost / max) * 100 : 0;
                                const label = formatBarDate(day.date);
                                return (
                                  <div key={i} className="chart-bar-wrapper">
                                    <div className="chart-bar" style={{ height: `${h}%` }} title={`${label}: ${formatCurrency(day.cost)}`}>
                                      <span className="bar-value">{formatCurrency(day.cost)}</span>
                                    </div>
                                    <span className="bar-label">{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : <div className="chart-placeholder"><p>No cost trend data available</p></div>}
                  </div>

                  <div className="chart-container">
                    <div className="section-header">
                      <h3>Cost by Resource Group</h3>
                      <div className="info-icon" onClick={() => setOpenInfoModal('cost-by-rg')}><InfoIcon /></div>
                    </div>
                    <div className="rg-breakdown">
                      {costData.costByResourceGroup.length > 0 ? (
                        <table className="rg-breakdown-table">
                          <thead><tr><th>Resource Group</th><th>Total Cost</th></tr></thead>
                          <tbody>
                            {[...costData.costByResourceGroup].sort((a, b) => b.cost - a.cost).map((rg, i) => (
                              <tr key={i}><td>{rg.name}</td><td className="total-cost">{formatCurrency(rg.cost)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p>No resource group data available</p>}
                    </div>
                  </div>
                </div>

                <div className="cost-details">
                  <div className="section-header">
                    <h3>Cost Details</h3>
                    <div className="info-icon" onClick={() => setOpenInfoModal('cost-details')}><InfoIcon /></div>
                  </div>
                  {costData.costDetails.some(d => d.service.toLowerCase().includes('operationalinsights')) && (
                    <div className="cost-info-banner">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="banner-icon">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                      </svg>
                      <div className="banner-content">
                        <strong>Workspace-Based Services:</strong> Log Analytics workspace costs include charges from connected services like Application Insights, Container Insights, and VM Insights.
                      </div>
                    </div>
                  )}
                  <div className="cost-table">
                    <table>
                      <thead>
                        <tr><th>Resource Group</th><th>Service</th><th>Resource</th><th>Daily Cost</th><th>Total Cost</th><th>Trend</th></tr>
                      </thead>
                      <tbody>
                        {costData.costDetails.length > 0 ? (
                          costData.costDetails.map((d, i) => (
                            <tr key={i}>
                              <td>{d.resourceGroup}</td><td>{d.service}</td><td>{d.resource}</td>
                              <td>{formatCurrency(d.dailyCost)}</td>
                              <td className="total-cost">{formatCurrency(d.totalCost)}</td>
                              <td className={`trend ${d.trend >= 0 ? 'up' : 'down'}`}>{formatPercentChange(d.trend)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} className="no-data">No billable resources found with costs in the selected time period.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};


