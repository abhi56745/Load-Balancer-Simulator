import React, { useEffect } from 'react';

const ResetModal = ({ open, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box glass" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">⚠️</div>
        <h3 className="modal-title">Reset Simulation?</h3>
        <p className="modal-desc">
          Are you sure you want to reset the simulation? All current data, logs, and metrics will be cleared.
        </p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>
            ✕ Cancel
          </button>
          <button className="modal-btn modal-btn-confirm" onClick={onConfirm}>
            ✓ Yes, Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetModal;
