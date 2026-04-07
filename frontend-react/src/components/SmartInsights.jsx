import React from 'react';

const ALGO_LABELS = {
  roundrobin: 'Round Robin',
  swrr: 'Smooth Weighted Round Robin',
  least: 'Least Connections',
  leastoutstanding: 'Least Outstanding Requests',
  p2c: 'Power of Two Choices',
  p2cewma: 'P2C + Peak EWMA',
  iphash: 'IP Hash',
  ringhash: 'Ring Hash (Consistent)',
  maglev: 'Maglev Hashing',
  hrw: 'Rendezvous Hashing (HRW)',
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

const ALGO_CATEGORIES = {
  roundrobin: 'static', swrr: 'static', weighted: 'static',
  least: 'adaptive', leastoutstanding: 'adaptive', jsq: 'adaptive',
  jiq: 'adaptive', sed: 'adaptive',
  p2c: 'probabilistic', p2cewma: 'probabilistic', random: 'probabilistic',
  aperture: 'probabilistic', weightedrandomam: 'probabilistic',
  iphash: 'hash', ringhash: 'hash', maglev: 'hash', hrw: 'hash',
  boundedch: 'hash', localityaware: 'locality',
};

const INSIGHT_COLORS = {
  success: '#22c55e',
  info: '#38bdf8',
  warning: '#f59e0b',
  critical: '#ff0055',
};

const generateInsights = (metrics, servers, lastAlgorithm) => {
  if (!metrics || !servers?.length) return [];

  const insights = [];
  const algorithmName = ALGO_LABELS[lastAlgorithm] || lastAlgorithm;
  const category = ALGO_CATEGORIES[lastAlgorithm] || 'unknown';

  // ── Fairness Assessment ──
  if (metrics.fairnessIndex >= 0.98) {
    insights.push({
      tag: 'EXCELLENT',
      text: `${algorithmName} achieved near-perfect balance with a Jain's Fairness Index of ${metrics.fairnessIndex.toFixed(4)}. This rivals optimal distribution.`,
      type: 'success',
    });
  } else if (metrics.fairnessIndex >= 0.95) {
    insights.push({
      tag: 'GOOD',
      text: `${algorithmName} delivered strong balance (fairness ${metrics.fairnessIndex.toFixed(4)}). Suitable for production workloads.`,
      type: 'success',
    });
  } else if (metrics.fairnessIndex >= 0.8) {
    insights.push({
      tag: 'INFO',
      text: `Balance is acceptable but uneven. Fairness index: ${metrics.fairnessIndex.toFixed(4)}. Consider adaptive strategies (Least Connections, P2C) for tighter distribution.`,
      type: 'info',
    });
  } else {
    insights.push({
      tag: 'WARN',
      text: `${algorithmName} struggled with this workload. Fairness dropped to ${metrics.fairnessIndex.toFixed(4)} — some servers received significantly more traffic.`,
      type: 'warning',
    });
  }

  // ── Overload Assessment ──
  if (metrics.overloadedCount > 0) {
    const pct = ((metrics.overloadedCount / servers.length) * 100).toFixed(0);
    insights.push({
      tag: 'CRITICAL',
      text: `${metrics.overloadedCount} of ${servers.length} servers (${pct}%) crossed the 90% capacity threshold. Tail latency (P99: ${metrics.p99Latency ?? '?'}ms) will spike.`,
      type: 'critical',
    });
  } else {
    insights.push({
      tag: 'GOOD',
      text: `All servers stayed within capacity. P95 latency: ${metrics.p95Latency ?? '--'}ms, P99: ${metrics.p99Latency ?? '--'}ms.`,
      type: 'success',
    });
  }

  // ── Efficiency ──
  if (metrics.efficiencyScore >= 90) {
    insights.push({
      tag: 'GOOD',
      text: `Efficiency score is ${metrics.efficiencyScore}% — queueing overhead is minimal and resource utilization is balanced.`,
      type: 'success',
    });
  } else if (metrics.efficiencyScore < 60) {
    insights.push({
      tag: 'WARN',
      text: `Efficiency dropped to ${metrics.efficiencyScore}%. For this workload, consider JSQ, Least Connections, or P2C for better resource utilization.`,
      type: 'warning',
    });
  }

  // ── Category-Specific Insights ──
  if (category === 'hash') {
    const spread = metrics.maxLoad - metrics.minLoad;
    const tolerance = metrics.avgLoad * 0.4;
    if (spread <= tolerance) {
      insights.push({
        tag: 'INFO',
        text: `Hash-based routing shows good key distribution. Max-min spread is ${spread} requests (within ${((spread / metrics.avgLoad) * 100).toFixed(0)}% of average).`,
        type: 'info',
      });
    } else {
      insights.push({
        tag: 'INFO',
        text: `Hash distribution is uneven (spread: ${spread} requests). This is expected for hash-based algorithms with smaller server pools. Adding more servers or virtual nodes can improve uniformity.`,
        type: 'info',
      });
    }
  }

  if (category === 'adaptive' && metrics.stdDev < 3) {
    insights.push({
      tag: 'INFO',
      text: `Adaptive balancing achieved tight convergence with a load standard deviation of only ${metrics.stdDev} requests across servers.`,
      type: 'info',
    });
  }

  // ── Latency Insight ──
  if (metrics.p95Latency && metrics.avgLatency && metrics.p95Latency > metrics.avgLatency * 3) {
    insights.push({
      tag: 'INFO',
      text: `P95 latency (${metrics.p95Latency}ms) is ${(metrics.p95Latency / metrics.avgLatency).toFixed(1)}× higher than average (${metrics.avgLatency}ms), indicating heavy-tail request patterns in this workload.`,
      type: 'info',
    });
  }

  return insights;
};

const SmartInsights = ({ metrics, servers, lastAlgorithm }) => {
  const insights = generateInsights(metrics, servers, lastAlgorithm);

  if (insights.length === 0) return null;

  return (
    <div className="smart-insights glass" style={{ padding: '24px', marginBottom: '28px' }}>
      <h3 style={{ marginBottom: '16px', color: '#94a3b8' }}>Smart Insights</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {insights.map((insight, index) => (
          <div
            key={`${insight.tag}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '10px',
              background: `${INSIGHT_COLORS[insight.type]}11`,
              borderLeft: `3px solid ${INSIGHT_COLORS[insight.type]}`,
            }}
          >
            <span className="insight-tag" style={{ color: INSIGHT_COLORS[insight.type] }}>{insight.tag}</span>
            <span style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5' }}>{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SmartInsights;
