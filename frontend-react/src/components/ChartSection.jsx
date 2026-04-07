import React, { useRef, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const CHART_COLORS = ['#00ffff', '#a200ff', '#22c55e', '#f59e0b', '#fb7185', '#38bdf8', '#c084fc', '#4ade80', '#facc15', '#60a5fa'];

const getBarColor = (usage) => {
  if (usage > 0.9) return { bg: 'rgba(255,0,85,0.32)', border: '#ff0055' };
  if (usage > 0.7) return { bg: 'rgba(245,158,11,0.32)', border: '#f59e0b' };
  if (usage > 0.5) return { bg: 'rgba(56,189,248,0.28)', border: '#38bdf8' };
  return { bg: 'rgba(0,255,255,0.24)', border: '#00ffff' };
};

const ChartSection = ({ servers, simulationRunning = false }) => {
  const barRef = useRef(null);
  const doughnutRef = useRef(null);

  const labels = servers.map((server) => `Server ${server.serverId}`);
  const currentLoads = servers.map((server) => server.currentLoad ?? 0);
  const displayLoads = servers.map((server) => {
    const currentLoad = server.currentLoad ?? 0;
    const peakLoad = server.peakLoad ?? currentLoad;

    if (!simulationRunning && currentLoad === 0 && peakLoad > 0) {
      return peakLoad;
    }

    return currentLoad;
  });
  const capacities = servers.map((server) => server.maxCapacity);
  const handledRequests = servers.map((server) => server.requestsHandled ?? 0);
  const hasLoad = displayLoads.some((load) => load > 0);
  const hasRequests = handledRequests.some((count) => count > 0);
  const loadLabel = !simulationRunning && currentLoads.every((load) => load === 0) && hasLoad
    ? 'Peak Load'
    : 'Current Load';

  const barData = {
    labels,
    datasets: [
      {
        label: loadLabel,
        data: hasLoad ? displayLoads : displayLoads.map(() => 0),
        backgroundColor: servers.map((server, index) => getBarColor((displayLoads[index] ?? 0) / server.maxCapacity).bg),
        borderColor: servers.map((server, index) => getBarColor((displayLoads[index] ?? 0) / server.maxCapacity).border),
        borderWidth: 2,
        borderRadius: 8,
        minBarLength: 8,
      },
      {
        label: 'Capacity',
        data: capacities,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderRadius: 8,
        borderDash: [4, 4],
      },
    ],
  };

  const doughnutData = {
    labels,
    datasets: [
      {
        data: hasRequests ? handledRequests : labels.map(() => 1),
        backgroundColor: CHART_COLORS.slice(0, servers.length).map((color) => `${color}55`),
        borderColor: CHART_COLORS.slice(0, servers.length),
        borderWidth: 2,
      },
    ],
  };

  const barOptions = {
    maintainAspectRatio: false,
    responsive: true,
    animation: { duration: 150, easing: 'linear' },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
      },
    },
    plugins: {
      legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Outfit' } } },
      tooltip: {
        backgroundColor: 'rgba(8,14,28,0.9)',
        borderColor: 'rgba(0,255,255,0.3)',
        borderWidth: 1,
        titleColor: '#00ffff',
        bodyColor: '#94a3b8',
        callbacks: {
          afterBody: (items) => {
            const server = servers[items[0].dataIndex];
            if (!server) return '';

            const snapshotLoad = displayLoads[items[0].dataIndex] ?? 0;
            const usage = (((snapshotLoad ?? 0) / server.maxCapacity) * 100).toFixed(1);

            return [
              `${loadLabel}: ${snapshotLoad}`,
              `Usage: ${usage}%`,
              `Live load: ${server.currentLoad ?? 0}`,
              `Peak load: ${server.peakLoad ?? server.currentLoad ?? 0}`,
              `Active requests: ${server.activeRequests ?? 0}`,
              `Requests handled: ${server.requestsHandled}`,
            ];
          },
        },
      },
    },
  };

  const doughnutOptions = {
    maintainAspectRatio: false,
    responsive: true,
    animation: { duration: 150, easing: 'linear' },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', padding: 16, font: { family: 'Outfit' } },
      },
      tooltip: {
        backgroundColor: 'rgba(8,14,28,0.9)',
        borderColor: 'rgba(162,0,255,0.3)',
        borderWidth: 1,
        titleColor: '#a200ff',
        bodyColor: '#94a3b8',
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
            return `${context.label}: ${context.parsed} requests (${percentage}%)`;
          },
        },
      },
    },
    cutout: '68%',
  };

  // Update chart data in-place for smooth transitions instead of destroying/recreating
  useEffect(() => {
    if (barRef.current) {
      const chart = barRef.current;
      chart.data.labels = labels;
      chart.data.datasets[0].label = loadLabel;
      chart.data.datasets[0].data = hasLoad ? displayLoads : displayLoads.map(() => 0);
      chart.data.datasets[0].backgroundColor = servers.map((server, index) => getBarColor((displayLoads[index] ?? 0) / server.maxCapacity).bg);
      chart.data.datasets[0].borderColor = servers.map((server, index) => getBarColor((displayLoads[index] ?? 0) / server.maxCapacity).border);
      chart.data.datasets[1].data = capacities;
      chart.update('none');
    }
  }, [capacities, displayLoads, hasLoad, labels, loadLabel, servers]);

  useEffect(() => {
    if (doughnutRef.current) {
      const chart = doughnutRef.current;
      chart.data.labels = labels;
      chart.data.datasets[0].data = hasRequests ? handledRequests : labels.map(() => 1);
      chart.update('none');
    }
  }, [handledRequests, labels, hasRequests]);

  return (
    <div className="charts-section">
      <div className="chart-wrapper glass">
        <h3>{loadLabel} vs Capacity</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%' }}>
          <Bar ref={barRef} data={barData} options={barOptions} />
        </div>
      </div>
      <div className="chart-wrapper glass">
        <h3>Request Share</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%' }}>
          <Doughnut ref={doughnutRef} data={doughnutData} options={doughnutOptions} />
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
