// PumpOff workout log.
// Plain data and pure functions for workouts, sets and progress stats.
// Storage lives in each app (browser storage on web, device storage on
// Android); this module only shapes and reads the data, so every app
// and a future sync server agree on it.

export const LOG_VERSION = 1;

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyLog() {
  return { version: LOG_VERSION, sessions: [], current: null };
}

/* ---------------------------- sessions and sets ---------------------------- */

export function createSession(now) {
  return { id: newId(), startedAt: now, endedAt: null, updatedAt: now, sets: [] };
}

/*
 * A set from a rep counter result.
 *   mode: 'free' (count until you stop) or 'timed' (fixed seconds)
 *   rejected: the counter's rejected attempts ({ reason } each)
 */
export function makeSet({ exercise, reps, rejected = [], startedAt, endedAt, mode = 'free', seconds = null }) {
  const notCountedReasons = {};
  for (const attempt of rejected) {
    notCountedReasons[attempt.reason] = (notCountedReasons[attempt.reason] ?? 0) + 1;
  }
  return {
    id: newId(),
    exercise,
    mode,
    seconds: mode === 'timed' ? seconds : null,
    reps,
    notCounted: rejected.length,
    notCountedReasons,
    startedAt,
    endedAt,
  };
}

export function addSet(session, set) {
  return { ...session, sets: [...session.sets, set], updatedAt: set.endedAt };
}

export function finishSession(session, now) {
  return { ...session, endedAt: now, updatedAt: now };
}

// Adds a finished set to the log, starting a workout if none is open.
export function logSet(log, set) {
  const current = log.current ?? createSession(set.startedAt);
  return { ...log, current: addSet(current, set) };
}

// Closes the open workout and moves it into history. A workout with no
// sets is dropped.
export function finishWorkout(log, now) {
  if (!log.current) return log;
  if (log.current.sets.length === 0) return { ...log, current: null };
  return {
    ...log,
    current: null,
    sessions: [finishSession(log.current, now), ...log.sessions],
  };
}

export function deleteSession(log, id) {
  return { ...log, sessions: log.sessions.filter(session => session.id !== id) };
}

export function sessionSummary(session) {
  const byExercise = {};
  let reps = 0;
  let notCounted = 0;
  for (const set of session.sets) {
    const entry = (byExercise[set.exercise] ??= { reps: 0, sets: 0, notCounted: 0 });
    entry.reps += set.reps;
    entry.sets += 1;
    entry.notCounted += set.notCounted;
    reps += set.reps;
    notCounted += set.notCounted;
  }
  const lastEnd = session.endedAt ?? session.sets.at(-1)?.endedAt ?? session.startedAt;
  return {
    reps,
    notCounted,
    sets: session.sets.length,
    byExercise,
    durationMs: lastEnd - session.startedAt,
    cleanRate: reps + notCounted ? reps / (reps + notCounted) : null,
  };
}

/* ---------------------------- progress ---------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight at the start of the local day for a timestamp.
export function dayStart(t) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Midnight at the start of the local week (Monday) for a timestamp.
export function weekStart(t) {
  const d = new Date(dayStart(t));
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
}

function allSets(log) {
  const sessions = log.current ? [log.current, ...log.sessions] : log.sessions;
  return sessions.flatMap(session => session.sets);
}

// Personal bests per exercise: the most reps in any set, and the most
// reps in each timed length (e.g. 60 seconds).
export function personalBests(log) {
  const result = {};
  for (const set of allSets(log)) {
    const entry = (result[set.exercise] ??= { anySet: null, timed: {} });
    if (set.reps > 0 && (!entry.anySet || set.reps > entry.anySet.reps)) {
      entry.anySet = { reps: set.reps, at: set.endedAt, setId: set.id };
    }
    if (set.mode === 'timed' && set.seconds) {
      const current = entry.timed[set.seconds];
      if (set.reps > 0 && (!current || set.reps > current.reps)) {
        entry.timed[set.seconds] = { reps: set.reps, at: set.endedAt, setId: set.id };
      }
    }
  }
  return result;
}

// Which personal bests a new set would beat, given the log before it.
// Used to celebrate a new best the moment a set is saved.
export function newBests(logBefore, set) {
  if (set.reps <= 0) return [];
  const bests = personalBests(logBefore)[set.exercise];
  const beaten = [];
  if (!bests?.anySet || set.reps > bests.anySet.reps) beaten.push('anySet');
  if (set.mode === 'timed' && set.seconds) {
    const timed = bests?.timed[set.seconds];
    if (!timed || set.reps > timed.reps) beaten.push(`timed${set.seconds}`);
  }
  return beaten;
}

// Reps per exercise for each of the last `weeks` weeks, oldest first.
export function weeklyReps(log, now, weeks = 8) {
  const thisWeek = weekStart(now);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * (weeks - 1 - i)).getTime();
  });
  const rows = starts.map(start => ({ weekStart: start, reps: {} }));
  for (const set of allSets(log)) {
    const index = starts.indexOf(weekStart(set.endedAt));
    if (index === -1) continue;
    const reps = rows.at(index).reps;
    reps[set.exercise] = (reps[set.exercise] ?? 0) + set.reps;
  }
  return rows;
}

// Days in a row with at least one set, counting back from today. A
// streak survives until the end of the day after the last workout.
export function streakDays(log, now) {
  const days = new Set(allSets(log).map(set => dayStart(set.endedAt)));
  let day = dayStart(now);
  if (!days.has(day)) day = dayStart(day - DAY_MS / 2);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = dayStart(day - DAY_MS / 2);
  }
  return streak;
}

// Share of rep attempts that counted, over the last `days` days. Shows
// whether form is improving.
export function cleanRepRate(log, now, days = 30) {
  const since = dayStart(now) - (days - 1) * DAY_MS;
  let reps = 0;
  let notCounted = 0;
  for (const set of allSets(log)) {
    if (set.endedAt < since) continue;
    reps += set.reps;
    notCounted += set.notCounted;
  }
  return reps + notCounted ? reps / (reps + notCounted) : null;
}

// The most common reasons reps didn't count, over the last `days` days.
export function topMistakes(log, now, days = 30, limit = 3) {
  const since = dayStart(now) - (days - 1) * DAY_MS;
  const counts = {};
  for (const set of allSets(log)) {
    if (set.endedAt < since) continue;
    for (const [reason, count] of Object.entries(set.notCountedReasons ?? {})) {
      counts[reason] = (counts[reason] ?? 0) + count;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason, count]) => ({ reason, count }));
}

/* ---------------------------- backup and sync ---------------------------- */

// Combines two logs (e.g. a backup file and this device) by workout id.
// When both have the same workout, the more recently updated one wins.
export function mergeLogs(a, b) {
  const byId = new Map();
  for (const session of [...a.sessions, ...b.sessions]) {
    const existing = byId.get(session.id);
    if (!existing || (session.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      byId.set(session.id, session);
    }
  }
  const sessions = [...byId.values()].sort((x, y) => y.startedAt - x.startedAt);
  return { version: LOG_VERSION, sessions, current: a.current ?? b.current ?? null };
}

// Reads a saved or imported log, accepting only the expected shape.
export function parseLog(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.sessions)) {
    throw new Error('Not a PumpOff workout log.');
  }
  if (data.version > LOG_VERSION) {
    throw new Error('This log is from a newer version of PumpOff.');
  }
  return { version: LOG_VERSION, sessions: data.sessions, current: data.current ?? null };
}
