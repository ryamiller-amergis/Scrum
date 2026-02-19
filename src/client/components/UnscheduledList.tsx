import React, { useState, useMemo } from 'react';
import { WorkItem } from '../types/workitem';
import { WorkItemCard } from './WorkItemCard';
import styles from './UnscheduledList.module.css';

interface UnscheduledListProps {
  workItems: WorkItem[];
  onSelectItem: (item: WorkItem) => void;
  onUpdateDueDate: (id: number, dueDate: string | null) => void;
}

interface HierarchicalItem {
  item: WorkItem;
  children: HierarchicalItem[];
  level: number;
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
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [isDropZone, setIsDropZone] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [width, setWidth] = useState<number>(() => Math.min(Math.max(window.innerWidth * 0.4, 250), 1000));
  const [isResizing, setIsResizing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const iterationOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(i => { if (i.iterationPath) unique.add(i.iterationPath); });
    return Array.from(unique).sort();
  }, [workItems]);

  const workItemTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(i => { if (i.workItemType) unique.add(i.workItemType); });
    unique.add('Bug');
    return Array.from(unique).sort();
  }, [workItems]);

  const assignedToOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(i => { if (i.assignedTo) unique.add(i.assignedTo); });
    return Array.from(unique).sort();
  }, [workItems]);

  const stateOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(i => { if (i.state) unique.add(i.state); });
    return Array.from(unique).sort();
  }, [workItems]);

  const filteredItems = useMemo(() => {
    let items = workItems;
    if (selectedIteration) items = items.filter(i => i.iterationPath === selectedIteration);
    if (selectedWorkItemType) items = items.filter(i => i.workItemType === selectedWorkItemType);
    if (selectedAssignedTo) items = items.filter(i => i.assignedTo === selectedAssignedTo);
    if (selectedStates.length > 0) items = items.filter(i => selectedStates.includes(i.state));
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(lower) ||
        i.id.toString().includes(lower) ||
        (i.assignedTo && i.assignedTo.toLowerCase().includes(lower))
      );
    }
    return items;
  }, [workItems, searchTerm, selectedIteration, selectedWorkItemType, selectedAssignedTo, selectedStates]);

  const hierarchicalItems = useMemo(() => {
    const itemMap = new Map<number, HierarchicalItem>();
    const rootItems: HierarchicalItem[] = [];
    filteredItems.forEach(item => itemMap.set(item.id, { item, children: [], level: 0 }));
    filteredItems.forEach(item => {
      const hi = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId)!;
        parent.children.push(hi);
        hi.level = parent.level + 1;
      } else {
        if (!selectedWorkItemType) { if (item.workItemType === 'Epic') rootItems.push(hi); }
        else rootItems.push(hi);
      }
    });
    const typePriority: Record<string, number> = { 'Epic': 1, 'Feature': 2, 'Product Backlog Item': 3, 'Technical Backlog Item': 4, 'Bug': 5 };
    const sortItems = (items: HierarchicalItem[]) => {
      items.sort((a, b) => {
        const ap = typePriority[a.item.workItemType] || 99;
        const bp = typePriority[b.item.workItemType] || 99;
        return ap !== bp ? ap - bp : a.item.id - b.item.id;
      });
      items.forEach(i => sortItems(i.children));
    };
    sortItems(rootItems);
    return rootItems;
  }, [filteredItems, selectedWorkItemType]);

  const toggleExpanded = (itemId: number) => {
    setExpandedItems(prev => {
      const n = new Set(prev);
      if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
      return n;
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDropZone(true); };
  const handleDragLeave = () => setIsDropZone(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropZone(false);
    const draggedItem = (window as any).__DRAGGED_CALENDAR_ITEM__;
    if (draggedItem) { onUpdateDueDate(draggedItem.id, null); (window as any).__DRAGGED_CALENDAR_ITEM__ = null; }
  };

  const handleResizeStart = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };

  React.useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => { if (e.clientX >= 200 && e.clientX <= 1000) setWidth(e.clientX); };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing]);

  return (
    <div
      className={[styles['unscheduled-list'], isDropZone ? styles['drop-zone-active'] : '', isCollapsed ? styles.collapsed : ''].filter(Boolean).join(' ')}
      style={{ width: isCollapsed ? '40px' : `${width}px` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        className={styles['collapse-toggle']}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '▶' : '◀'}
      </button>
      {!isCollapsed && (
        <div className={styles['resize-handle']} onMouseDown={handleResizeStart} title="Drag to resize">
          <div className={styles['resize-handle-line']} />
        </div>
      )}

      {!isCollapsed && (
        <>
          <h3>Unscheduled Items</h3>
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); onSelectItem(null as any); }}
            className={styles['search-input']}
          />
          <button className={styles['filters-toggle']} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? '▲' : '▼'} Filters
          </button>
          {showFilters && (
            <>
              <div className={styles['filter-row']}>
                <select value={selectedWorkItemType} onChange={e => setSelectedWorkItemType(e.target.value)} className={styles['filter-select']}>
                  <option value="">All Types</option>
                  {workItemTypeOptions.map(type => (
                    <option key={type} value={type}>
                      {type === 'Product Backlog Item' ? '📋 PBI' : type === 'Technical Backlog Item' ? '🔧 TBI' : type === 'Epic' ? '👑 Epic' : type === 'Feature' ? '⭐ Feature' : type === 'Bug' ? '🐛 Bug' : type}
                    </option>
                  ))}
                </select>
                <select value={selectedAssignedTo} onChange={e => setSelectedAssignedTo(e.target.value)} className={styles['filter-select']}>
                  <option value="">Assigned To</option>
                  {assignedToOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className={styles['state-filter-container']}>
                <div className={styles['state-filter-header']}>States:</div>
                <div className={styles['state-checkboxes']}>
                  {stateOptions.map(state => (
                    <label key={state} className={styles['state-checkbox-label']}>
                      <input
                        type="checkbox"
                        checked={selectedStates.includes(state)}
                        onChange={e => setSelectedStates(e.target.checked ? [...selectedStates, state] : selectedStates.filter(s => s !== state))}
                        className={styles['state-checkbox']}
                      />
                      <span>{state}</span>
                    </label>
                  ))}
                </div>
              </div>
              <select value={selectedIteration} onChange={e => setSelectedIteration(e.target.value)} className={styles['iteration-select']}>
                <option value="">All Iterations</option>
                {iterationOptions.map(it => <option key={it} value={it}>{it}</option>)}
              </select>
              {(selectedWorkItemType || selectedAssignedTo || selectedStates.length > 0 || selectedIteration) && (
                <button
                  className={styles['clear-filters-btn']}
                  onClick={() => { setSelectedWorkItemType(''); setSelectedAssignedTo(''); setSelectedStates([]); setSelectedIteration(''); }}
                >
                  Clear Filters
                </button>
              )}
            </>
          )}
          <div className={styles['unscheduled-items']}>
            {hierarchicalItems.length === 0 ? (
              <div className={styles['empty-state']}>
                {searchTerm ? 'No items match your search' : 'No unscheduled items'}
              </div>
            ) : (
              <HierarchicalItemList
                items={hierarchicalItems}
                expandedItems={expandedItems}
                onToggleExpanded={toggleExpanded}
                onSelectItem={onSelectItem}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface HierarchicalItemListProps {
  items: HierarchicalItem[];
  expandedItems: Set<number>;
  onToggleExpanded: (itemId: number) => void;
  onSelectItem: (item: WorkItem) => void;
}

const HierarchicalItemList: React.FC<HierarchicalItemListProps> = ({ items, expandedItems, onToggleExpanded, onSelectItem }) => {
  const renderItem = (hi: HierarchicalItem): React.ReactNode => {
    const { item, children, level } = hi;
    const hasChildren = children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    return (
      <div key={item.id} className={styles['hierarchical-item-container']}>
        <div className={styles['hierarchical-item']} style={{ paddingLeft: `${level * 20}px` }}>
          {hasChildren && (
            <button className={styles['expand-toggle']} onClick={e => { e.stopPropagation(); onToggleExpanded(item.id); }}>
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <div className={`${styles['item-wrapper']} ${!hasChildren ? styles['no-children'] : ''}`}>
            <DraggableWorkItem workItem={item} onClick={() => onSelectItem(item)} />
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className={styles['children-container']}>{children.map(renderItem)}</div>
        )}
      </div>
    );
  };
  return <>{items.map(renderItem)}</>;
};

interface DraggableWorkItemProps {
  workItem: WorkItem;
  onClick: () => void;
}

const DraggableWorkItem: React.FC<DraggableWorkItemProps> = ({ workItem, onClick }) => {
  const [isDragging, setIsDragging] = useState(false);
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    (window as any).__DRAGGED_WORK_ITEM__ = workItem;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(workItem));
  };
  return (
    <div draggable="true" onDragStart={handleDragStart} onDragEnd={() => setIsDragging(false)}>
      <WorkItemCard workItem={workItem} onClick={onClick} isDragging={isDragging} />
    </div>
  );
};
