import React, { useEffect, useRef, useState } from 'react';

const getLogType = (log) => {
  const normalizedLog = log.toLowerCase();

  if (normalizedLog.includes('error') || normalizedLog.includes('overloaded') || normalizedLog.includes('failed')) {
    return 'log-warn';
  }

  if (normalizedLog.includes('request #') || normalizedLog.includes('assigned to server')) {
    return 'log-info';
  }

  return 'log-default';
};

const ActivitySection = ({ logs }) => {
  const feedRef = useRef(null);
  const [filter, setFilter] = useState('All');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'All') return true;
    const type = getLogType(log);
    if (filter === 'Requests') return type === 'log-info';
    if (filter === 'Errors') return type === 'log-warn';
    return true;
  });

  return (
    <section className="section-wrapper fade-in">
      <div className="section-header">
        <h2>Live <span className="gradient-text">Activity</span></h2>
        <p className="section-sub">Real-time request routing log and runtime events.</p>
      </div>
      <div className="activity-panel glass">
        <div className="activity-header">
          <div className="live-indicator">
            <span className="live-dot" />
            <span>LIVE</span>
          </div>
          <span className="log-count">{filteredLogs.length} events</span>

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            {['All', 'Requests', 'Errors'].map((item) => (
              <button
                key={item}
                type="button"
                className="btn-clear"
                onClick={() => setFilter(item)}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 12px',
                  background: filter === item ? 'rgba(0,255,255,0.15)' : '',
                  borderColor: filter === item ? '#00ffff' : '',
                }}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              className="btn-clear"
              onClick={() => setAutoScroll((current) => !current)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                background: autoScroll ? 'rgba(34,197,94,0.15)' : '',
                borderColor: autoScroll ? '#22c55e' : '',
              }}
            >
              {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
            </button>
          </div>
        </div>
        <div className="log-feed" ref={feedRef}>
          {filteredLogs.length === 0 ? (
            <div className="empty-log">
              <span className="empty-icon-sm">LOG</span>
              <p>No activity to show yet.</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={`${log}-${index}`} className={`log-row ${getLogType(log)}`}>
                <span className="log-prefix">&gt;</span>
                <span className="log-text">{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default ActivitySection;
