import { sessionSummary } from '@pumpoff/core';
import {
  describeMistakes,
  describeSet,
  exerciseName,
  formatDay,
  formatDuration,
  formatHold,
  formatPercent,
  formatTime,
} from './format.js';

export default function HistoryScreen({ log, onDeleteSession }) {
  const sessions = log.current ? [{ ...log.current, inProgress: true }, ...log.sessions] : log.sessions;

  if (!sessions.length) {
    return (
      <main className="app">
        <h1>History</h1>
        <section className="panel empty">
          <p>No workouts yet. Save a set on the Workout screen and it shows up here.</p>
        </section>
      </main>
    );
  }

  const remove = session => {
    if (window.confirm(`Delete the workout from ${formatDay(session.startedAt)}? This can't be undone.`)) {
      onDeleteSession(session.id);
    }
  };

  return (
    <main className="app">
      <h1>History</h1>
      <p className="sub">Saved on this device. Back it up from the Progress screen.</p>
      {sessions.map(session => {
        const summary = sessionSummary(session);
        return (
          <section key={session.id} className="panel workout-card">
            <div className="panel-head">
              <h2>
                {formatDay(session.startedAt)}
                {session.inProgress && <span className="tag">In progress</span>}
              </h2>
              <span className="meta">
                {formatTime(session.startedAt)} · {formatDuration(summary.durationMs)}
              </span>
            </div>
            <div className="totals">
              {Object.entries(summary.byExercise).map(([key, entry]) => (
                <div key={key}>
                  <strong>{entry.holdMs > 0 ? formatHold(entry.holdMs) : entry.reps}</strong>
                  <span>
                    {exerciseName(key)} · {entry.sets} {entry.sets === 1 ? 'set' : 'sets'}
                  </span>
                </div>
              ))}
              <div>
                <strong>{formatPercent(summary.cleanRate)}</strong>
                <span>Clean reps</span>
              </div>
            </div>
            <details>
              <summary>Sets</summary>
              <ol className="set-list">
                {session.sets.map(set => (
                  <li key={set.id}>
                    <span>{describeSet(set)}</span>
                    {set.notCounted > 0 && (
                      <small>
                        {set.notCounted} not counted: {describeMistakes(set.notCountedReasons)}
                      </small>
                    )}
                  </li>
                ))}
              </ol>
              {!session.inProgress && (
                <button type="button" className="link danger-text" onClick={() => remove(session)}>
                  Delete workout
                </button>
              )}
            </details>
          </section>
        );
      })}
    </main>
  );
}
