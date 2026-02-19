import React, { useEffect, useState } from 'react';
import styles from './Login.module.css';

export const Login: React.FC = () => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          window.location.href = '/';
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  const handleLogin = () => { window.location.href = '/auth/login'; };

  if (checking) {
    return (
      <div className={styles['login-container']}>
        <div className={styles['login-card']}>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['login-container']}>
      <div className={styles['login-card']}>
        <div className={styles['login-icon']}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="80" height="80">
            <circle cx="32" cy="32" r="32" fill="#1a1a1a"/>
            <path d="M 32 12 A 16 16 0 1 1 16 32" stroke="#ef4444" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <path d="M 16 32 L 12 28 L 16 24 L 20 28 Z" fill="#ef4444"/>
            <rect x="28" y="26" width="12" height="8" fill="#ffffff" rx="1"/>
            <rect x="28" y="36" width="12" height="8" fill="#9ca3af" rx="1"/>
            <path d="M 52 18 Q 52 14 48 14 Q 44 14 44 18 Q 44 21 48 22 Q 52 23 52 26 Q 52 30 48 30 Q 44 30 44 26"
              stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
        <h1>Scrum</h1>
        <p>Sign in with your Azure DevOps account to continue</p>
        <button className={styles['login-button']} onClick={handleLogin}>
          Sign in with Azure DevOps
        </button>
      </div>
    </div>
  );
};
