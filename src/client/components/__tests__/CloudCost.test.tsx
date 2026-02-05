import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudCost } from '../CloudCost';
import { azureCostService } from '../../services/azureCostService';

// Mock the Azure Cost Service
jest.mock('../../services/azureCostService', () => ({
  azureCostService: {
    getSubscriptionsWithResourceGroups: jest.fn()
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
    // Reset mock before each test
    (azureCostService.getSubscriptionsWithResourceGroups as jest.Mock).mockResolvedValue(mockSubscriptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the cloud cost header', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    expect(screen.getByText('Cloud Cost Analytics')).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading Azure subscriptions...')).not.toBeInTheDocument();
    });
  });

  it('renders filter options in correct order', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.getByText('Subscription:')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Resource Groups:')).toBeInTheDocument();
    expect(screen.getByText('Time Period:')).toBeInTheDocument();
  });

  it('displays subscription dropdown with options', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.getByText('Subscription 1')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Subscription 2')).toBeInTheDocument();
  });

  it('shows message when no resource groups selected', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading Azure subscriptions...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('Please select at least one resource group to view cost data.')).toBeInTheDocument();
  });

  it('opens resource group multi-select when clicked', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading Azure subscriptions...')).not.toBeInTheDocument();
    });
    
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('allows selecting resource groups', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading Azure subscriptions...')).not.toBeInTheDocument();
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
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading Azure subscriptions...')).not.toBeInTheDocument();
    });
    
    // Open dropdown and select resource group
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    
    const rgCheckbox = screen.getByLabelText('RG-Production');
    fireEvent.click(rgCheckbox);
    
    // Should now show cost overview
    expect(screen.getByText('Total Spend')).toBeInTheDocument();
    expect(screen.getByText('Daily Average')).toBeInTheDocument();
    expect(screen.getByText('Projected Monthly')).toBeInTheDocument();
  });

  it('resets resource groups when subscription changes', async () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading Azure subscriptions...')).not.toBeInTheDocument();
    });
    
    // Select a resource group
    const multiSelectTrigger = screen.getByText('Select resource groups...');
    fireEvent.click(multiSelectTrigger);
    const rgCheckbox = screen.getByLabelText('RG-Production');
    fireEvent.click(rgCheckbox);
    
    // Change subscription
    const subscriptionSelect = screen.getByDisplayValue('Subscription 1');
    fireEvent.change(subscriptionSelect, { target: { value: 'sub-2' } });
    
    // Should show no selection message again
    expect(screen.getByText('Please select at least one resource group to view cost data.')).toBeInTheDocument();
  });

  it('handles error when fetching subscriptions fails', async () => {
    (azureCostService.getSubscriptionsWithResourceGroups as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch subscriptions')
    );
    
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch subscriptions')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    render(<CloudCost project="TestProject" areaPath="TestArea" />);
    
    expect(screen.getByText('Loading Azure subscriptions...')).toBeInTheDocument();
  });
});
