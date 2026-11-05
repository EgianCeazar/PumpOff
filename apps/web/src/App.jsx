import { useCallback, useEffect, useRef, useState } from 'react';
import { finishWorkout, logSet, newBests, deleteSession } from '@pumpoff/core';
import RepCounterScreen from './RepCounterScreen.jsx';
import HistoryScreen from './HistoryScreen.jsx';
import ProgressScreen from './ProgressScreen.jsx';
import { loadLog, requestPersistentStorage, saveLog } from './logStore.js';

const TABS = [
  { key: 'workout', label: 'Workout' },
  { key: 'history', label: 'History' },
  { key: 'progress', label: 'Progress' },
];

const tabFromHash = () => {
  const key = window.location.hash.replace('#', '');
  return TABS.some(tab => tab.key === key) ? key : 'workout';
};

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [log, setLog] = useState(loadLog);
  const [saveFailed, setSaveFailed] = useState(false);
  const logRef = useRef(log);
  logRef.current = log;

  useEffect(() => {
    requestPersistentStorage();
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    setSaveFailed(!saveLog(log));
  }, [log]);

  // Returns which personal bests the set beats, for the celebration.
  const handleSaveSet = useCallback(set => {
    const beaten = newBests(logRef.current, set);
    setLog(prev => logSet(prev, set));
    return beaten;
  }, []);

  const handleFinishWorkout = useCallback(() => {
    setLog(prev => finishWorkout(prev, Date.now()));
  }, []);

  const handleDeleteSession = useCallback(id => {
    setLog(prev => deleteSession(prev, id));
  }, []);

  const handleReplaceLog = useCallback(next => setLog(next), []);

  const go = key => {
    window.location.hash = key;
    setTab(key);
  };

  return (
    <div className="shell">
      <nav className="tabs" aria-label="Sections">
        <span className="brand">PumpOff</span>
        {TABS.map(item => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'active' : ''}
            aria-current={tab === item.key ? 'page' : undefined}
            onClick={() => go(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {saveFailed && (
        <p className="banner">
          Your workouts can't be saved in this browser (private mode or storage blocked). They'll be lost when you close
          the page.
        </p>
      )}

      {/* The workout screen stays mounted so the camera and an unsaved set survive a tab switch. */}
      <div hidden={tab !== 'workout'}>
        <RepCounterScreen log={log} onSaveSet={handleSaveSet} onFinishWorkout={handleFinishWorkout} />
      </div>
      {tab === 'history' && <HistoryScreen log={log} onDeleteSession={handleDeleteSession} />}
      {tab === 'progress' && <ProgressScreen log={log} onReplaceLog={handleReplaceLog} />}
    </div>
  );
}
