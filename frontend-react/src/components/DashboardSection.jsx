import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const ALGO_LABELS = {
  roundrobin: 'Round Robin',
  swrr: 'Smooth Weighted Round Robin',
  least: 'Least Connections',
  leastoutstanding: 'Least Outstanding Requests',
  p2c: 'Power of Two Choices',
  p2cewma: 'P2C + Peak EWMA',
  iphash: 'IP Hash',
  ringhash: 'Ring Hash',
  maglev: 'Maglev Hashing',
  hrw: 'Rendezvous Hashing',
  localityaware: 'Locality-Aware',
  random: 'Random Selection',
  weighted: 'Weighted Round Robin',
  jsq: 'Join Shortest Queue',
  jiq: 'Join Idle Queue',
  sed: 'Shortest Expected Delay',
  boundedch: 'Bounded-Load Consistent Hash',
  aperture: 'Aperture / Subsetting',
  weightedrandomam: 'Weighted Random + Anomaly Mitigation',
};

const DashboardSection = ({ runCount, numServers, lastAlgorithm, metrics, totalRequests }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get('/simulate/history')
      .then((response) => setHistory(response.data.history || []))
      .catch(() => setHistory([]));
  }, [runCount]);

  const cards = [
    { icon: 'SYS', label: 'System Status', value: 'Online', sub: 'All systems operational', accent: '#22c55e' },
    { icon: 'SRV', label: 'Active Servers', value: `${numServers} / ${numServers}`, sub: 'All configured nodes available', accent: '#0ff' },
    { icon: 'RUN', label: 'Total Runs', value: runCount || '--', sub: 'Completed simulations', accent: '#a200ff' },
    { icon: 'ALG', label: 'Last Algorithm', value: lastAlgorithm ? ALGO_LABELS[lastAlgorithm] : '--', sub: 'Most recent strategy', accent: '#f59e0b' },
    { icon: 'REQ', label: 'Total Requests', value: totalRequests || '--', sub: 'Requests in the last run', accent: '#38bdf8' },
    { icon: 'AVG', label: 'Avg Requests', value: metrics ? `${metrics.avgLoad}` : '--', sub: 'Average routed per server', accent: '#fb7185' },
  ];

  return (
    <section className="section-wrapper fade-in">
      <div className="section-header">
        <h2>Dashboard <span className="gradient-text">Overview</span></h2>
        <p className="section-sub">A quick read on the simulator state and your recent runs.</p>
      </div>

      <div className="overview-grid">
        {cards.map((card) => (
          <div key={card.label} className="overview-card glass" style={{ '--accent-color': card.accent }}>
            <div className="ov-icon">{card.icon}</div>
            <div>
              <div className="ov-label">{card.label}</div>
              <div className="ov-value" style={{ color: card.accent }}>{card.value}</div>
              <div className="ov-sub">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="history-card glass" style={{ padding: '24px', marginBottom: '28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#94a3b8' }}>Recent Simulations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((entry) => (
              <div
                key={`${entry.algorithm}-${entry.createdAt}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: '3px solid #a200ff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#0ff', fontSize: '0.85rem', fontWeight: 600 }}>
                    {ALGO_LABELS[entry.algorithm] || entry.algorithm}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    ({entry.totalRequests} requests)
                  </span>
                </div>
                <span style={{ color: '#475569', fontSize: '0.75rem' }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quickstart-box glass">
        <h3>Quick Start</h3>
        <ol className="quickstart-list">
          <li>Open <strong>Simulation</strong> and set the server count, requests, and capacity.</li>
          <li>Choose a routing algorithm from the glass dropdown.</li>
          <li>Run the simulation to watch live traffic and peak load behavior.</li>
          <li>Use <strong>Comparison</strong> and <strong>Analytics</strong> for deeper inspection.</li>
        </ol>
      </div>
    </section>
  );
};

export default DashboardSection;
