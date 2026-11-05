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
  const result = replay('pushup', framesFor(pushup, setAngles({ top: 170, bottom: 90, count: 1, repMs: 300 })));
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

/* ---------------------------- not a squat ---------------------------- */

// Standing still and lifting one knee, seen from the side: the knee
// bends like a squat, but the hip stays up and the foot leaves the floor.
// `lift` is how far the thigh swings forward, in degrees from vertical.
function kneeRaise(lift, { side = 'left' } = {}) {
  const rad = (lift * Math.PI) / 180;
  const hip = [0.52, 0.52];
  const knee = [hip[0] + 0.2 * Math.sin(rad), hip[1] + 0.2 * Math.cos(rad)];
  const ankle = [knee[0], knee[1] + 0.18];
  return sideOnBody({ shoulder: [0.52, 0.27], hip, knee, ankle }, side);
}

test('knee raises do not count as squats', () => {
  // A thigh lift of 0 → 90 degrees takes the knee angle from 180 to 90.
  const lifts = setAngles({ top: 0, bottom: 90, count: 4 }).map(angle => angle);
  const result = replay('squat', framesFor(kneeRaise, lifts));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected.length, 4);
  assert.equal(result.rejected[0].reason, 'Keep both feet on the floor. Lifting a knee is not a squat.');
  assert.ok(result.rejected[0].reasons.includes('Sit your hips down, not just your knees.'));
});

test('squats still count after knee raises in the same set', () => {
  const raises = framesFor(kneeRaise, setAngles({ top: 0, bottom: 90, count: 2 }));
  const squats = framesFor(squat, setAngles({ top: 175, bottom: 85, count: 3 }), undefined, raises.at(-1).t + FRAME_MS);
  const result = replay('squat', [...raises, ...squats]);
  assert.equal(result.reps, 3);
});

/* ---------------------------- phantom bodies ---------------------------- */

// Small seeded random generator, so "random" tests repeat exactly.
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// What a pose model can output when nobody is in frame: it locks onto
// clutter and its "joints" wander smoothly around the image with high
// confidence. `step` sets how fast they wander.
function phantomFrames(count, seed, step) {
  const random = seeded(seed);
  const joints = Array.from({ length: 33 }, () => ({ x: random(), y: random(), vx: 0, vy: 0 }));
  const clamp01 = n => Math.min(1, Math.max(0, n));
  return Array.from({ length: count }, (_, i) => ({
    t: i * FRAME_MS,
    landmarks: joints.map(joint => {
      joint.vx = 0.85 * joint.vx + (random() - 0.5) * step;
      joint.vy = 0.85 * joint.vy + (random() - 0.5) * step;
      joint.x = clamp01(joint.x + joint.vx);
      joint.y = clamp01(joint.y + joint.vy);
      return { x: joint.x, y: joint.y, z: 0, visibility: 0.9 };
    }),
  }));
}

// Before the phantom checks, one minute of this added up to several
// fake squat reps.
test('a phantom body wandering around an empty frame never counts reps', () => {
  for (const exercise of ['squat', 'pushup']) {
    for (const step of [0.01, 0.02, 0.04]) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const result = replay(exercise, phantomFrames(1800, seed, step));
        assert.equal(result.reps, 0, `${exercise}, step ${step}, seed ${seed}`);
      }
    }
  }
});

test('a sudden tracking jump mid-rep cancels the rep without penalty', () => {
  const frames = framesFor(squat, setAngles({ top: 175, bottom: 85, count: 1 }));
  const middle = Math.floor(frames.length / 2);
  // One frame where the knee snaps straight, then back: a glitch.
  frames[middle - 8].landmarks = squat(175);
  const result = replay('squat', frames);
  assert.equal(result.reps, 0);
  assert.equal(result.rejected.length, 0);
});

test('the start position must be held before reps count', () => {
  // Only one frame at the top, then straight into a rep.
  const angles = [175, ...setAngles({ top: 175, bottom: 85, count: 1, holdMs: 0 })];
  const result = replay('squat', framesFor(squat, angles));
  assert.equal(result.reps, 0);
});

test('a body that is not upright is not tracked for squats', () => {
  const counter = createRepCounter('squat');
  const upsideDown = squat(175).map(point => ({ ...point, y: 1 - point.y }));
  assert.equal(counter.update(upsideDown, 0).tracking, false);
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
