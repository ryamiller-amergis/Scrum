import React from 'react';

interface BrandLogoProps {
  variant?: 'mark' | 'lockup';
  tone?: 'default' | 'inverse';
  className?: string;
  showDescriptor?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'lockup',
  tone = 'default',
  className,
  showDescriptor = true,
}) => {
  const isInverse = tone === 'inverse';
  const markFill = isInverse ? 'var(--brand-primary-light)' : 'var(--brand-primary)';
  const markSurface = isInverse ? 'var(--brand-surface-dark)' : 'var(--brand-surface)';
  const markCutout = isInverse ? 'var(--brand-navy)' : 'var(--bg-primary)';
  const textColor = isInverse ? 'var(--brand-text-inverse)' : 'var(--text-primary)';
  const descriptorColor = isInverse ? 'var(--brand-primary-light)' : 'var(--accent-color)';

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: variant === 'mark' ? 0 : 12,
        color: textColor,
      }}
    >
      <svg
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          display: 'block',
          width: variant === 'mark' ? '100%' : '0.9em',
          height: variant === 'mark' ? '100%' : '0.9em',
          flex: '0 0 auto',
        }}
      >
        <rect x="10" y="10" width="76" height="76" rx="20" fill={markSurface} />
        <path d="M20 72L43 22H56L34 72H20Z" fill={markFill} />
        <path d="M52 22L78 72H61L43 38L52 22Z" fill={markFill} opacity="0.9" />
        <path d="M40 72L49 54L58 72H40Z" fill={markCutout} />
      </svg>

      {variant === 'lockup' && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ fontWeight: 800, fontSize: '1em', letterSpacing: '-0.03em' }}>Apex</span>
          {showDescriptor && (
            <span
              style={{
                marginTop: 8,
                color: descriptorColor,
                fontSize: '0.34em',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Planning to Delivery
            </span>
          )}
        </span>
      )}
    </div>
  );
};
