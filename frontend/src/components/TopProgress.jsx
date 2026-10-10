import React, { useEffect, useRef, useState } from 'react';

// Requests in flight, shared with the api client (services/api.js). Listeners are told when the count changes.
let pending = 0;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn(pending));
export const progressStart = () => { pending += 1; notify(); };
export const progressDone = () => { pending = Math.max(0, pending - 1); notify(); };

/**
 * Thin bar along the top of the page while data loads (filters, refresh, page changes). It only appears
 * when loading takes longer than a moment, creeps towards the end while waiting, then completes and fades.
 */
export default function TopProgress() {
  const [state, setState] = useState({ visible: false, width: 0, done: false });
  const showTimer = useRef(null);
  const creepTimer = useRef(null);
  const hideTimer = useRef(null);

  useEffect(() => {
    const onChange = (count) => {
      if (count > 0) {
        clearTimeout(hideTimer.current);
        if (!showTimer.current && !creepTimer.current) {
          showTimer.current = setTimeout(() => {
            showTimer.current = null;
            setState({ visible: true, width: 20, done: false });
            creepTimer.current = setInterval(() => {
              setState(s => ({ ...s, width: s.width + (90 - s.width) * 0.12 }));
            }, 250);
          }, 220);
        }
      } else {
        clearTimeout(showTimer.current); showTimer.current = null;
        if (creepTimer.current) {
          clearInterval(creepTimer.current); creepTimer.current = null;
          setState(s => ({ ...s, width: 100, done: true }));
          hideTimer.current = setTimeout(() => setState({ visible: false, width: 0, done: false }), 350);
        }
      }
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      clearTimeout(showTimer.current); clearInterval(creepTimer.current); clearTimeout(hideTimer.current);
    };
  }, []);

  if (!state.visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5" role="progressbar" aria-label="Loading" aria-busy={!state.done}>
      <div
        className="h-full bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.6)] transition-[width,opacity] duration-slow ease-out"
        style={{ width: `${state.width}%`, opacity: state.done ? 0 : 1 }}
      />
    </div>
  );
}
