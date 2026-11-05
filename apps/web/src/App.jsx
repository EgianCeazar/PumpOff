import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { finishWorkout, logSet, newBests, deleteSession } from '@pumpoff/core';
import RepCounterScreen from './RepCounterScreen.jsx';
import HistoryScreen from './HistoryScreen.jsx';
import ProgressScreen from './ProgressScreen.jsx';
import { CalendarDays, ChartColumn, Dumbbell, Swords } from 'lucide-react';
import AppearanceMenu from './AppearanceMenu.jsx';
import { loadLog, requestPersistentStorage, saveLog } from './logStore.js';

// Loaded only when the Battle tab is first opened: it brings the online
// connection code, which the solo workout doesn't need.
const BattleScreen = lazy(() => import('./BattleScreen.jsx'));

const TABS = [
  { key: 'workout', label: 'Workout', icon: Dumbbell },
  { key: 'battle', label: 'Battle', icon: Swords },
  { key: 'history', label: 'History', icon: CalendarDays },
  { key: 'progress', label: 'Progress', icon: ChartColumn },
];

// "#battle/K7Q2MD" (an invite link) opens the Battle tab.
const tabFromHash = () => {
  const key = window.location.hash.replace('#', '').split('/')[0];
  return TABS.some(tab => tab.key === key) ? key : 'workout';
};

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [log, setLog] = useState(loadLog);
  const [saveFailed, setSaveFailed] = useState(false);
  const [battleOpened, setBattleOpened] = useState(() => tabFromHash() === 'battle');
  useEffect(() => {
    if (tab === 'battle') setBattleOpened(true);
  }, [tab]);
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
      <header className="topbar">
        <span className="brand">PumpOff</span>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={tab === item.key ? 'active' : ''}
                aria-current={tab === item.key ? 'page' : undefined}
                onClick={() => go(item.key)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <AppearanceMenu />
      </header>

      {saveFailed && (
        <p className="banner">
          Your workouts can't be saved in this browser (private mode or storage blocked). They'll be lost when you close
          the page.
        </p>
      )}

      {/* The workout screen stays mounted so the camera and an unsaved set survive a tab switch. */}
      <div hidden={tab !== 'workout'}>
        <RepCounterScreen
          log={log}
          onSaveSet={handleSaveSet}
          onFinishWorkout={handleFinishWorkout}
          releaseCamera={tab === 'battle'}
        />
      </div>
      {/* Stays mounted once opened, so a battle survives a quick look at History. */}
      {battleOpened && (
        <div hidden={tab !== 'battle'}>
          <Suspense fallback={<main className="app"><p className="meta">Loading battles…</p></main>}>
            <BattleScreen onSaveSet={handleSaveSet} visible={tab === 'battle'} />
          </Suspense>
        </div>
      )}
      {tab === 'history' && <HistoryScreen log={log} onDeleteSession={handleDeleteSession} />}
      {tab === 'progress' && <ProgressScreen log={log} onReplaceLog={handleReplaceLog} />}
    </div>
  );
}
