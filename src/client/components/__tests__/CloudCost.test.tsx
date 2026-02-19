import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CloudCost } from '../CloudCost';
import { azureCostService } from '../../services/azureCostService';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock the Azure Cost Service
jest.mock('../../services/azureCostService', () => ({
  azureCostService: {
    getSubscriptionsWithResourceGroups: jest.fn(),
    getDashboardData: jest.fn(),
    getCostData: jest.fn()
  }
}));

const mockSubscriptions = [
  {
    id: 'sub-1',
    subscriptionId: 'sub-1',
    name: 'Subscription 1',
    state: 'Enabled',
    resourceGroups: ['RG-Production', 'RG-Development', 'RG-Testing', 'RG-Shared-Services']
  },
  {
    id: 'sub-2',
    subscriptionId: 'sub-2',
    name: 'Subscription 2',
    state: 'Enabled',
    resourceGroups: ['RG-Analytics', 'RG-Data', 'RG-Integration', 'RG-Monitoring']
  }
];

describe('CloudCost Component', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    
    // Reset mock before each test
    (azureCostService.getSubscriptionsWithResourceGroups as jest.Mock).mockResolvedValue(mockSubscriptions);
    (azureCostService.getDashboardData as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the cloud cost header', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Cloud Cost Analytics')).toBeInTheDocument();
    
    // Wait for dashboard loading to complete
    await waitFor(() => {
      expect(azureCostService.getDashboardData).toHaveBeenCalled();
    });
  });

  it('renders filter options in correct order', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Subscription:')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Resource Groups:')).toBeInTheDocument();
    expect(screen.getByText('Time Period:')).toBeInTheDocument();
  });

  it('displays subscription dropdown with options', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Subscription 1')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Subscription 2')).toBeInTheDocument();
  });

  it('shows message when no resource groups selected', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/Please select a subscription, resource group\(s\), and click "Get Cost Data" to view analytics/i)).toBeInTheDocument();
    });
  });

  it('opens resource group multi-select when clicked', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Select resource groups...')).toBeInTheDocument();
    });
    
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('allows selecting resource groups', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Select resource groups...')).toBeInTheDocument();
    });
    
    // Open dropdown
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    
    // Select a resource group
    const rgCheckbox = screen.getByLabelText('RG-Production') as HTMLInputElement;
    fireEvent.click(rgCheckbox);
    
    expect(rgCheckbox.checked).toBe(true);
  });

  it('shows cost data when resource groups are selected', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Select resource groups...')).toBeInTheDocument();
    });
    
    // Open dropdown and select resource group
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    
    const rgCheckbox = screen.getByLabelText('RG-Production');
    fireEvent.click(rgCheckbox);
    
    // Close dropdown
    fireEvent.click(multiSelectTrigger);
    
    // Should show the submit button to fetch data
    expect(screen.getByText('Get Cost Data')).toBeInTheDocument();
  });

  it('resets resource groups when subscription changes', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view
    const detailedAnalysisBtn = screen.getByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Select resource groups...')).toBeInTheDocument();
    });
    
    // Select a resource group
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    const rgCheckbox = screen.getByLabelText('RG-Production');
    fireEvent.click(rgCheckbox);
    fireEvent.click(multiSelectTrigger); // Close dropdown
    
    // Change subscription
    const subscriptionSelect = screen.getByDisplayValue('Subscription 1');
    fireEvent.change(subscriptionSelect, { target: { value: 'sub-2' } });
    
    // Should show no selection message again
    expect(screen.getByText(/Please select a subscription, resource group\(s\), and click "Get Cost Data" to view analytics/i)).toBeInTheDocument();
  });

  it('handles error when fetching subscriptions fails', async () => {
    (azureCostService.getSubscriptionsWithResourceGroups as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch subscriptions')
    );
    
    // Clear sessionStorage to force loading
    sessionStorage.clear();
    
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Switch to Detailed Analysis view to trigger subscription loading
    const detailedAnalysisBtn = await screen.findByText('Detailed Analysis');
    fireEvent.click(detailedAnalysisBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch subscriptions')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', async () => {
    // Clear sessionStorage to force loading state
    sessionStorage.clear();
    
    render(<CloudCost project="TestProject" areaPath="TestArea" />, { wrapper: createWrapper() });
    
    // Dashboard should be showing by default
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    
    // Wait for dashboard loading to complete
    await waitFor(() => {
      expect(azureCostService.getDashboardData).toHaveBeenCalled();
    });
  });
});
