import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanRepRate,
  deleteSession,
  emptyLog,
  finishWorkout,
  logSet,
  makeSet,
  mergeLogs,
  newBests,
  parseLog,
  personalBests,
  sessionSummary,
  streakDays,
  topMistakes,
  weekStart,
  weeklyReps,
} from '../src/workoutLog.js';

// Local-time timestamps, so day and week boundaries match the device.
const at = (y, m, d, h = 18, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const MIN = 60 * 1000;

function set(exercise, reps, endedAt, extra = {}) {
  const rejected = (extra.rejected ?? []).map(reason => ({ reason }));
  return makeSet({ exercise, reps, rejected, startedAt: endedAt - MIN, endedAt, ...extra, rejected });
}

// A log with one finished workout per given day (each a list of sets).
function logWith(...workouts) {
  let log = emptyLog();
  for (const sets of workouts) {
    for (const item of sets) log = logSet(log, item);
    log = finishWorkout(log, sets.at(-1).endedAt + MIN);
  }
  return log;
}

/* ---------------------------- workouts ---------------------------- */

test('makeSet tallies why reps did not count', () => {
  const item = set('squat', 10, at(2026, 11, 5), { rejected: ['Go lower', 'Go lower', 'Too fast'] });
  assert.equal(item.reps, 10);
  assert.equal(item.notCounted, 3);
  assert.deepEqual(item.notCountedReasons, { 'Go lower': 2, 'Too fast': 1 });
  assert.equal(item.seconds, null);
});

test('saving a set starts a workout, and finishing moves it to history', () => {
  let log = emptyLog();
  log = logSet(log, set('squat', 12, at(2026, 11, 5, 18, 0)));
  log = logSet(log, set('pushup', 8, at(2026, 11, 5, 18, 5)));
  assert.equal(log.current.sets.length, 2);
  assert.equal(log.sessions.length, 0);

  log = finishWorkout(log, at(2026, 11, 5, 18, 10));
  assert.equal(log.current, null);
  assert.equal(log.sessions.length, 1);
  assert.equal(log.sessions[0].endedAt, at(2026, 11, 5, 18, 10));
});

test('finishing an empty workout keeps nothing', () => {
  const log = finishWorkout({ ...emptyLog(), current: { id: 'x', startedAt: 0, endedAt: null, sets: [] } }, 1);
  assert.equal(log.current, null);
  assert.equal(log.sessions.length, 0);
});

test('newest workouts come first and can be deleted', () => {
  const log = logWith([set('squat', 5, at(2026, 11, 1))], [set('squat', 7, at(2026, 11, 2))]);
  assert.equal(log.sessions[0].sets[0].reps, 7);
  assert.equal(deleteSession(log, log.sessions[0].id).sessions.length, 1);
});

test('sessionSummary totals reps per exercise and form quality', () => {
  const log = logWith([
    set('squat', 10, at(2026, 11, 5, 18, 0), { rejected: ['Go lower', 'Go lower'] }),
    set('squat', 8, at(2026, 11, 5, 18, 4)),
    set('pushup', 6, at(2026, 11, 5, 18, 8)),
  ]);
  const summary = sessionSummary(log.sessions[0]);
  assert.equal(summary.reps, 24);
  assert.equal(summary.sets, 3);
  assert.deepEqual(summary.byExercise.squat, { reps: 18, sets: 2, notCounted: 2 });
  assert.equal(summary.cleanRate, 24 / 26);
  assert.equal(summary.durationMs, 10 * MIN);
});

/* ---------------------------- personal bests ---------------------------- */

test('personal bests track the best set and the best timed set separately', () => {
  const log = logWith(
    [set('squat', 20, at(2026, 11, 1)), set('squat', 14, at(2026, 11, 1, 19), { mode: 'timed', seconds: 60 })],
    [set('squat', 16, at(2026, 11, 3), { mode: 'timed', seconds: 60 })],
  );
  const bests = personalBests(log).squat;
  assert.equal(bests.anySet.reps, 20);
  assert.equal(bests.timed[60].reps, 16);
});

test('newBests says which records a new set beats', () => {
  const log = logWith([set('squat', 15, at(2026, 11, 1), { mode: 'timed', seconds: 60 })]);
  assert.deepEqual(newBests(log, set('squat', 16, at(2026, 11, 2), { mode: 'timed', seconds: 60 })), ['anySet', 'timed60']);
  assert.deepEqual(newBests(log, set('squat', 15, at(2026, 11, 2), { mode: 'timed', seconds: 60 })), []);
  assert.deepEqual(newBests(log, set('pushup', 3, at(2026, 11, 2))), ['anySet']);
  assert.deepEqual(newBests(log, set('pushup', 0, at(2026, 11, 2))), []);
});

test('the open workout counts toward personal bests', () => {
  const log = logSet(emptyLog(), set('pushup', 9, at(2026, 11, 5)));
  assert.equal(personalBests(log).pushup.anySet.reps, 9);
});

/* ---------------------------- progress over time ---------------------------- */

test('weeks start on Monday', () => {
  // 2026-11-05 is a Thursday; its week starts Monday 2026-11-02.
  assert.equal(weekStart(at(2026, 11, 5)), at(2026, 11, 2, 0));
  assert.equal(weekStart(at(2026, 11, 2, 0, 1)), at(2026, 11, 2, 0));
  assert.equal(weekStart(at(2026, 11, 8, 23, 59)), at(2026, 11, 2, 0));
});

test('weeklyReps totals each exercise per week, oldest first', () => {
  const log = logWith(
    [set('squat', 10, at(2026, 10, 27))],
    [set('squat', 12, at(2026, 11, 3)), set('pushup', 5, at(2026, 11, 3, 19))],
    [set('squat', 8, at(2026, 11, 5))],
  );
  const weeks = weeklyReps(log, at(2026, 11, 5), 3);
  assert.equal(weeks.length, 3);
  assert.equal(weeks[0].weekStart, at(2026, 10, 19, 0));
  assert.deepEqual(weeks[1].reps, { squat: 10 });
  assert.deepEqual(weeks[2].reps, { squat: 20, pushup: 5 });
});

test('a streak counts days in a row and survives until the next day ends', () => {
  const log = logWith(
    [set('squat', 5, at(2026, 11, 2))],
    [set('squat', 5, at(2026, 11, 3))],
    [set('squat', 5, at(2026, 11, 4))],
  );
  assert.equal(streakDays(log, at(2026, 11, 4, 20)), 3);
  assert.equal(streakDays(log, at(2026, 11, 5, 9)), 3); // not yet broken
  assert.equal(streakDays(log, at(2026, 11, 6, 9)), 0); // missed a day
});

test('clean rep rate and top mistakes cover recent sets only', () => {
  const log = logWith(
    [set('squat', 0, at(2026, 9, 1), { rejected: ['Old mistake', 'Old mistake', 'Old mistake'] })],
    [set('squat', 9, at(2026, 11, 4), { rejected: ['Go lower'] })],
    [set('pushup', 6, at(2026, 11, 5), { rejected: ['Keep your body straight', 'Go lower', 'Go lower'] })],
  );
  assert.equal(cleanRepRate(log, at(2026, 11, 5)), 15 / 19);
  assert.deepEqual(topMistakes(log, at(2026, 11, 5)), [
    { reason: 'Go lower', count: 3 },
    { reason: 'Keep your body straight', count: 1 },
  ]);
  assert.equal(cleanRepRate(emptyLog(), at(2026, 11, 5)), null);
});

/* ---------------------------- backup ---------------------------- */

test('merging logs keeps every workout once, preferring the newer copy', () => {
  const base = logWith([set('squat', 5, at(2026, 11, 1))], [set('squat', 6, at(2026, 11, 2))]);
  const edited = {
    ...base,
    sessions: [{ ...base.sessions[0], sets: [], updatedAt: base.sessions[0].updatedAt + 1 }, base.sessions[1]],
  };
  const other = logWith([set('pushup', 4, at(2026, 11, 3))]);

  const merged = mergeLogs(edited, mergeLogs(base, other));
  assert.equal(merged.sessions.length, 3);
  assert.equal(merged.sessions.find(s => s.id === base.sessions[0].id).sets.length, 0);
  assert.ok(merged.sessions[0].startedAt >= merged.sessions[1].startedAt);
});

test('parseLog accepts PumpOff logs and rejects anything else', () => {
  const log = logWith([set('squat', 5, at(2026, 11, 1))]);
  assert.equal(parseLog(JSON.stringify(log)).sessions.length, 1);
  assert.throws(() => parseLog('{"hello": 1}'), /Not a PumpOff workout log/);
  assert.throws(() => parseLog(JSON.stringify({ ...log, version: 99 })), /newer version/);
});
