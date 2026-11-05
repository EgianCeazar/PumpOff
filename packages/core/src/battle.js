// PumpOff 1v1 battles.
// The rules and messages of a battle as plain data and pure functions.
// The apps handle the connection (finding each other, video); this
// module decides what a message means, whether it's valid, what state
// the battle is in, and who won.

import { EXERCISES } from './repCounter.js';

export const BATTLE_PROTOCOL = 1;

// Lengths a battle can run, in seconds. Reps battles count the most reps
// in that time; a plank battle counts the most time held in good form.
export const BATTLE_SECONDS = [30, 60, 90];
export const PLANK_BATTLE_SECONDS = [60, 120, 180];
export const COUNTDOWN_MS = 3000;

// No real person does more than about 2 reps a second for a whole set.
const MAX_REPS_PER_SECOND = 2;

/* ---------------------------- room codes ---------------------------- */

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function makeRoomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Cleans up what someone typed: case, spaces and dashes don't matter.
export function normalizeRoomCode(text) {
  const code = String(text ?? '').toUpperCase().replace(/[\s-]/g, '');
  const valid = code.length === ROOM_CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c));
  return valid ? code : null;
}

/* ---------------------------- formats ---------------------------- */

export function battleSecondsFor(exercise) {
  return EXERCISES[exercise]?.kind === 'hold' ? PLANK_BATTLE_SECONDS : BATTLE_SECONDS;
}

export function isValidFormat({ exercise, seconds } = {}) {
  return Boolean(EXERCISES[exercise]) && battleSecondsFor(exercise).includes(seconds);
}

/* ---------------------------- messages ---------------------------- */

const clampInt = (value, min, max) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;

const cleanName = name =>
  String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 24) || 'Opponent';

/*
 * Messages come from the other player's device, so nothing in them is
 * trusted: each is checked and cleaned here, and anything unexpected is
 * dropped (null).
 *
 *   hello  { name, protocol }            introduce yourself
 *   format { exercise, seconds }         the host picks what to battle
 *   ready  { ready }                     ready or not
 *   start  {}                            the host starts the countdown
 *   score  { reps, holdMs, notCounted }  live count during the battle
 *   final  { reps, holdMs, notCounted }  the count when time is up
 *   rematch {}                           play again with the same format
 *   leave  {}                            leaving the room
 */
export function parseMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  switch (raw.type) {
    case 'hello':
      return { type: 'hello', name: cleanName(raw.name), protocol: clampInt(raw.protocol, 0, 1000) ?? 0 };
    case 'format': {
      const format = { exercise: String(raw.exercise), seconds: clampInt(raw.seconds, 0, 3600) };
      return isValidFormat(format) ? { type: 'format', ...format } : null;
    }
    case 'ready':
      return { type: 'ready', ready: raw.ready === true };
    case 'start':
      return { type: 'start' };
    case 'score':
    case 'final': {
      const reps = clampInt(raw.reps, 0, 10000);
      const holdMs = clampInt(raw.holdMs, 0, 3600000);
      const notCounted = clampInt(raw.notCounted, 0, 10000);
      if (reps === null || holdMs === null || notCounted === null) return null;
      return { type: raw.type, reps, holdMs, notCounted };
    }
    case 'rematch':
      return { type: 'rematch' };
    case 'leave':
      return { type: 'leave' };
    default:
      return null;
  }
}

/* ---------------------------- battle state ---------------------------- */

/*
 * One player's view of a battle.
 *   phase: 'lobby' → 'countdown' → 'active' → 'finished'
 * In the lobby both players see the format and mark themselves ready;
 * the host starts once both are. Each side counts its own reps and
 * sends live scores, then a final score when time is up.
 */
export function createBattle({ role, name, format = { exercise: 'squat', seconds: 60 } }) {
  return {
    role, // 'host' (made the room) or 'guest' (joined with the code)
    phase: 'lobby',
    format,
    me: { name: cleanName(name), ready: false, score: emptyScore(), final: null },
    them: null, // set when the other player says hello
    startedAt: null,
    result: null,
  };
}

const emptyScore = () => ({ reps: 0, holdMs: 0, notCounted: 0 });

export function canStart(battle) {
  return battle.role === 'host' && battle.phase === 'lobby' && battle.me.ready && Boolean(battle.them?.ready);
}

/*
 * Applies one event and returns the new battle. Events:
 *   { type: 'local-ready', ready }
 *   { type: 'local-format', exercise, seconds }   host only
 *   { type: 'local-start' }                       host only, when canStart
 *   { type: 'go', at }                            the countdown ended
 *   { type: 'local-score', reps, holdMs, notCounted }
 *   { type: 'time-up' }                           the clock ran out here
 *   { type: 'local-final', reps, holdMs, notCounted }
 *   { type: 'remote', message }                   a parsed message from the other player
 *   { type: 'peer-gone' }                         the other player disconnected
 *   { type: 'rematch' }                           after a battle, back to the lobby
 * A rematch message from the other player ({ type: 'rematch' }) does the same.
 */
export function battleReducer(battle, event) {
  switch (event.type) {
    case 'local-ready':
      if (battle.phase !== 'lobby') return battle;
      return { ...battle, me: { ...battle.me, ready: event.ready } };

    case 'local-format': {
      if (battle.role !== 'host' || battle.phase !== 'lobby') return battle;
      const format = { exercise: event.exercise, seconds: event.seconds };
      if (!isValidFormat(format)) return battle;
      // A new format means both players confirm again.
      return {
        ...battle,
        format,
        me: { ...battle.me, ready: false },
        them: battle.them && { ...battle.them, ready: false },
      };
    }

    case 'local-start':
      return canStart(battle) ? startCountdown(battle) : battle;

    case 'go':
      return battle.phase === 'countdown' ? { ...battle, phase: 'active', startedAt: event.at } : battle;

    case 'local-score':
      if (battle.phase !== 'active') return battle;
      return { ...battle, me: { ...battle.me, score: pickScore(event) } };

    case 'local-final':
      if (battle.phase !== 'active' && battle.phase !== 'finished') return battle;
      return settle({ ...battle, me: { ...battle.me, score: pickScore(event), final: pickScore(event) } });

    case 'rematch':
      // Back to the lobby with the same format; both confirm again.
      if (battle.phase !== 'finished' || !battle.them || battle.them.left) return battle;
      return {
        ...battle,
        phase: 'lobby',
        startedAt: null,
        result: null,
        me: { ...battle.me, ready: false, score: emptyScore(), final: null },
        them: { ...battle.them, ready: false, score: emptyScore(), final: null },
      };

    case 'peer-gone':
      if (!battle.them) return battle;
      if (battle.phase === 'lobby') return { ...battle, them: null };
      if (battle.phase === 'finished' && battle.result) return battle;
      // Leaving mid-battle forfeits it.
      return {
        ...battle,
        phase: 'finished',
        them: { ...battle.them, left: true },
        result: { winner: 'me', reason: 'forfeit', margin: null, suspicious: { me: false, them: false } },
      };

    case 'remote':
      return applyRemote(battle, event.message);

    default:
      return battle;
  }
}

function applyRemote(battle, message) {
  if (!message) return battle;
  switch (message.type) {
    case 'hello':
      return {
        ...battle,
        them: { name: message.name, ready: false, score: emptyScore(), final: null, ...battle.them, protocol: message.protocol },
      };
    case 'format':
      // Only the host picks the format.
      if (battle.role !== 'guest' || battle.phase !== 'lobby') return battle;
      return { ...battle, format: { exercise: message.exercise, seconds: message.seconds }, me: { ...battle.me, ready: false } };
    case 'ready':
      if (!battle.them || battle.phase !== 'lobby') return battle;
      return { ...battle, them: { ...battle.them, ready: message.ready } };
    case 'start':
      // The guest follows the host's start once both are ready.
      if (battle.role !== 'guest' || battle.phase !== 'lobby' || !battle.me.ready || !battle.them?.ready) return battle;
      return startCountdown(battle);
    case 'score':
      if (!battle.them || battle.phase !== 'active') return battle;
      return { ...battle, them: { ...battle.them, score: pickScore(message) } };
    case 'final':
      if (!battle.them || (battle.phase !== 'active' && battle.phase !== 'finished')) return battle;
      return settle({ ...battle, them: { ...battle.them, score: pickScore(message), final: pickScore(message) } });
    case 'rematch':
      return battleReducer(battle, { type: 'rematch' });
    case 'leave':
      return battleReducer(battle, { type: 'peer-gone' });
    default:
      return battle;
  }
}

function startCountdown(battle) {
  return {
    ...battle,
    phase: 'countdown',
    me: { ...battle.me, score: emptyScore(), final: null },
    them: { ...battle.them, score: emptyScore(), final: null },
    result: null,
  };
}

const pickScore = ({ reps = 0, holdMs = 0, notCounted = 0 }) => ({ reps, holdMs, notCounted });

// Once both final scores are in, the battle is decided.
function settle(battle) {
  if (!battle.me.final || !battle.them?.final) return battle;
  return {
    ...battle,
    phase: 'finished',
    result: decideWinner(battle.me.final, battle.them.final, battle.format),
  };
}

/*
 * Who won, from each player's final score.
 *   winner: 'me' | 'them' | 'draw'
 *   reason: 'score' (more reps or longer hold), 'cleaner' (tied, fewer
 *           reps not counted), 'tie'
 * A score faster than a person can move is flagged `suspicious` so the
 * result screen can say so; ranked play will check these on the server.
 */
export function decideWinner(me, them, { exercise, seconds }) {
  const hold = EXERCISES[exercise]?.kind === 'hold';
  const value = score => (hold ? score.holdMs : score.reps);
  const limit = MAX_REPS_PER_SECOND * seconds;
  const suspicious = {
    me: !hold && me.reps > limit,
    them: !hold && them.reps > limit,
  };

  const mine = value(me);
  const theirs = value(them);
  let winner = 'draw';
  let reason = 'tie';
  if (mine !== theirs) {
    winner = mine > theirs ? 'me' : 'them';
    reason = 'score';
  } else if (me.notCounted !== them.notCounted) {
    winner = me.notCounted < them.notCounted ? 'me' : 'them';
    reason = 'cleaner';
  }
  return { winner, reason, margin: Math.abs(mine - theirs), suspicious };
}
