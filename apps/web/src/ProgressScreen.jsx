import { useRef, useState } from 'react';
import {
  EXERCISES,
  cleanRepRate,
  mergeLogs,
  parseLog,
  personalBests,
  streakDays,
  topMistakes,
  weekStart,
  weeklyReps,
} from '@pumpoff/core';
import WeeklyChart from './WeeklyChart.jsx';
import { formatHold, formatPercent, formatShortDate } from './format.js';

export default function ProgressScreen({ log, onReplaceLog }) {
  const [backupMessage, setBackupMessage] = useState('');
  const fileRef = useRef(null);
  const now = Date.now();

  const allSessions = log.current ? [log.current, ...log.sessions] : log.sessions;
  const hasSets = allSessions.some(session => session.sets.length);

  const thisWeek = weekStart(now);
  const weekSets = allSessions.flatMap(s => s.sets).filter(set => set.endedAt >= thisWeek);
  const workoutsThisWeek = allSessions.filter(s => s.sets.some(set => set.endedAt >= thisWeek)).length;
  const repsThisWeek = weekSets.reduce((sum, set) => sum + set.reps, 0);
  const bests = personalBests(log);
  const mistakes = topMistakes(log, now);

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pumpoff-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMessage('Backup downloaded.');
  };

  const importLog = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = parseLog(await file.text());
      const merged = mergeLogs(log, imported);
      const added = merged.sessions.length - log.sessions.length;
      onReplaceLog(merged);
      setBackupMessage(added > 0 ? `Restored ${added} workout${added === 1 ? '' : 's'}.` : 'Nothing new in that backup.');
    } catch (error) {
      setBackupMessage(error.message || 'That file could not be read.');
    }
  };

  return (
    <main className="app">
      <h1>Progress</h1>

      {!hasSets ? (
        <section className="panel empty">
          <p>Your progress shows up here once you save your first set.</p>
        </section>
      ) : (
        <>
          <section className="tiles">
            <div className="tile">
              <span>Streak</span>
              <strong>{streakDays(log, now)}</strong>
              <small>days in a row</small>
            </div>
            <div className="tile">
              <span>This week</span>
              <strong>{repsThisWeek}</strong>
              <small>
                reps · {workoutsThisWeek} {workoutsThisWeek === 1 ? 'workout' : 'workouts'}
              </small>
            </div>
            <div className="tile">
              <span>Clean reps</span>
              <strong>{formatPercent(cleanRepRate(log, now))}</strong>
              <small>counted, last 30 days</small>
            </div>
          </section>

          <section className="panel">
            <h2>Personal bests</h2>
            <div className="bests">
              {Object.values(EXERCISES).map(exercise => {
                const entry = bests[exercise.key];
                if (exercise.kind === 'hold') {
                  return (
                    <div key={exercise.key} className="best-card">
                      <h3>{exercise.name}</h3>
                      <dl>
                        <div>
                          <dt>Longest hold</dt>
                          <dd>
                            {entry?.longestHold ? (
                              <>
                                <strong>{formatHold(entry.longestHold.ms)}</strong>{' '}
                                <small>{formatShortDate(entry.longestHold.at)}</small>
                              </>
                            ) : (
                              '–'
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                }
                return (
                  <div key={exercise.key} className="best-card">
                    <h3>{exercise.name}</h3>
                    <dl>
                      <div>
                        <dt>Best set</dt>
                        <dd>
                          {entry?.anySet ? (
                            <>
                              <strong>{entry.anySet.reps}</strong> <small>{formatShortDate(entry.anySet.at)}</small>
                            </>
                          ) : (
                            '–'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Best 60s set</dt>
                        <dd>
                          {entry?.timed?.[60] ? (
                            <>
                              <strong>{entry.timed[60].reps}</strong> <small>{formatShortDate(entry.timed[60].at)}</small>
                            </>
                          ) : (
                            '–'
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2>Per week</h2>
            <WeeklyChart weeks={weeklyReps(log, now, 8)} />
          </section>

          <section className="panel">
            <h2>What to work on</h2>
            {mistakes.length ? (
              <>
                <p className="sub">Most common reasons reps didn't count in the last 30 days:</p>
                <ol className="mistakes">
                  {mistakes.map(item => (
                    <li key={item.reason}>
                      <span>{item.reason}</span>
                      <strong>×{item.count}</strong>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="sub">Every rep counted in the last 30 days. Clean form.</p>
            )}
          </section>
        </>
      )}

      <section className="panel">
        <h2>Backup</h2>
        <p className="sub">
          Workouts are saved in this browser only. Download a backup now and then, and restore it on a new phone or
          browser. Restoring adds workouts; it never deletes any.
        </p>
        <div className="controls">
          <button type="button" className="secondary" onClick={exportLog} disabled={!allSessions.length}>
            Download backup
          </button>
          <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
            Restore from backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importLog} />
        </div>
        {backupMessage && <p className="meta">{backupMessage}</p>}
      </section>
    </main>
  );
}
