import { ChevronDown, Trash } from 'lucide-react';
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
        <header className="page-head">
          <h1>History</h1>
        </header>
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
      <header className="page-head">
        <h1>History</h1>
        <p className="sub">Saved on this device. Back it up from the Progress screen.</p>
      </header>
      <div className="history-list">
        {sessions.map(session => {
          const summary = sessionSummary(session);
          return (
            <section key={session.id} className="panel workout-card">
              <div className="panel-head">
                <h2>{formatDay(session.startedAt)}</h2>
                {session.inProgress ? (
                  <span className="tag">In progress</span>
                ) : (
                  <span className="meta">
                    {formatTime(session.startedAt)} · {formatDuration(summary.durationMs)}
                  </span>
                )}
              </div>
              <dl className="totals">
                {Object.entries(summary.byExercise).map(([key, entry]) => (
                  <div key={key}>
                    <dt>
                      {exerciseName(key)} · {entry.sets} {entry.sets === 1 ? 'set' : 'sets'}
                    </dt>
                    <dd>{entry.holdMs > 0 ? formatHold(entry.holdMs) : entry.reps}</dd>
                  </div>
                ))}
                <div>
                  <dt>Clean reps</dt>
                  <dd>{formatPercent(summary.cleanRate)}</dd>
                </div>
              </dl>
              <details>
                <summary>
                  Sets
                  <ChevronDown className="chev" aria-hidden="true" />
                </summary>
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
                    <Trash aria-hidden="true" />
                    Delete workout
                  </button>
                )}
              </details>
            </section>
          );
        })}
      </div>
    </main>
  );
}
