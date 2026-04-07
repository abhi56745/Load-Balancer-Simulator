import React, { useRef, useEffect } from 'react';

const ActivityLog = ({ logs }) => {
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="activity-log-section glass">
      <div className="log-header">
        <h3><span className="live-dot"></span> Live Activity Feed</h3>
        <span className="log-count">{logs.length} events logged</span>
      </div>
      <div className="log-container" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div className="empty-log">Awaiting simulation data...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              <span className="log-prefix">&gt;</span> {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
