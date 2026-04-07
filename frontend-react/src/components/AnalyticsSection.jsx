import React from 'react';
import SmartInsights from './SmartInsights';

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
  weighted: 'Weighted RR',
  jsq: 'Join Shortest Queue',
  jiq: 'Join Idle Queue',
  sed: 'Shortest Expected Delay',
  boundedch: 'Bounded-Load Consistent Hash',
  aperture: 'Aperture / Subsetting',
  weightedrandomam: 'Weighted Random + Anomaly Mitigation',
};

const getServerStatus = (server) => {
  const usage = (server.currentLoad ?? 0) / server.maxCapacity;

  if (usage >= 0.9) return 'Overloaded';
  if (usage >= 0.7) return 'High';
  if (usage >= 0.5) return 'Medium';
  return 'Normal';
};

const STATUS_COLORS = {
  Normal: '#22c55e',
  Medium: '#38bdf8',
  High: '#f59e0b',
  Overloaded: '#ff0055',
};

const Metric = ({ label, value, accent, sub }) => (
  <div className="metric-card glass" style={{ '--accent-color': accent }}>
    <div className="mc-value" style={{ color: accent }}>{value ?? '--'}</div>
    <div className="mc-label">{label}</div>
    {sub ? <div className="mc-sub">{sub}</div> : null}
  </div>
);

const AnalyticsSection = ({ metrics, servers, totalRequests, lastAlgorithm }) => {
  if (!metrics) {
    return (
      <section className="section-wrapper fade-in">
        <div className="section-header">
          <h2>Analytics <span className="gradient-text">Panel</span></h2>
          <p className="section-sub">Detailed performance breakdown for the last simulation.</p>
        </div>
        <div className="empty-state glass">
          <div className="empty-icon">DATA</div>
          <p>Run a simulation first to unlock analytics.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section-wrapper fade-in">
      <div className="section-header">
        <h2>Analytics <span className="gradient-text">Panel</span></h2>
        <p className="section-sub">
          Algorithm: <strong style={{ color: '#0ff' }}>{ALGO_LABELS[lastAlgorithm] || lastAlgorithm}</strong> | {totalRequests} requests
        </p>
      </div>

      <div className="metrics-grid">
        <Metric label="Average Requests" value={metrics.avgLoad} accent="#0ff" sub="Per server" />
        <Metric label="Max Requests" value={metrics.maxLoad} accent="#a200ff" sub="Most requests on one server" />
        <Metric label="Min Requests" value={metrics.minLoad} accent="#22c55e" sub="Fewest requests on one server" />
        <Metric label="Total Routed" value={metrics.totalLoad} accent="#38bdf8" sub="Requests distributed overall" />
        <Metric label="Fairness Index" value={metrics.fairnessIndex} accent="#f59e0b" sub="1.0 means perfectly balanced" />
        <Metric label="Avg Latency" value={`${metrics.avgLatency}ms`} accent="#eab308" sub="Average response time" />
        <Metric label="P50 Latency" value={`${metrics.p50Latency ?? '--'}ms`} accent="#84cc16" sub="Median response time" />
        <Metric label="P95 Latency" value={`${metrics.p95Latency ?? '--'}ms`} accent="#f97316" sub="95th-percentile tail latency" />
        <Metric label="P99 Latency" value={`${metrics.p99Latency ?? '--'}ms`} accent="#ef4444" sub="99th-percentile tail latency" />
        <Metric label="Throughput" value={`${metrics.throughput} req/s`} accent="#a855f7" sub="Simulated processing rate" />
        <Metric
          label="Overloaded Servers"
          value={metrics.overloadedCount}
          accent={metrics.overloadedCount > 0 ? '#ff0055' : '#22c55e'}
          sub={metrics.overloadedCount > 0 ? 'Load crossed safe capacity' : 'All servers stayed within capacity'}
        />
        <Metric label="Std Deviation" value={metrics.stdDev} accent="#06b6d4" sub="Load distribution spread" />
      </div>

      <SmartInsights metrics={metrics} servers={servers} lastAlgorithm={lastAlgorithm} />

      <div className="server-breakdown glass">
        <h3 style={{ marginBottom: '16px', color: '#94a3b8' }}>Per-Server Breakdown</h3>
        <table className="breakdown-table">
          <thead>
            <tr>
              <th>Server</th>
              <th>Current Load</th>
              <th>Capacity</th>
              <th>Usage %</th>
              <th>Active</th>
              <th>Handled</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => {
              const currentLoad = server.currentLoad ?? 0;
              const usagePercent = ((currentLoad / server.maxCapacity) * 100).toFixed(1);
              const status = getServerStatus(server);
              const statusColor = STATUS_COLORS[status];

              return (
                <tr key={server.serverId}>
                  <td>Server {server.serverId}</td>
                  <td>{currentLoad}</td>
                  <td>{server.maxCapacity}</td>
                  <td style={{ color: statusColor }}>{usagePercent}%</td>
                  <td>{server.activeRequests ?? 0}</td>
                  <td>{server.requestsHandled}</td>
                  <td style={{ color: statusColor }}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AnalyticsSection;
