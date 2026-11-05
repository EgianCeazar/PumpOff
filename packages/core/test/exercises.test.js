import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, createHoldTimer, createTracker, replay } from '../src/repCounter.js';
import { FRAME_MS, framesFor, pushup, setAngles, sideOnBody, squat } from './helpers.js';

/* ---------------------------- lunges ---------------------------- */

test('counts lunges', () => {
  const result = replay('lunge', framesFor(squat, setAngles({ top: 175, bottom: 95, count: 6 })));
  assert.equal(result.reps, 6);
});

test('rejects shallow lunges and says why', () => {
  const result = replay('lunge', framesFor(squat, setAngles({ top: 175, bottom: 125, count: 3 })));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected.length, 3);
  assert.equal(result.rejected[0].reason, EXERCISES.lunge.lowerCue);
});

test('a knee raise is not a lunge', () => {
  // Standing on one leg and lifting the other knee: the hips stay up.
  const kneeRaise = lift => {
    const rad = (lift * Math.PI) / 180;
    const hip = [0.52, 0.52];
    const knee = [hip[0] + 0.2 * Math.sin(rad), hip[1] + 0.2 * Math.cos(rad)];
    return sideOnBody({ shoulder: [0.52, 0.27], hip, knee, ankle: [knee[0], knee[1] + 0.18] }, 'left');
  };
  const result = replay('lunge', framesFor(kneeRaise, setAngles({ top: 0, bottom: 90, count: 3 })));
  assert.equal(result.reps, 0);
});

/* ---------------------------- sit-ups ---------------------------- */

// Lying side-on with knees bent and feet flat. `hipAngle` is the
// shoulder–hip–knee angle: about 140° lying back, about 60° sitting up.
function situp(hipAngle) {
  const hip = [0.5, 0.8];
  const knee = [0.63, 0.68];
  const thighAngle = Math.atan2(knee[1] - hip[1], knee[0] - hip[0]);
  const torsoAngle = thighAngle - (hipAngle * Math.PI) / 180;
  const shoulder = [hip[0] + 0.22 * Math.cos(torsoAngle), hip[1] + 0.22 * Math.sin(torsoAngle)];
  return sideOnBody({ shoulder, hip, knee, ankle: [0.75, 0.82] }, 'left');
}

test('counts sit-ups', () => {
  const result = replay('situp', framesFor(situp, setAngles({ top: 140, bottom: 60, count: 5, repMs: 1600 })));
  assert.equal(result.reps, 5);
  assert.equal(result.rejected.length, 0);
});

test('rejects half sit-ups and says why', () => {
  const result = replay('situp', framesFor(situp, setAngles({ top: 140, bottom: 95, count: 3, repMs: 1600 })));
  assert.equal(result.reps, 0);
  assert.equal(result.rejected[0].reason, EXERCISES.situp.lowerCue);
});

test('bending at the waist while standing is not a sit-up', () => {
  // A standing body folding forward: the hips are far above the feet.
  const standingBend = hipAngle => {
    const hip = [0.5, 0.5];
    const rad = (hipAngle * Math.PI) / 180;
    return sideOnBody(
      {
        shoulder: [hip[0] + 0.25 * Math.sin(rad), hip[1] - 0.25 * Math.cos(Math.PI - rad)],
        hip,
        knee: [0.5, 0.7],
        ankle: [0.5, 0.9],
      },
      'left',
    );
  };
  const result = replay('situp', framesFor(standingBend, setAngles({ top: 170, bottom: 60, count: 3, repMs: 1600 })));
  assert.equal(result.reps, 0);
  assert.equal(result.tracking, false);
});

/* ---------------------------- plank ---------------------------- */

// `sagFor(t)` returns the hip offset at time t: 0 is a straight line,
// positive sags, negative piks; null means nobody is in frame.
function plankFrames(seconds, sagFor = () => 0) {
  const count = Math.round((seconds * 1000) / FRAME_MS);
  return Array.from({ length: count }, (_, i) => {
    const t = i * FRAME_MS;
    const sag = sagFor(t);
    return { t, landmarks: sag === null ? null : pushup(172, { sag }) };
  });
}

const near = (actual, expected, tolerance = 150) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected about ${expected} ms, got ${actual} ms`);

test('times a steady plank, after a short settle', () => {
  const result = replay('plank', plankFrames(10));
  assert.equal(result.kind, 'hold');
  near(result.holdMs, 10000 - 300); // the start position settles for 0.3 s
  assert.equal(result.breaks.length, 0);
});

test('sagging hips pause the plank timer and say why', () => {
  const result = replay('plank', plankFrames(10, t => (t > 4000 && t < 6000 ? 0.08 : 0)));
  assert.equal(result.breaks.length, 1);
  assert.equal(result.breaks[0].reason, 'Hips are sagging. Lift them in line.');
  // About 2 s of sagging, plus the 0.3 s settle again, don't count.
  near(result.holdMs, 10000 - 300 - 2000 - 300, 250);
});

test('hips too high pause the plank with a different cue', () => {
  const result = replay('plank', plankFrames(6, t => (t > 3000 ? -0.1 : 0)));
  assert.equal(result.breaks.at(-1).reason, 'Hips are too high. Lower them in line.');
});

test('a brief wobble keeps the plank time', () => {
  const result = replay('plank', plankFrames(8, t => (t > 3000 && t < 3200 ? 0.08 : 0)));
  assert.equal(result.breaks.length, 0);
  near(result.holdMs, 8000 - 300);
});

test('leaving the frame pauses the plank', () => {
  const result = replay('plank', plankFrames(8, t => (t > 3000 && t < 5000 ? null : 0)));
  assert.equal(result.breaks[0].reason, 'Stay in frame. The timer paused.');
  assert.ok(result.holdMs < 6000);
});

test('standing up is not a plank', () => {
  const timer = createHoldTimer('plank');
  for (let i = 0; i < 90; i += 1) timer.update(squat(175), i * FRAME_MS);
  assert.equal(timer.snapshot().holdMs, 0);
  assert.equal(timer.snapshot().tracking, false);
});

test('createTracker picks a hold timer for plank and a counter otherwise', () => {
  assert.equal(createTracker('plank').snapshot().kind, 'hold');
  assert.equal(createTracker('squat').snapshot().reps, 0);
  assert.throws(() => createHoldTimer('squat'), /Not a hold exercise/);
});
