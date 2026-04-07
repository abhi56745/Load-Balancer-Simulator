import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'simulation', label: 'Simulation', icon: '▶' },
  { id: 'comparison', label: 'Comparison', icon: '⇌' },
  { id: 'analytics', label: 'Analytics', icon: '◈' },
  { id: 'activity', label: 'Activity', icon: '◉' },
];

const Sidebar = ({ active, onNavigate }) => (
  <aside className="sidebar">
    <div className="sidebar-brand">
      <span className="brand-icon">⚡</span>
      <span className="brand-text">LBSim</span>
    </div>
    <nav className="sidebar-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'nav-active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
          {active === item.id && <span className="nav-indicator" />}
        </button>
      ))}
    </nav>
    <div className="sidebar-footer">
      <div className="version-badge">v3.0 Research Edition</div>
    </div>
  </aside>
);

export default Sidebar;
