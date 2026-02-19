import React, { useState, useEffect } from 'react';
import type { WorkItem } from '../types/workitem';

interface LinkItemsModalProps {
  epicId: number;
  project: string;
  areaPath: string;
  onLink: (epicId: number, workItemIds: number[]) => Promise<void>;
  onClose: () => void;
}

export const LinkItemsModal: React.FC<LinkItemsModalProps> = ({
  epicId, project, areaPath, onLink, onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchResults, setSearchResults] = useState<WorkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          query: searchQuery,
          type: typeFilter,
          project,
          areaPath,
        });
        const res = await fetch(`/api/workitems/search?${params}`);
        if (res.ok) setSearchResults(await res.json());
        else setSearchResults([]);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, typeFilter, project, areaPath]);

  const handleLink = async () => {
    if (selectedIds.length === 0) return;
    setIsLinking(true);
    try {
      await onLink(epicId, selectedIds);
      onClose();
    } finally {
      setIsLinking(false);
    }
  };

  const toggleItem = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        <h3>Link Items to Release</h3>

        <div className="search-section">
          <div className="search-filters">
            <div className="form-group">
              <label>Search:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by ID, title, or keyword..."
                className="search-input"
              />
            </div>
            <div className="form-group">
              <label>Type:</label>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select">
                <option value="All">All Types</option>
                <option value="Epic">Epic</option>
                <option value="Feature">Feature</option>
                <option value="Product Backlog Item">Product Backlog Item</option>
                <option value="Technical Backlog Item">Technical Backlog Item</option>
                <option value="Bug">Bug</option>
              </select>
            </div>
          </div>

          <div className="search-results">
            {isSearching ? (
              <div className="search-loading">Searching...</div>
            ) : searchQuery.length < 2 ? (
              <div className="search-hint">Enter at least 2 characters to search</div>
            ) : searchResults.length === 0 ? (
              <div className="search-hint">No items found</div>
            ) : (
              <div className="results-list">
                <div className="results-header">
                  <span>{searchResults.length} items found</span>
                  <button
                    className="btn-select-all"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === searchResults.length
                          ? []
                          : searchResults.map(wi => wi.id)
                      )
                    }
                  >
                    {selectedIds.length === searchResults.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {searchResults.map(item => (
                  <div key={item.id} className="result-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                    <div className="result-item-details">
                      <div className="result-item-header">
                        <span className="result-item-id">#{item.id}</span>
                        <span className="result-item-type">{item.workItemType}</span>
                        <span className={`result-item-state state-${item.state.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.state}
                        </span>
                      </div>
                      <div className="result-item-title">{item.title}</div>
                      {item.assignedTo && (
                        <div className="result-item-assigned">Assigned to: {item.assignedTo}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleLink} className="btn-primary" disabled={selectedIds.length === 0 || isLinking}>
            {isLinking ? 'Linking...' : `Link ${selectedIds.length} Item${selectedIds.length !== 1 ? 's' : ''}`}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
};
