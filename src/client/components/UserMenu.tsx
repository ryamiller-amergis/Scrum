import React, { useState, useRef, useEffect } from 'react';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  onOpenChangelog: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  hasUnreadChangelog: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  onOpenChangelog,
  onToggleTheme,
  onLogout,
  theme,
  hasUnreadChangelog,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleChangelogClick = () => { onOpenChangelog(); setIsOpen(false); };
  const handleThemeClick = () => { onToggleTheme(); setIsOpen(false); };
  const handleLogoutClick = () => { onLogout(); setIsOpen(false); };

  return (
    <div className={styles['user-menu']} ref={menuRef}>
      <button
        className={styles['user-menu-trigger']}
        onClick={() => setIsOpen(!isOpen)}
        title="User Menu"
      >
        <span className={styles['user-icon']}>👤</span>
        {hasUnreadChangelog && <span className={styles['user-menu-badge']}></span>}
      </button>

      {isOpen && (
        <div className={styles['user-menu-dropdown']}>
          <button className={styles['user-menu-item']} onClick={handleChangelogClick}>
            <span className={styles['menu-item-icon']}>✨</span>
            <span className={styles['menu-item-text']}>What's New</span>
            {hasUnreadChangelog && <span className={styles['menu-item-badge']}>NEW</span>}
          </button>

          <button className={styles['user-menu-item']} onClick={handleThemeClick}>
            <span className={styles['menu-item-icon']}>{theme === 'light' ? '🌙' : '☀️'}</span>
            <span className={styles['menu-item-text']}>
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>

          <div className={styles['user-menu-divider']}></div>

          <button className={`${styles['user-menu-item']} ${styles['user-menu-item-danger']}`} onClick={handleLogoutClick}>
            <span className={styles['menu-item-icon']}>🚪</span>
            <span className={styles['menu-item-text']}>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
