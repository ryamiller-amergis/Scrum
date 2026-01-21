import React, { useState, useMemo } from 'react';
import { WorkItem } from '../types/workitem';
import { WorkItemCard } from './WorkItemCard';
import './UnscheduledList.css';

interface UnscheduledListProps {
  workItems: WorkItem[];
  onSelectItem: (item: WorkItem) => void;
  onUpdateDueDate: (id: number, dueDate: string | null) => void;
}

export const UnscheduledList: React.FC<UnscheduledListProps> = ({
  workItems,
  onSelectItem,
  onUpdateDueDate,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIteration, setSelectedIteration] = useState<string>('');
  const [selectedWorkItemType, setSelectedWorkItemType] = useState<string>('');
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [isDropZone, setIsDropZone] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique iteration values
  const iterationOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.iterationPath) {
        unique.add(item.iterationPath);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Get unique work item types
  const workItemTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.workItemType) {
        unique.add(item.workItemType);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Get unique assigned to values
  const assignedToOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.assignedTo) {
        unique.add(item.assignedTo);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Get unique states
  const stateOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.state) {
        unique.add(item.state);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  const filteredItems = useMemo(() => {
    let items = workItems;
    
    // Filter by iteration
    if (selectedIteration) {
      items = items.filter(item => item.iterationPath === selectedIteration);
    }

    // Filter by work item type
    if (selectedWorkItemType) {
      items = items.filter(item => item.workItemType === selectedWorkItemType);
    }

    // Filter by assigned to
    if (selectedAssignedTo) {
      items = items.filter(item => item.assignedTo === selectedAssignedTo);
    }

    // Filter by state
    if (selectedState) {
      items = items.filter(item => item.state === selectedState);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(lowerSearch) ||
        item.id.toString().includes(lowerSearch) ||
        (item.assignedTo && item.assignedTo.toLowerCase().includes(lowerSearch))
      );
    }
    
    return items;
  }, [workItems, searchTerm, selectedIteration, selectedWorkItemType, selectedAssignedTo, selectedState]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDropZone(true);
  };

  const handleDragLeave = () => {
    setIsDropZone(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropZone(false);
    
    const draggedItem = (window as any).__DRAGGED_CALENDAR_ITEM__;
    if (draggedItem) {
      console.log('Removing due date from item:', draggedItem.id);
      onUpdateDueDate(draggedItem.id, null);
      (window as any).__DRAGGED_CALENDAR_ITEM__ = null;
    }
  };

  return (
    <div 
      className={`unscheduled-list ${isDropZone ? 'drop-zone-active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button 
        className="collapse-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '▶' : '◀'}
      </button>
      
      {!isCollapsed && (
        <>
          <h3>Unscheduled Items</h3>
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              onSelectItem(null as any); // Close details panel
            }}
            className="search-input"
          />
          <button 
            className="filters-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? '▲' : '▼'} Filters
          </button>
          {showFilters && (
            <>
          <div className="filter-row">
            <select
              value={selectedWorkItemType}
              onChange={(e) => setSelectedWorkItemType(e.target.value)}
              className="filter-select"
            >
              <option value="">All Types</option>
              {workItemTypeOptions.map(type => (
                <option key={type} value={type}>
                  {type === 'Product Backlog Item' ? '📋 PBI' : 
                   type === 'Technical Backlog Item' ? '🔧 TBI' : 
                   type === 'Epic' ? '👑 Epic' :
                   type === 'Feature' ? '⭐ Feature' :
                   type === 'Bug' ? '🐛 Bug' :
                   type}
                </option>
              ))}
            </select>
            <select
              value={selectedAssignedTo}
              onChange={(e) => setSelectedAssignedTo(e.target.value)}
              className="filter-select"
            >
              <option value="">Assigned To</option>
              {assignedToOptions.map(person => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="filter-select"
            >
              <option value="">All States</option>
              {stateOptions.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          <select
            value={selectedIteration}
            onChange={(e) => setSelectedIteration(e.target.value)}
            className="iteration-select"
          >
            <option value="">All Iterations</option>
            {iterationOptions.map(iteration => (
              <option key={iteration} value={iteration}>{iteration}</option>
            ))}
          </select>
          {(selectedWorkItemType || selectedAssignedTo || selectedState || selectedIteration) && (
            <button 
              className="clear-filters-btn"
              onClick={() => {
                setSelectedWorkItemType('');
                setSelectedAssignedTo('');
                setSelectedState('');
                setSelectedIteration('');
              }}
            >
              Clear Filters
            </button>
          )}
            </>
          )}
          <div className="unscheduled-items">
            {filteredItems.length === 0 ? (
              <div className="empty-state">
                {searchTerm ? 'No items match your search' : 'No unscheduled items'}
              </div>
            ) : (
              filteredItems.map((item) => (
                <DraggableWorkItem
                  key={item.id}
                  workItem={item}
                  onClick={() => onSelectItem(item)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface DraggableWorkItemProps {
  workItem: WorkItem;
  onClick: () => void;
}

const DraggableWorkItem: React.FC<DraggableWorkItemProps> = ({
  workItem,
  onClick,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    // Set global reference for calendar to pick up
    (window as any).__DRAGGED_WORK_ITEM__ = workItem;
    // Required for Firefox
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(workItem));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <WorkItemCard
        workItem={workItem}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  );
};
