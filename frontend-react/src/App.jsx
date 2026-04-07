import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardSection from './components/DashboardSection';
import SimulationSection from './components/SimulationSection';
import ComparisonSection from './components/ComparisonSection';
import AnalyticsSection from './components/AnalyticsSection';
import ActivitySection from './components/ActivitySection';
import ResetModal from './components/ResetModal';
import Login from './components/Login';
import BackgroundScene from './components/BackgroundScene';
import { ToastProvider } from './components/ToastContainer';
import { useToast } from './components/toastContext';
import api, {
  clearSession,
  getStoredToken,
  getStoredUser,
  persistSession,
} from './lib/api';

const DEFAULT_SERVERS = (count, capacity) =>
  Array.from({ length: count }, (_, index) => ({
    serverId: index + 1,
    currentLoad: 0,
    activeRequests: 0,
    maxCapacity: capacity,
    requestsHandled: 0,
    status: 'Normal',
    autoScaled: false,
  }));

const normalizeServer = (server) => ({
  ...server,
  currentLoad: server.currentLoad ?? 0,
  activeRequests: server.activeRequests ?? server.activeConnections ?? 0,
  maxCapacity: server.maxCapacity ?? server.capacity ?? 0,
  requestsHandled: server.requestsHandled ?? 0,
  status: server.status ?? 'Normal',
  autoScaled: Boolean(server.autoScaled),
});

const buildPersistentFinalServers = (serverTemplate, steps, initialServerCount, fallbackCapacity) => {
  const serverMap = new Map(
    serverTemplate.map((server) => {
      const normalized = normalizeServer(server);

      return [normalized.serverId, {
        ...normalized,
        currentLoad: 0,
        activeRequests: 0,
        requestsHandled: 0,
        status: 'Normal',
      }];
    }),
  );

  for (let index = 1; index <= initialServerCount; index += 1) {
    if (!serverMap.has(index)) {
      serverMap.set(index, {
        serverId: index,
        currentLoad: 0,
        activeRequests: 0,
        maxCapacity: fallbackCapacity,
        requestsHandled: 0,
        status: 'Normal',
        autoScaled: false,
      });
    }
  }

  steps.forEach((step) => {
    if (step.type !== 'arrival') {
      return;
    }

    const snapshot = step.serverSnapshot || {};
    const existing = serverMap.get(step.serverId) || {
      serverId: step.serverId,
      currentLoad: 0,
      activeRequests: 0,
      maxCapacity: snapshot.maxCapacity ?? fallbackCapacity,
      requestsHandled: 0,
      status: 'Normal',
      autoScaled: Boolean(snapshot.autoScaled),
    };
    const nextLoad = existing.currentLoad + (step.load ?? 0);

    serverMap.set(step.serverId, {
      ...existing,
      serverId: step.serverId,
      currentLoad: nextLoad,
      activeRequests: existing.activeRequests + 1,
      maxCapacity: snapshot.maxCapacity ?? existing.maxCapacity ?? fallbackCapacity,
      requestsHandled: existing.requestsHandled + 1,
      status: getStatusFromLoad(
        nextLoad,
        snapshot.maxCapacity ?? existing.maxCapacity ?? fallbackCapacity,
      ),
      autoScaled: Boolean(snapshot.autoScaled ?? existing.autoScaled),
    });
  });

  return Array.from(serverMap.values()).sort((left, right) => left.serverId - right.serverId);
};

const createAnimationBaseline = (serverTemplate, initialServerCount) =>
  serverTemplate
    .filter((server) => !server.autoScaled && server.serverId <= initialServerCount)
    .map((server) => ({
    serverId: server.serverId,
    currentLoad: 0,
    activeRequests: 0,
    maxCapacity: server.maxCapacity,
    requestsHandled: 0,
    status: 'Normal',
    autoScaled: Boolean(server.autoScaled),
  }));

const getStatusFromLoad = (load, capacity) => {
  const usage = load / capacity;

  if (usage >= 0.9) {
    return 'Overloaded';
  }

  if (usage >= 0.7) {
    return 'High';
  }

  if (usage >= 0.5) {
    return 'Medium';
  }

  return 'Normal';
};

function SessionScreen() {
  return (
    <div className="app-shell auth-shell">
      <BackgroundScene mode="auth" />
      <div className="glass auth-card">
        <h2>Checking Session</h2>
        <p>Restoring your simulator workspace...</p>
      </div>
    </div>
  );
}

function AppInner() {
  const [user, setUser] = useState(() => getStoredUser());
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [algorithm, setAlgorithm] = useState('roundrobin');
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [numServers, setNumServers] = useState(4);
  const [numRequests, setNumRequests] = useState(200);
  const [serverCapacity, setServerCapacity] = useState(1000);
  const [simulationSpeed, setSimulationSpeed] = useState(180);
  const [servers, setServers] = useState(() => DEFAULT_SERVERS(4, 1000));
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [runCount, setRunCount] = useState(0);
  const [lastAlgorithm, setLastAlgorithm] = useState('');
  const [totalRequests, setTotalRequests] = useState(0);
  const [comparisonData, setComparisonData] = useState(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [activeServerId, setActiveServerId] = useState(null);

  const overloadedCount = useMemo(
    () => servers.filter((s) => s.status === 'Overloaded').length,
    [servers],
  );

  const simIntensity = loading ? simulationProgress / 100 : 0;

  const overloadFactor = numServers > 0 ? overloadedCount / numServers : 0;

  const requestControllerRef = useRef(null);
  const stopAnimationRef = useRef(false);
  const progressResetTimeoutRef = useRef(null);

  const { addToast } = useToast();

  const addLog = useCallback((message) => {
    setLogs((previousLogs) => [...previousLogs, message]);
  }, []);

  const clearProgressReset = useCallback(() => {
    if (progressResetTimeoutRef.current) {
      clearTimeout(progressResetTimeoutRef.current);
      progressResetTimeoutRef.current = null;
    }
  }, []);

  const clearWorkspaceState = useCallback(() => {
    setLoading(false);
    setComparing(false);
    setServers(DEFAULT_SERVERS(numServers, serverCapacity));
    setMetrics(null);
    setLogs([]);
    setRunCount(0);
    setLastAlgorithm('');
    setTotalRequests(0);
    setComparisonData(null);
    setSimulationProgress(0);
    setActiveServerId(null);
    setActiveSection('dashboard');
  }, [numServers, serverCapacity]);

  const cancelActiveSimulation = useCallback(() => {
    stopAnimationRef.current = true;

    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
      requestControllerRef.current = null;
    }

    clearProgressReset();
    setLoading(false);
    setSimulationProgress(0);
    setActiveServerId(null);
  }, [clearProgressReset]);

  const handleSessionExpired = useCallback(() => {
    cancelActiveSimulation();
    clearSession();
    clearWorkspaceState();
    setUser(null);
    addToast('Your session expired. Please log in again.', 'warning');
  }, [addToast, cancelActiveSimulation, clearWorkspaceState]);

  useEffect(() => {
    let ignore = false;
    const token = getStoredToken();

    if (!token) {
      setSessionLoading(false);
      return undefined;
    }

    api.get('/auth/me')
      .then((response) => {
        if (ignore) {
          return;
        }

        const nextUser = response.data.user;
        persistSession({ token, user: nextUser });
        setUser(nextUser);
      })
      .catch(() => {
        if (ignore) {
          return;
        }

        clearSession();
        setUser(null);
      })
      .finally(() => {
        if (!ignore) {
          setSessionLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => () => {
    stopAnimationRef.current = true;

    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
    }

    clearProgressReset();
  }, [clearProgressReset]);

  const animateSimulation = useCallback(async (finalServers, steps, newLogs) => {
    let currentServers = createAnimationBaseline(finalServers, numServers);
    let logIndex = 0;

    setServers([...currentServers]);
    setSimulationProgress(0);

    for (let index = 0; index < steps.length; index += 1) {
      if (stopAnimationRef.current) {
        setActiveServerId(null);
        return false;
      }

      const step = steps[index];
      await new Promise((resolve) => setTimeout(resolve, simulationSpeed));

      if (stopAnimationRef.current) {
        setActiveServerId(null);
        return false;
      }

      flushSync(() => {
        setActiveServerId(step.serverId);
      });

      const stepServerSnapshot = step.serverSnapshot || finalServers.find((server) => server.serverId === step.serverId);

      if (!currentServers.some((server) => server.serverId === step.serverId) && stepServerSnapshot) {
        currentServers = [
          ...currentServers,
          {
            serverId: stepServerSnapshot.serverId,
            currentLoad: 0,
            activeRequests: 0,
            maxCapacity: stepServerSnapshot.maxCapacity,
            requestsHandled: 0,
            status: 'Normal',
            autoScaled: Boolean(stepServerSnapshot.autoScaled),
          },
        ].sort((left, right) => left.serverId - right.serverId);
      }

      currentServers = currentServers.map((server) => {
        if (server.serverId !== step.serverId) {
          return server;
        }

        if (step.type === 'completion') {
          return server;
        }

        const nextLoad = server.currentLoad + step.load;

        return {
          ...server,
          currentLoad: nextLoad,
          activeRequests: (server.activeRequests ?? 0) + 1,
          requestsHandled: server.requestsHandled + 1,
          status: getStatusFromLoad(nextLoad, server.maxCapacity),
        };
      });

      flushSync(() => {
        setServers([...currentServers]);
        setSimulationProgress(Math.round(((index + 1) / steps.length) * 100));
      });

      if (step.type === 'arrival' && logIndex < newLogs.length && logIndex < 100) {
        const nextLog = newLogs[logIndex];
        logIndex += 1;
        setLogs((previousLogs) => [...previousLogs, nextLog]);
      }
    }

    setActiveServerId(null);
    setServers(finalServers);

    const overloadedServers = finalServers.filter((server) => server.status === 'Overloaded');
    if (overloadedServers.length > 0) {
      addToast(`${overloadedServers.length} server(s) overloaded.`, 'warning');
    }

    if (finalServers.length > 0 && finalServers.every((server) => server.status === 'Overloaded')) {
      addLog('SYSTEM OVERLOADED: All servers exceed 90% capacity.');
    }

    clearProgressReset();
    progressResetTimeoutRef.current = setTimeout(() => {
      setSimulationProgress(0);
      progressResetTimeoutRef.current = null;
    }, 600);

    return true;
  }, [addLog, addToast, clearProgressReset, numServers, simulationSpeed]);

  const handleLoginSuccess = useCallback(({ token, user: nextUser }) => {
    persistSession({ token, user: nextUser });
    clearWorkspaceState();
    setUser(nextUser);
    setSessionLoading(false);
    addToast('Login successful.', 'success');
  }, [addToast, clearWorkspaceState]);

  const handleStopSimulation = useCallback(() => {
    const hasActiveSimulation = loading || Boolean(requestControllerRef.current);

    if (!hasActiveSimulation) {
      return;
    }

    cancelActiveSimulation();
    addLog('Simulation stopped by user.');
    addToast('Simulation stopped.', 'warning');
  }, [addLog, addToast, cancelActiveSimulation, loading]);

  const handleRunSimulation = useCallback(async () => {
    stopAnimationRef.current = false;
    clearProgressReset();
    setLoading(true);
    setLogs([]);
    setServers(DEFAULT_SERVERS(numServers, serverCapacity));
    setSimulationProgress(0);
    setActiveServerId(null);
    setActiveSection('simulation');

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const response = await api.get('/simulate', {
        params: {
          algorithm,
          numServers,
          numRequests,
          serverCapacity,
        },
        signal: controller.signal,
      });

      requestControllerRef.current = null;

      const {
        servers: nextServers,
        logs: nextLogs,
        steps,
        metrics: nextMetrics,
        totalRequests: nextTotalRequests,
      } = response.data;
      const normalizedServers = (nextServers || []).map(normalizeServer);
      const resolvedFinalServers = buildPersistentFinalServers(
        normalizedServers,
        steps || [],
        numServers,
        serverCapacity,
      );

      setMetrics(nextMetrics);
      setRunCount((currentCount) => currentCount + 1);
      setLastAlgorithm(algorithm);
      setTotalRequests(nextTotalRequests);

      const completed = await animateSimulation(resolvedFinalServers, steps, nextLogs);

      if (completed) {
        addToast('Simulation completed successfully.', 'success');
      }
    } catch (error) {
      requestControllerRef.current = null;

      if (error.code === 'ERR_CANCELED') {
        return;
      }

      console.error(error);

      if (error.response?.status === 401) {
        handleSessionExpired();
        return;
      }

      const message = error.response?.data?.error || 'Backend error: ensure the server is running on port 5000';
      addLog(`Simulation error: ${message}`);
      addToast(message, 'warning');
    } finally {
      requestControllerRef.current = null;
      setLoading(false);
      stopAnimationRef.current = false;
    }
  }, [
    algorithm,
    addLog,
    addToast,
    animateSimulation,
    clearProgressReset,
    handleSessionExpired,
    numRequests,
    numServers,
    serverCapacity,
  ]);

  const handleCompare = useCallback(async () => {
    setComparing(true);
    setComparisonData(null);

    try {
      const response = await api.get('/simulate/compare', {
        params: {
          numServers,
          numRequests,
          serverCapacity,
        },
      });

      setComparisonData(response.data);
      setActiveSection('comparison');
      addToast('Comparison completed.', 'success');
    } catch (error) {
      console.error(error);

      if (error.response?.status === 401) {
        handleSessionExpired();
        return;
      }

      const message = error.response?.data?.error || 'Comparison failed';
      addToast(message, 'warning');
    } finally {
      setComparing(false);
    }
  }, [addToast, handleSessionExpired, numRequests, numServers, serverCapacity]);

  const handleResetClick = useCallback(() => {
    setShowResetModal(true);
  }, []);

  const handleResetConfirm = useCallback(() => {
    setShowResetModal(false);
    cancelActiveSimulation();
    clearWorkspaceState();
    addToast('Simulation reset.', 'success');
  }, [addToast, cancelActiveSimulation, clearWorkspaceState]);

  const handleResetCancel = useCallback(() => {
    setShowResetModal(false);
  }, []);

  const handleLogout = useCallback(() => {
    cancelActiveSimulation();
    clearSession();
    clearWorkspaceState();
    setUser(null);
  }, [cancelActiveSimulation, clearWorkspaceState]);

  if (sessionLoading) {
    return <SessionScreen />;
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div
      className="app-shell"
      style={{
        '--sim-intensity': simIntensity,
        '--overload-factor': overloadFactor,
        '--sim-active': loading ? 1 : 0,
      }}
    >
      <BackgroundScene
        simIntensity={simIntensity}
        overloadFactor={overloadFactor}
        isActive={loading}
      />

      <Sidebar active={activeSection} onNavigate={setActiveSection} />

      <div className="main-shell">
        <Navbar
          comparing={comparing}
          loading={loading}
          onCompare={handleCompare}
          onLogout={handleLogout}
          onReset={handleResetClick}
          onRun={handleRunSimulation}
          onStop={handleStopSimulation}
          progress={simulationProgress}
          username={user.username}
        />

        <div className="content-area">
          {activeSection === 'dashboard' && (
            <DashboardSection
              metrics={metrics}
              numServers={numServers}
              lastAlgorithm={lastAlgorithm}
              runCount={runCount}
              totalRequests={totalRequests}
            />
          )}
          {activeSection === 'simulation' && (
            <SimulationSection
              activeServerId={activeServerId}
              algorithm={algorithm}
              canStop={loading}
              loading={loading}
              numRequests={numRequests}
              numServers={numServers}
              onRun={handleRunSimulation}
              onStop={handleStopSimulation}
              serverCapacity={serverCapacity}
              servers={servers}
              setAlgorithm={setAlgorithm}
              setNumRequests={setNumRequests}
              setNumServers={setNumServers}
              setServerCapacity={setServerCapacity}
              setSimulationSpeed={setSimulationSpeed}
              simulationSpeed={simulationSpeed}
            />
          )}
          {activeSection === 'comparison' && (
            <ComparisonSection data={comparisonData} onCompare={handleCompare} comparing={comparing} />
          )}
          {activeSection === 'analytics' && (
            <AnalyticsSection
              lastAlgorithm={lastAlgorithm}
              metrics={metrics}
              servers={servers}
              totalRequests={totalRequests}
            />
          )}
          {activeSection === 'activity' && (
            <ActivitySection logs={logs} />
          )}
        </div>
      </div>

      <ResetModal
        open={showResetModal}
        onCancel={handleResetCancel}
        onConfirm={handleResetConfirm}
      />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

export default App;
