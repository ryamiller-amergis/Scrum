import React from 'react';

interface ViewSkeletonProps {
  rows?: number;
}

export const ViewSkeleton: React.FC<ViewSkeletonProps> = ({ rows = 6 }) => (
  <div className="view-skeleton" aria-busy="true" aria-label="Loading view…">
    <div className="view-skeleton__header skeleton-pulse" />
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="view-skeleton__row skeleton-pulse" style={{ width: `${85 - (i % 3) * 10}%` }} />
    ))}
  </div>
);
