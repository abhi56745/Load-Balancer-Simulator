import React, { useEffect, useState } from 'react';

const ServerCard = ({ server }) => {
  const [animatedLoad, setAnimatedLoad] = useState(0);
  const loadPercent = Math.min((server.currentLoad / server.maxCapacity) * 100, 100).toFixed(1);
  const isOverloaded = server.status === 'Overloaded';

  useEffect(() => {
    // Small delay to trigger the CSS transition
    const timer = setTimeout(() => {
      setAnimatedLoad(loadPercent);
    }, 100);
    return () => clearTimeout(timer);
  }, [server.currentLoad, loadPercent]);

  return (
    <div className="server-card glass">
      <h4>
        Server {server.serverId} 
        <span className={`status-badge ${isOverloaded ? 'status-overloaded' : 'status-normal'}`}>
          {server.status}
        </span>
      </h4>
      <div className="load-bar-container">
        <div 
          className="load-bar" 
          style={{ width: `${animatedLoad}%` }}
        ></div>
      </div>
      <div className="server-stats">
        <span>Load: {server.currentLoad} / {server.maxCapacity}</span>
        <span>{loadPercent}%</span>
      </div>
      <div className="server-stats" style={{ marginTop: '5px' }}>
        <span>Requests: {server.requestsHandled}</span>
      </div>
    </div>
  );
};

export default ServerCard;
