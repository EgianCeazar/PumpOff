// PumpOff rep counter.
// Turns MediaPipe pose landmarks into rep counts, form feedback and
// tracking state. No React or camera code here, so the same logic can
// run in the web app, the phone app, and on a server that checks
// ranked results.

const JOINT = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const SIDES = {
  left: {
    shoulder: JOINT.leftShoulder,
    elbow: JOINT.leftElbow,
    wrist: JOINT.leftWrist,
    hip: JOINT.leftHip,
    knee: JOINT.leftKnee,
    ankle: JOINT.leftAnkle,
  },
  right: {
    shoulder: JOINT.rightShoulder,
    elbow: JOINT.rightElbow,
    wrist: JOINT.rightWrist,
    hip: JOINT.rightHip,
    knee: JOINT.rightKnee,
    ankle: JOINT.rightAnkle,
  },
};

export function angleAt(a, b, c) {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

/*
 * Each exercise tracks one joint angle through a rep:
 *   top     - the angle at the start/end position (arms or legs straight)
 *   start   - dropping below this begins a rep attempt
 *   bottom  - the attempt must reach this angle or lower to count
 * The gap between `start` and `top` stops small wobbles near the top
 * from counting twice.
 */
export const EXERCISES = {
  pushup: {
    key: 'pushup',
    name: 'Push-ups',
    setup:
      'Put the camera on the floor, side-on, about 2 m away. Your whole body from head to feet should be in frame.',
    joints: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'],
    angle: (p, s) => angleAt(p[s.shoulder], p[s.elbow], p[s.wrist]),
    top: 150,
    start: 135,
    bottom: 100,
    lowerCue: 'Go lower: bend your elbows to about 90°.',
    form: (p, s) => {
      const bodyLine = angleAt(p[s.shoulder], p[s.hip], p[s.ankle]);
      return bodyLine < 150
        ? 'Keep your body straight from shoulders to ankles.'
        : null;
    },
  },
  squat: {
    key: 'squat',
    name: 'Squats',
    setup:
      'Put the camera at hip height, side-on, about 2–3 m away. Your whole body from head to feet should be in frame.',
    joints: ['shoulder', 'hip', 'knee', 'ankle'],
    angle: (p, s) => angleAt(p[s.hip], p[s.knee], p[s.ankle]),
    top: 160,
    start: 145,
    bottom: 100,
    lowerCue: 'Go lower: aim for thighs about parallel to the floor.',
    form: null,
  },
};

const DEFAULTS = {
  minVisibility: 0.5,
  // A real rep takes longer than this; anything faster is noise or a flail.
  minRepMs: 350,
  // Tracking gaps longer than this cancel a rep attempt in progress.
  maxGapMs: 1000,
  // Light smoothing so one noisy frame can't cross a threshold alone.
  smoothing: 0.5,
};

function sideVisibility(p, side, joints) {
  let total = 0;
  for (const name of joints) {
    total += p[side[name]]?.visibility ?? 0;
  }
  return total / joints.length;
}

// Pick the side of the body facing the camera. Side-on exercises hide
// the far arm and leg, so only the near side is used.
function pickSide(p, joints, minVisibility) {
  const left = sideVisibility(p, SIDES.left, joints);
  const right = sideVisibility(p, SIDES.right, joints);
  const best = left >= right ? 'left' : 'right';
  const visibility = Math.max(left, right);

  if (visibility < minVisibility) return null;

  const side = SIDES[best];
  const allPresent = joints.every(name => p[side[name]]);
  return allPresent ? { name: best, joints: side } : null;
}

export function createRepCounter(exerciseKey, options = {}) {
  const exercise = EXERCISES[exerciseKey];
  if (!exercise) {
    throw new Error(`Unknown exercise: ${exerciseKey}`);
  }

  const settings = { ...DEFAULTS, ...options };

  let reps = 0;
  let rejected = [];
  // waiting: not yet seen at the top position
  // top: ready for the next rep
  // down: a rep attempt is in progress
  let phase = 'waiting';
  let smoothed = null;
  let attempt = null;
  let lastSeen = null;
  let lastEvent = null;
  let tracking = false;
  let side = null;

  function snapshot() {
    return {
      exercise: exercise.key,
      reps,
      rejected: [...rejected],
      phase,
      angle: smoothed === null ? null : Math.round(smoothed),
      tracking,
      side,
      lastEvent,
    };
  }

  function reset() {
    reps = 0;
    rejected = [];
    phase = 'waiting';
    smoothed = null;
    attempt = null;
    lastSeen = null;
    lastEvent = null;
    tracking = false;
    side = null;
  }

  function finishAttempt(t) {
    const reasons = [];

    if (attempt.minAngle > exercise.bottom) {
      reasons.push(exercise.lowerCue);
    }
    if (t - attempt.startedAt < settings.minRepMs) {
      reasons.push('Too fast to count. Control the movement.');
    }
    reasons.push(...attempt.formIssues);

    if (reasons.length) {
      const event = { type: 'rejected', reason: reasons[0], reasons, t };
      rejected.push(event);
      lastEvent = event;
    } else {
      reps += 1;
      lastEvent = { type: 'rep', reps, t };
    }

    attempt = null;
  }

  function update(landmarks, t) {
    lastEvent = null;

    const picked = landmarks
      ? pickSide(landmarks, exercise.joints, settings.minVisibility)
      : null;

    if (!picked) {
      tracking = false;
      // A long gap mid-rep means we can't judge it fairly: drop it.
      if (
        phase === 'down' &&
        lastSeen !== null &&
        t - lastSeen > settings.maxGapMs
      ) {
        attempt = null;
        phase = 'waiting';
        smoothed = null;
      }
      return snapshot();
    }

    tracking = true;
    side = picked.name;
    lastSeen = t;

    const raw = exercise.angle(landmarks, picked.joints);
    smoothed =
      smoothed === null
        ? raw
        : smoothed + (raw - smoothed) * settings.smoothing;
    const value = smoothed;

    if (phase === 'waiting') {
      if (value >= exercise.top) phase = 'top';
      return snapshot();
    }

    if (phase === 'top') {
      if (value < exercise.start) {
        phase = 'down';
        attempt = { startedAt: t, minAngle: value, formIssues: [] };
      }
      return snapshot();
    }

    // phase === 'down'
    attempt.minAngle = Math.min(attempt.minAngle, value);

    const issue = exercise.form?.(landmarks, picked.joints);
    if (issue && !attempt.formIssues.includes(issue)) {
      attempt.formIssues.push(issue);
    }

    if (value >= exercise.top) {
      finishAttempt(t);
      phase = 'top';
    }

    return snapshot();
  }

  return { exercise, update, reset, snapshot };
}

/* ---------------------------- recordings ---------------------------- */

// Recordings store each frame as [t, [[x, y, z, visibility], ...]] with
// rounded numbers, so a one-minute set stays a small JSON file.
const round4 = n => Math.round(n * 10000) / 10000;

export function encodeFrame(t, landmarks) {
  return [
    Math.round(t),
    landmarks
      ? landmarks.map(point => [
          round4(point.x),
          round4(point.y),
          round4(point.z ?? 0),
          round4(point.visibility ?? 0),
        ])
      : null,
  ];
}

export function decodeFrame([t, points]) {
  return {
    t,
    landmarks: points
      ? points.map(([x, y, z, visibility]) => ({ x, y, z, visibility }))
      : null,
  };
}

// Replays recorded frames through a fresh counter and returns the final
// snapshot. Used by tests and to re-check uploaded results.
export function replay(exerciseKey, frames, options) {
  const counter = createRepCounter(exerciseKey, options);
  let result = counter.snapshot();

  for (const frame of frames) {
    const { t, landmarks } = Array.isArray(frame) ? decodeFrame(frame) : frame;
    result = counter.update(landmarks, t);
  }

  return result;
}
