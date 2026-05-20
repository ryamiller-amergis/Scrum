import React, { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';
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
        <div className={styles['login-logo']}>
          <BrandLogo tone="inverse" />
        </div>
        <p>Sign in with your Azure DevOps account to continue to Apex.</p>
        <button className={styles['login-button']} onClick={handleLogin}>
          Sign in with Azure DevOps
        </button>
      </div>
    </div>
  );
};
