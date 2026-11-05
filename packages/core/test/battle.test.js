import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_CODE_LENGTH,
  battleReducer,
  canStart,
  createBattle,
  decideWinner,
  makeRoomCode,
  normalizeRoomCode,
  parseMessage,
} from '../src/battle.js';

// Sends a message from one player to the other, the way the apps do:
// serialized, then parsed (and cleaned) on arrival.
const deliver = (to, message) =>
  battleReducer(to, { type: 'remote', message: parseMessage(JSON.parse(JSON.stringify(message))) });

// A host and a guest who have both said hello.
function pair(format) {
  let host = createBattle({ role: 'host', name: 'Ana', format });
  let guest = createBattle({ role: 'guest', name: 'Ben' });
  host = deliver(host, { type: 'hello', name: 'Ben', protocol: 1 });
  guest = deliver(guest, { type: 'hello', name: 'Ana', protocol: 1 });
  guest = deliver(guest, { type: 'format', ...host.format });
  return { host, guest };
}

// Both ready, host starts, guest follows, both go.
function startBoth({ host, guest }) {
  host = battleReducer(host, { type: 'local-ready', ready: true });
  guest = battleReducer(guest, { type: 'local-ready', ready: true });
  host = deliver(host, { type: 'ready', ready: true });
  guest = deliver(guest, { type: 'ready', ready: true });
  host = battleReducer(host, { type: 'local-start' });
  guest = deliver(guest, { type: 'start' });
  host = battleReducer(host, { type: 'go', at: 1000 });
  guest = battleReducer(guest, { type: 'go', at: 1000 });
  return { host, guest };
}

// Each side reports its own final score and sends it to the other.
function finish({ host, guest }, hostScore, guestScore) {
  host = battleReducer(host, { type: 'local-final', ...hostScore });
  guest = battleReducer(guest, { type: 'local-final', ...guestScore });
  host = deliver(host, { type: 'final', ...guestScore });
  guest = deliver(guest, { type: 'final', ...hostScore });
  return { host, guest };
}

/* ---------------------------- room codes ---------------------------- */

test('room codes are short and avoid look-alike characters', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = makeRoomCode();
    assert.equal(code.length, ROOM_CODE_LENGTH);
    assert.doesNotMatch(code, /[01IOL]/);
    assert.equal(normalizeRoomCode(code), code);
  }
});

test('typed room codes ignore case, spaces and dashes', () => {
  assert.equal(normalizeRoomCode(' abc-def '), 'ABCDEF');
  assert.equal(normalizeRoomCode('ABC'), null);
  assert.equal(normalizeRoomCode('ABCDE0'), null); // 0 is never used
});

/* ---------------------------- messages ---------------------------- */

test('messages from the other player are checked and cleaned', () => {
  assert.equal(parseMessage(null), null);
  assert.equal(parseMessage({ type: 'hack' }), null);
  assert.equal(parseMessage({ type: 'format', exercise: 'squat', seconds: 45 }), null);
  assert.equal(parseMessage({ type: 'format', exercise: 'dance', seconds: 60 }), null);
  assert.deepEqual(parseMessage({ type: 'format', exercise: 'plank', seconds: 120 }), {
    type: 'format',
    exercise: 'plank',
    seconds: 120,
  });
  assert.deepEqual(parseMessage({ type: 'score', reps: 12.6, holdMs: -5, notCounted: 2 }), {
    type: 'score',
    reps: 13,
    holdMs: 0,
    notCounted: 2,
  });
  assert.equal(parseMessage({ type: 'score', reps: 'lots', holdMs: 0, notCounted: 0 }), null);
  assert.equal(parseMessage({ type: 'hello', name: `${'x'.repeat(50)}\u0007` }).name.length, 24);
  assert.equal(parseMessage({ type: 'hello', name: '   ' }).name, 'Opponent');
  assert.deepEqual(parseMessage({ type: 'ready', ready: 'yes' }), { type: 'ready', ready: false });
});

/* ---------------------------- lobby ---------------------------- */

test('the host can only start once both players are ready', () => {
  let { host } = pair({ exercise: 'squat', seconds: 60 });
  assert.equal(canStart(host), false);
  host = battleReducer(host, { type: 'local-ready', ready: true });
  assert.equal(canStart(host), false);
  host = deliver(host, { type: 'ready', ready: true });
  assert.equal(canStart(host), true);
  assert.equal(battleReducer(host, { type: 'local-start' }).phase, 'countdown');
});

test('changing the format makes both players confirm again', () => {
  let { host, guest } = pair({ exercise: 'squat', seconds: 60 });
  host = battleReducer(host, { type: 'local-ready', ready: true });
  host = deliver(host, { type: 'ready', ready: true });
  host = battleReducer(host, { type: 'local-format', exercise: 'pushup', seconds: 30 });
  assert.deepEqual(host.format, { exercise: 'pushup', seconds: 30 });
  assert.equal(host.me.ready, false);
  assert.equal(host.them.ready, false);

  guest = battleReducer(guest, { type: 'local-ready', ready: true });
  guest = deliver(guest, { type: 'format', exercise: 'pushup', seconds: 30 });
  assert.equal(guest.me.ready, false);
});

test('only the host picks the format and starts', () => {
  let { host, guest } = pair({ exercise: 'squat', seconds: 60 });
  assert.equal(battleReducer(guest, { type: 'local-format', exercise: 'lunge', seconds: 30 }).format.exercise, 'squat');
  assert.equal(deliver(host, { type: 'format', exercise: 'lunge', seconds: 30 }).format.exercise, 'squat');
  // A start message before the guest is ready is ignored.
  assert.equal(deliver(guest, { type: 'start' }).phase, 'lobby');
});

/* ---------------------------- a whole battle ---------------------------- */

test('a full battle: live scores, then the higher count wins on both screens', () => {
  let players = startBoth(pair({ exercise: 'squat', seconds: 60 }));
  assert.equal(players.host.phase, 'active');
  assert.equal(players.guest.phase, 'active');

  players.guest = deliver(players.guest, { type: 'score', reps: 7, holdMs: 0, notCounted: 1 });
  assert.equal(players.guest.them.score.reps, 7);

  players = finish(players, { reps: 31, holdMs: 0, notCounted: 2 }, { reps: 27, holdMs: 0, notCounted: 0 });
  assert.equal(players.host.phase, 'finished');
  assert.deepEqual(players.host.result, { winner: 'me', reason: 'score', margin: 4, suspicious: { me: false, them: false } });
  assert.equal(players.guest.result.winner, 'them');
});

test('the battle waits for both final scores', () => {
  let { host } = startBoth(pair({ exercise: 'squat', seconds: 60 }));
  host = battleReducer(host, { type: 'local-final', reps: 20, holdMs: 0, notCounted: 0 });
  assert.equal(host.phase, 'active');
  assert.equal(host.result, null);
});

test('scores sent outside the battle are ignored', () => {
  const { host } = pair({ exercise: 'squat', seconds: 60 });
  assert.equal(deliver(host, { type: 'score', reps: 99, holdMs: 0, notCounted: 0 }).them.score.reps, 0);
});

test('leaving mid-battle forfeits; leaving the lobby just empties the seat', () => {
  const players = startBoth(pair({ exercise: 'squat', seconds: 60 }));
  const forfeited = deliver(players.host, { type: 'leave' });
  assert.equal(forfeited.phase, 'finished');
  assert.equal(forfeited.result.winner, 'me');
  assert.equal(forfeited.result.reason, 'forfeit');

  const { host } = pair({ exercise: 'squat', seconds: 60 });
  const empty = battleReducer(host, { type: 'peer-gone' });
  assert.equal(empty.phase, 'lobby');
  assert.equal(empty.them, null);
});

test('a rematch takes both players back to the lobby with the same format', () => {
  let players = startBoth(pair({ exercise: 'lunge', seconds: 30 }));
  players = finish(players, { reps: 12, holdMs: 0, notCounted: 0 }, { reps: 10, holdMs: 0, notCounted: 0 });
  const host = battleReducer(players.host, { type: 'rematch' });
  const guest = deliver(players.guest, { type: 'rematch' });
  for (const side of [host, guest]) {
    assert.equal(side.phase, 'lobby');
    assert.equal(side.result, null);
    assert.equal(side.me.ready, false);
    assert.equal(side.them.ready, false);
    assert.equal(side.me.score.reps, 0);
  }
  assert.deepEqual(host.format, { exercise: 'lunge', seconds: 30 });
  // No rematch with someone who left.
  const left = deliver(startBoth(pair()).host, { type: 'leave' });
  assert.equal(battleReducer(left, { type: 'rematch' }).phase, 'finished');
});

/* ---------------------------- deciding the winner ---------------------------- */

test('a tie goes to the cleaner set, otherwise it is a draw', () => {
  const format = { exercise: 'pushup', seconds: 60 };
  assert.equal(decideWinner({ reps: 20, holdMs: 0, notCounted: 1 }, { reps: 20, holdMs: 0, notCounted: 3 }, format).reason, 'cleaner');
  assert.equal(decideWinner({ reps: 20, holdMs: 0, notCounted: 3 }, { reps: 20, holdMs: 0, notCounted: 1 }, format).winner, 'them');
  assert.equal(decideWinner({ reps: 20, holdMs: 0, notCounted: 1 }, { reps: 20, holdMs: 0, notCounted: 1 }, format).winner, 'draw');
});

test('a plank battle is won on time held', () => {
  const result = decideWinner(
    { reps: 0, holdMs: 95000, notCounted: 0 },
    { reps: 0, holdMs: 101000, notCounted: 0 },
    { exercise: 'plank', seconds: 120 },
  );
  assert.equal(result.winner, 'them');
  assert.equal(result.margin, 6000);
});

test('impossibly fast scores are flagged', () => {
  const result = decideWinner(
    { reps: 30, holdMs: 0, notCounted: 0 },
    { reps: 400, holdMs: 0, notCounted: 0 },
    { exercise: 'squat', seconds: 60 },
  );
  assert.deepEqual(result.suspicious, { me: false, them: true });
});
