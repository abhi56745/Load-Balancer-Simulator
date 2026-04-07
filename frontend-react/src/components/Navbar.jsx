import React, { useState } from 'react';

const Navbar = ({
  loading,
  comparing,
  onRun,
  onStop,
  onCompare,
  onReset,
  onLogout,
  progress,
  username,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>Load Balancer <span className="gradient-text">Simulator</span></h1>
        <div className="status-pill">
          <span className="online-dot" />
          System Online
        </div>
      </div>
      <div className="topbar-actions">
        {onReset && (
          <button
            className="btn-clear"
            onClick={onReset}
            disabled={loading || comparing}
            style={{ padding: '10px 18px', fontSize: '0.9rem', marginRight: '8px' }}
          >
            Reset Simulation
          </button>
        )}
        <button
          className="btn-compare"
          onClick={onCompare}
          disabled={comparing || loading}
        >
          {comparing ? 'Comparing...' : 'Compare All'}
        </button>
        <button
          className="btn-run"
          onClick={onRun}
          disabled={loading || comparing}
        >
          {loading ? (
            <><span className="spinner" /> Running Simulation...</>
          ) : (
            <>Run Simulation</>
          )}
        </button>
        <button
          className="btn-stop"
          onClick={onStop}
          disabled={!loading}
        >
          Stop
        </button>

        <div className="user-menu-wrapper">
          <button
            className="user-menu-btn"
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            Welcome, {username}
            <span className="user-caret">{userMenuOpen ? '^' : 'v'}</span>
          </button>
          {userMenuOpen && (
            <div className="user-dropdown glass">
              <button className="dropdown-item" onClick={() => { alert('Profile page coming soon!'); setUserMenuOpen(false); }}>
                Profile
              </button>
              <button className="dropdown-item dropdown-logout" onClick={() => { setUserMenuOpen(false); onLogout?.(); }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {progress > 0 && (
        <div className="sim-progress-track">
          <div className="sim-progress-fill" style={{ width: `${progress}%` }} />
          <span className="sim-progress-text">{progress}%</span>
        </div>
      )}
    </header>
  );
};

export default Navbar;
