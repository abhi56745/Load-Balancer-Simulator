import React, { useEffect, useMemo, useRef, useState } from 'react';

const normalizeGroups = (groups) => groups.map((group) => ({
  label: group.label,
  options: group.options.map((option) => ({
    ...option,
    stringValue: String(option.value),
  })),
}));

const ControlDropdown = ({
  groups,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select an option',
}) => {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const normalizedGroups = useMemo(() => normalizeGroups(groups), [groups]);
  const stringValue = String(value);

  const selectedOption = normalizedGroups
    .flatMap((group) => group.options)
    .find((option) => option.stringValue === stringValue);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`ctrl-dropdown ${open ? 'ctrl-dropdown-open' : ''}`}>
      <button
        type="button"
        className="ctrl-trigger"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className="ctrl-trigger-text">{selectedOption?.label || placeholder}</span>
        <span className="ctrl-caret">{open ? '^' : 'v'}</span>
      </button>

      {open && !disabled && (
        <div className="ctrl-menu glass">
          {normalizedGroups.map((group) => (
            <div key={group.label || 'default'} className="ctrl-menu-group">
              {group.label ? <div className="ctrl-menu-label">{group.label}</div> : null}
              {group.options.map((option) => {
                const isSelected = option.stringValue === stringValue;

                return (
                  <button
                    key={option.stringValue}
                    type="button"
                    className={`ctrl-option ${isSelected ? 'ctrl-option-active' : ''}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {isSelected ? <span className="ctrl-option-check">Active</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ControlDropdown;
