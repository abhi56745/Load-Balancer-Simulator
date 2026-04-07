import React, { useEffect, useState } from 'react';
import ChartSection from './ChartSection';
import ControlDropdown from './ControlDropdown';

const STATUS_META = {
  Normal: { cls: 'status-normal', color: '#22c55e' },
  Medium: { cls: 'status-medium', color: '#38bdf8' },
  High: { cls: 'status-high', color: '#f59e0b' },
  Overloaded: { cls: 'status-overloaded', color: '#ff0055' },
};

const ALGO_GROUPS = [
  {
    label: 'Core Algorithms',
    options: [
      { value: 'roundrobin', label: 'Round Robin' },
      { value: 'swrr', label: 'Smooth Weighted Round Robin' },
      { value: 'least', label: 'Least Connections' },
      { value: 'leastoutstanding', label: 'Least Outstanding Requests' },
      { value: 'p2c', label: 'Power of Two Choices' },
      { value: 'p2cewma', label: 'P2C + Peak EWMA' },
      { value: 'iphash', label: 'IP / Source Hash' },
      { value: 'ringhash', label: 'Ring Hash' },
      { value: 'maglev', label: 'Maglev Hashing' },
      { value: 'hrw', label: 'HRW Hashing' },
      { value: 'localityaware', label: 'Locality-Aware Weighted' },
    ],
  },
  {
    label: 'Advanced Algorithms',
    options: [
      { value: 'random', label: 'Random Selection' },
      { value: 'weighted', label: 'Weighted Round Robin' },
      { value: 'jsq', label: 'Join Shortest Queue' },
      { value: 'jiq', label: 'Join Idle Queue' },
      { value: 'sed', label: 'Shortest Expected Delay' },
      { value: 'boundedch', label: 'Bounded-Load Consistent Hash' },
      { value: 'aperture', label: 'Aperture / Subsetting' },
      { value: 'weightedrandomam', label: 'Weighted Random + Anomaly Mitigation' },
    ],
  },
];

const SPEED_GROUPS = [
  {
    label: '',
    options: [
      { value: 500, label: 'Slow' },
      { value: 180, label: 'Normal' },
      { value: 25, label: 'Fast' },
    ],
  },
];

const getStatusFromUsage = (load, capacity) => {
  const usage = load / capacity;

  if (usage >= 0.9) return 'Overloaded';
  if (usage >= 0.7) return 'High';
  if (usage >= 0.5) return 'Medium';
  return 'Normal';
};

const getUsagePercent = (load, capacity) => {
  if (!capacity) {
    return 0;
  }

  return (load / capacity) * 100;
};

const ServerCard = ({ server, isActive }) => {
  const [animatedLoad, setAnimatedLoad] = useState(0);
  const currentLoad = server.currentLoad ?? 0;
  const usagePercent = getUsagePercent(currentLoad, server.maxCapacity);
  const barWidth = currentLoad > 0 ? Math.min(usagePercent, 100) : 0;
  const activeRequests = server.activeRequests ?? 0;
  const status = getStatusFromUsage(currentLoad, server.maxCapacity);
  const meta = STATUS_META[status] || STATUS_META.Normal;

  const cardClass = [
    'server-card glass',
    status === 'Overloaded' ? 'card-overloaded' : status === 'High' ? 'card-high' : status === 'Medium' ? 'card-medium' : '',
    isActive ? 'card-flash' : '',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedLoad(barWidth);
    }, 60);

    return () => clearTimeout(timer);
  }, [barWidth]);

  return (
    <div className={cardClass}>
      <div className="card-header">
        <span className="card-title">Server {server.serverId}</span>
        <span className={`status-badge ${meta.cls}`}>{status}</span>
      </div>
      <div className="server-card-subtitle">Real-time server metrics</div>
      <div className="load-bar-container">
        <div
          className="load-bar"
          style={{
            width: `${animatedLoad}%`,
            minWidth: currentLoad > 0 ? '10px' : '0px',
            background: `linear-gradient(90deg, ${meta.color}cc, ${meta.color})`,
            boxShadow: currentLoad > 0 ? `0 0 12px ${meta.color}66` : 'none',
          }}
        />
      </div>
      <div className="card-stats">
        <div className="card-stat">
          <span className="cs-label">Live Load</span>
          <span className="cs-val" style={{ color: meta.color }}>
            {currentLoad} / {server.maxCapacity}
          </span>
        </div>
        <div className="card-stat">
          <span className="cs-label">Usage</span>
          <span className="cs-val" style={{ color: meta.color }}>{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="card-stat">
          <span className="cs-label">Active</span>
          <span className="cs-val" style={{ color: activeRequests > 0 ? '#38bdf8' : '#64748b' }}>
            {activeRequests}
          </span>
        </div>
        <div className="card-stat">
          <span className="cs-label">Handled</span>
          <span className="cs-val">{server.requestsHandled}</span>
        </div>
      </div>
    </div>
  );
};

const SimulationSection = ({
  algorithm,
  setAlgorithm,
  servers,
  loading,
  onRun,
  onStop,
  canStop,
  numServers,
  setNumServers,
  numRequests,
  setNumRequests,
  serverCapacity,
  setServerCapacity,
  simulationSpeed,
  setSimulationSpeed,
  activeServerId,
}) => {
  return (
    <section className="section-wrapper fade-in">
      <div className="section-header">
        <h2>Simulation <span className="gradient-text">Control</span></h2>
        <p className="section-sub">Configure parameters, run the simulation, and inspect how traffic gets distributed.</p>
      </div>

      <div className="controls-panel glass">
        <div className="ctrl-group ctrl-group-wide">
          <label className="ctrl-label">Algorithm</label>
          <ControlDropdown
            groups={ALGO_GROUPS}
            value={algorithm}
            onChange={setAlgorithm}
            disabled={loading}
            placeholder="Choose an algorithm"
          />
        </div>

        <div className="ctrl-group">
          <label className="ctrl-label">Speed</label>
          <ControlDropdown
            groups={SPEED_GROUPS}
            value={simulationSpeed}
            onChange={(value) => setSimulationSpeed(Number(value))}
            disabled={loading}
            placeholder="Choose speed"
          />
          <div className={`speed-badge ${simulationSpeed <= 25 ? 'speed-fast' : simulationSpeed <= 180 ? 'speed-normal' : 'speed-slow'}`}>
            {simulationSpeed <= 25 ? 'Fast mode active' : simulationSpeed <= 180 ? 'Normal mode' : 'Slow mode'}
          </div>
        </div>

        <div className="ctrl-group">
          <label className="ctrl-label">Servers: <strong>{numServers}</strong></label>
          <input
            type="range"
            className="ctrl-slider"
            min={2}
            max={10}
            value={numServers}
            onChange={(event) => setNumServers(Number(event.target.value))}
            disabled={loading}
          />
        </div>

        <div className="ctrl-group">
          <label className="ctrl-label">Requests: <strong>{numRequests}</strong></label>
          <input
            type="range"
            className="ctrl-slider"
            min={50}
            max={500}
            step={10}
            value={numRequests}
            onChange={(event) => setNumRequests(Number(event.target.value))}
            disabled={loading}
          />
        </div>

        <div className="ctrl-group">
          <label className="ctrl-label">Capacity: <strong>{serverCapacity}</strong></label>
          <input
            type="range"
            className="ctrl-slider"
            min={200}
            max={3000}
            step={100}
            value={serverCapacity}
            onChange={(event) => setServerCapacity(Number(event.target.value))}
            disabled={loading}
          />
        </div>

        <div className="control-actions">
          <button type="button" className="btn-run btn-ripple" onClick={onRun} disabled={loading}>
            {loading ? <><span className="spinner" /> Simulating...</> : 'Run Simulation'}
          </button>
          <button type="button" className="btn-stop" onClick={onStop} disabled={!canStop}>
            Stop
          </button>
        </div>
      </div>

      <div className="server-grid">
        {servers.map((server) => (
          <ServerCard
            key={server.serverId}
            server={server}
            isActive={activeServerId === server.serverId}
          />
        ))}
      </div>

      <ChartSection servers={servers} simulationRunning={loading} />
    </section>
  );
};

export default SimulationSection;
