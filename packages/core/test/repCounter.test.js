import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXERCISES,
  angleAt,
  createRepCounter,
  decodeFrame,
  encodeFrame,
  replay,
} from '../src/repCounter.js';

/* ---------------------------- synthetic sets ---------------------------- */

const FRAME_MS = 1000 / 30;

const NEAR = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

// A side-on body: the near side is clearly visible, the far side is
// hidden behind it (low visibility), as a real side-on camera sees it.
function sideOnBody(points, side) {
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
  const joints = NEAR[side];
  for (const [name, [x, y]] of Object.entries(points)) {
    Object.assign(body[joints[name]], { x, y, visibility: 0.95 });
  }
  return body;
}

// Push-up seen from the side. `elbow` is the elbow angle in degrees;
// `sag` drops the hips below the shoulder-ankle line.
function pushup(elbow, { sag = 0, side = 'left' } = {}) {
  const rad = (elbow * Math.PI) / 180;
  const shoulder = [0.35, 0.55];
  const elbowPos = [0.35, 0.67];
  const wrist = [elbowPos[0] + 0.12 * Math.sin(rad), elbowPos[1] - 0.12 * Math.cos(rad)];
  return sideOnBody(
    { shoulder, elbow: elbowPos, wrist, hip: [0.6, 0.57 + sag], ankle: [0.85, 0.6] },
    side,
  );
}

// Squat seen from the side. `knee` is the knee angle in degrees.
function squat(knee, { side = 'left' } = {}) {
  const rad = (knee * Math.PI) / 180;
  const ankle = [0.5, 0.9];
  const kneePos = [0.52, 0.72];
  const hip = [kneePos[0] - 0.2 * Math.sin(rad), kneePos[1] + 0.2 * Math.cos(rad)];
  return sideOnBody(
    { shoulder: [hip[0], hip[1] - 0.25], hip, knee: kneePos, ankle },
    side,
  );
}

// Angles for a set: hold at the top, then `count` smooth reps from
// `top` down to `bottom` and back, each lasting `repMs`.
function setAngles({ top, bottom, count, repMs = 1200, holdMs = 400 }) {
  const angles = [];
  const hold = Math.round(holdMs / FRAME_MS);
  const perRep = Math.max(2, Math.round(repMs / FRAME_MS));
  for (let i = 0; i < hold; i += 1) angles.push(top);
  for (let r = 0; r < count; r += 1) {
    for (let i = 0; i < perRep; i += 1) {
      const phase = (i / perRep) * 2 * Math.PI;
      angles.push(bottom + ((top - bottom) * (1 + Math.cos(phase))) / 2);
    }
  }
  for (let i = 0; i < hold; i += 1) angles.push(top);
  return angles;
}

function framesFor(pose, angles, options, startT = 0) {
  return angles.map((angle, i) => ({ t: startT + i * FRAME_MS, landmarks: pose(angle, options) }));
}

/* ---------------------------- basics ---------------------------- */

test('angleAt measures the angle at the middle point', () => {
  const a = { x: 0, y: 1 };
  const b = { x: 0, y: 0 };
  assert.equal(Math.round(angleAt(a, b, { x: 1, y: 0 })), 90);
  assert.equal(Math.round(angleAt(a, b, { x: 0, y: -1 })), 180);
});

test('createRepCounter rejects unknown exercises', () => {
  assert.throws(() => createRepCounter('jumpingJacks'), /Unknown exercise/);
});

/* ---------------------------- counting ---------------------------- */

test('counts clean push-ups', () => {
  const result = replay('pushup', framesFor(pushup, setAngles({ top: 170, bottom: 80, count: 5 })));
  assert.equal(result.reps, 5);
  assert.equal(result.rejected.length, 0);
});

test('counts clean squats', () => {
  const result = replay('squat', framesFor(squat, setAngles({ top: 175, bottom: 85, count: 5 })));
  assert.equal(result.reps, 5);
  assert.equal(result.rejected.length, 0);
});

test('works with the right side facing the camera', () => {
  const frames = framesFor(pushup, setAngles({ top: 170, bottom: 80, count: 3 }), { side: 'right' });
  const result = replay('pushup', frames);
  assert.equal(result.reps, 3);
  assert.equal(result.side, 'right');
});

test('does not count a rep until the person starts from the top', () => {
  // Starts at the bottom and rises: that half rep must not count.
  const rising = Array.from({ length: 20 }, (_, i) => 80 + (90 * i) / 19);
  const reps = setAngles({ top: 170, bottom: 80, count: 2, holdMs: 0 });
  const result = replay('pushup', framesFor(pushup, [...rising, ...reps]));
  assert.equal(result.reps, 2);
});

/* ---------------------------- rejected reps ---------------------------- */

test('rejects reps that are not deep enough and says why', () => {
  const result = replay('pushup', framesFor(pushup, setAngles({ top: 170, bottom: 120, count: 4 })));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected.length, 4);
  assert.equal(result.rejected[0].reason, EXERCISES.pushup.lowerCue);
});

test('rejects reps that are too fast to be real', () => {
  const result = replay('pushup', framesFor(pushup, setAngles({ top: 170, bottom: 60, count: 1, repMs: 200 })));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].reasons.some(reason => reason.startsWith('Too fast')));
});

test('rejects push-ups with sagging hips', () => {
  const result = replay('pushup', framesFor(pushup, setAngles({ top: 170, bottom: 80, count: 2 }), { sag: 0.08 }));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected[0].reason, 'Keep your body straight from shoulders to ankles.');
});

test('small wobbles near the top never count', () => {
  const wobble = Array.from({ length: 90 }, (_, i) => 152 + 13 * Math.sin(i / 2));
  const result = replay('pushup', framesFor(pushup, wobble));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected.length, 0);
});

/* ---------------------------- tracking ---------------------------- */

test('a long tracking gap mid-rep cancels that rep without penalty', () => {
  const down = Array.from({ length: 15 }, (_, i) => 170 - (90 * i) / 14);
  const frames = framesFor(pushup, [170, 170, 170, ...down]);
  let t = frames.at(-1).t;
  for (let i = 0; i < 45; i += 1) {
    t += FRAME_MS;
    frames.push({ t, landmarks: null }); // 1.5 s with nobody tracked
  }
  const up = Array.from({ length: 15 }, (_, i) => 80 + (90 * i) / 14);
  frames.push(...framesFor(pushup, up, undefined, t + FRAME_MS));
  frames.push(...framesFor(pushup, setAngles({ top: 170, bottom: 80, count: 1 }), undefined, frames.at(-1).t + FRAME_MS));

  const result = replay('pushup', frames);
  assert.equal(result.reps, 1);
  assert.equal(result.rejected.length, 0);
});

test('a short tracking blip mid-rep does not break the rep', () => {
  const angles = setAngles({ top: 170, bottom: 80, count: 1 });
  const frames = framesFor(pushup, angles);
  const middle = Math.floor(frames.length / 2);
  for (let i = middle; i < middle + 5; i += 1) frames[i].landmarks = null;
  const result = replay('pushup', frames);
  assert.equal(result.reps, 1);
});

test('reports no tracking when the needed joints are hidden', () => {
  const counter = createRepCounter('pushup');
  const hidden = pushup(170).map(point => ({ ...point, visibility: 0.2 }));
  assert.equal(counter.update(hidden, 0).tracking, false);
  assert.equal(counter.update(pushup(170), 33).tracking, true);
});

/* ---------------------------- state and recordings ---------------------------- */

test('reset clears reps and rejected attempts', () => {
  const counter = createRepCounter('squat');
  for (const frame of framesFor(squat, setAngles({ top: 175, bottom: 85, count: 2 }))) {
    counter.update(frame.landmarks, frame.t);
  }
  assert.equal(counter.snapshot().reps, 2);
  counter.reset();
  const after = counter.snapshot();
  assert.equal(after.reps, 0);
  assert.equal(after.rejected.length, 0);
  assert.equal(after.phase, 'waiting');
});

test('encoded recordings replay to the same result', () => {
  const frames = framesFor(squat, setAngles({ top: 175, bottom: 85, count: 3 }));
  const encoded = frames.map(frame => encodeFrame(frame.t, frame.landmarks));
  encoded.splice(10, 0, encodeFrame(frames[10].t, null));

  const decoded = decodeFrame(encoded[0]);
  assert.equal(decoded.landmarks.length, 33);
  assert.ok(Math.abs(decoded.landmarks[25].x - frames[0].landmarks[25].x) < 0.0001);
  assert.equal(replay('squat', encoded).reps, 3);
});

/* ---------------------------- recorded real sets ---------------------------- */

// Real sets recorded with the web app's recorder. Each file states how
// many reps a person actually counted, so tuning can't silently break them.
const FIXTURES = join(import.meta.dirname, 'fixtures');
const recordings = existsSync(FIXTURES)
  ? readdirSync(FIXTURES).filter(name => name.endsWith('.json'))
  : [];

test('recorded sets match the hand-counted reps', { skip: recordings.length === 0 && 'no recordings yet' }, () => {
  for (const name of recordings) {
    const recording = JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
    assert.equal(typeof recording.expectedReps, 'number', `${name} needs expectedReps`);
    const result = replay(recording.exercise, recording.frames);
    assert.equal(result.reps, recording.expectedReps, `${name}: counted ${result.reps}, expected ${recording.expectedReps}`);
  }
});
