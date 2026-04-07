import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ALGO_LABELS = {
  roundrobin: 'Round Robin',
  swrr: 'Smooth Weighted Round Robin',
  least: 'Least Connections',
  leastoutstanding: 'Least Outstanding Requests',
  p2c: 'Power of 2 Choices',
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

const ALGO_COLORS = {
  roundrobin: '#0ff',
  swrr: '#0ea5e9',
  least: '#a200ff',
  leastoutstanding: '#8b5cf6',
  p2c: '#d946ef',
  p2cewma: '#ec4899',
  iphash: '#f43f5e',
  ringhash: '#f97316',
  maglev: '#f59e0b',
  hrw: '#eab308',
  localityaware: '#84cc16',
  random: '#22c55e',
  weighted: '#10b981',
  jsq: '#14b8a6',
  jiq: '#06b6d4',
  sed: '#3b82f6',
  boundedch: '#6366f1',
  aperture: '#a855f7',
  weightedrandomam: '#d946ef',
};

const createBarOptions = (metrics) => ({
  maintainAspectRatio: false,
  responsive: true,
  animation: { duration: 900, easing: 'easeOutQuart' },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(255,255,255,0.07)' },
      ticks: { color: '#94a3b8' },
    },
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8' },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `Requests: ${context.raw} | Fairness: ${metrics.fairnessIndex.toFixed(2)}`,
      },
    },
  },
});

const ComparisonSection = ({ data, onCompare, comparing }) => {
  if (!data) {
    return (
      <section className="section-wrapper fade-in">
        <div className="section-header">
          <h2>Algorithm <span className="gradient-text">Comparison</span></h2>
          <p className="section-sub">Compare all strategies on the same request set</p>
        </div>
        <div className="empty-state glass">
          <div className="empty-icon">Compare</div>
          <p>No comparison data yet.</p>
          <button className="btn-compare" onClick={onCompare} disabled={comparing}>
            {comparing ? 'Running...' : 'Run Comparison'}
          </button>
        </div>
      </section>
    );
  }

  const { results, bestAlgorithm, totalRequests, numServers } = data;
  const algorithmKeys = Object.keys(results);

  return (
    <section className="section-wrapper fade-in">
      <div className="section-header">
        <h2>Algorithm <span className="gradient-text">Comparison</span></h2>
        <p className="section-sub">
          {numServers} servers | {totalRequests} requests on the same workload
        </p>
      </div>

      {bestAlgorithm && (() => {
        const bestMetrics = results[bestAlgorithm].metrics;

        return (
          <div className="winner-banner glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              Best Algorithm: <strong style={{ color: ALGO_COLORS[bestAlgorithm] }}>{ALGO_LABELS[bestAlgorithm]}</strong>
              <span className="winner-sub"> - highest composite score (fairness + latency + efficiency)</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Fairness: <strong style={{ color: bestMetrics.fairnessIndex >= 0.95 ? '#22c55e' : '#f59e0b' }}>{bestMetrics.fairnessIndex.toFixed(4)}</strong></span>
              <span>Avg Requests: <strong style={{ color: '#fff' }}>{bestMetrics.avgLoad}</strong></span>
              <span>Avg Latency: <strong style={{ color: '#fff' }}>{bestMetrics.avgLatency}ms</strong></span>
              <span>P95: <strong style={{ color: '#f97316' }}>{bestMetrics.p95Latency ?? '--'}ms</strong></span>
              <span>Overloaded: <strong style={{ color: bestMetrics.overloadedCount > 0 ? '#ff0055' : '#22c55e' }}>{bestMetrics.overloadedCount}</strong></span>
              <span>Efficiency: <strong style={{ color: '#00ffff' }}>{bestMetrics.efficiencyScore}%</strong></span>
            </div>
          </div>
        );
      })()}

      <div className="comparison-grid">
        {algorithmKeys.map((algorithm) => {
          const { servers, metrics } = results[algorithm];
          const isBest = algorithm === bestAlgorithm;
          const labels = servers.map((server) => `S${server.serverId}`);
          const barData = {
            labels,
            datasets: [
              {
                label: 'Requests handled',
                data: servers.map((server) => server.requestsHandled),
                backgroundColor: `${ALGO_COLORS[algorithm]}33`,
                borderColor: ALGO_COLORS[algorithm],
                borderWidth: 2,
                borderRadius: 8,
              },
            ],
          };

          return (
            <div
              key={algorithm}
              className={`comp-card glass ${isBest ? 'comp-best' : ''}`}
              style={{ '--algo-color': ALGO_COLORS[algorithm] }}
            >
              {isBest && <div className="best-tag">Best</div>}
              <h3 className="comp-algo-name" style={{ color: ALGO_COLORS[algorithm] }}>
                {ALGO_LABELS[algorithm]}
              </h3>
              <div className="comp-metrics-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                <div className="cm"><span className="cm-label">Avg Requests</span><span className="cm-val">{metrics.avgLoad}</span></div>
                <div className="cm"><span className="cm-label">Fairness</span><span className="cm-val" style={{ color: metrics.fairnessIndex >= 0.95 ? '#22c55e' : metrics.fairnessIndex >= 0.8 ? '#f59e0b' : '#ff0055' }}>{metrics.fairnessIndex.toFixed(4)}</span></div>
                <div className="cm"><span className="cm-label">Efficiency</span><span className="cm-val" style={{ color: '#0ff' }}>{metrics.efficiencyScore}%</span></div>
                <div className="cm"><span className="cm-label">Avg Latency</span><span className="cm-val">{metrics.avgLatency}ms</span></div>
                <div className="cm"><span className="cm-label">P95 Latency</span><span className="cm-val" style={{ color: '#f97316' }}>{metrics.p95Latency ?? '--'}ms</span></div>
                <div className="cm"><span className="cm-label">Overloaded</span><span className="cm-val" style={{ color: metrics.overloadedCount > 0 ? '#ff0055' : '#22c55e' }}>{metrics.overloadedCount}</span></div>
              </div>
              <div style={{ position: 'relative', height: '140px', width: '100%' }}>
                <Bar data={barData} options={createBarOptions(metrics)} />
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn-compare" style={{ marginTop: '20px' }} onClick={onCompare} disabled={comparing}>
        {comparing ? 'Running...' : 'Run Comparison Again'}
      </button>
    </section>
  );
};

export default ComparisonSection;
