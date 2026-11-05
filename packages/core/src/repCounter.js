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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Two limb segments of one person are never wildly different lengths.
// A pose model "seeing" a body in the background often breaks this.
function inProportion(a, b) {
  const ratio = a / Math.max(b, 1e-6);
  return ratio > 0.4 && ratio < 2.5;
}

/*
 * Each exercise tracks one joint angle through a rep:
 *   top     - the angle at the start/end position (arms or legs straight)
 *   start   - dropping below this begins a rep attempt
 *   bottom  - the attempt must reach this angle or lower to count
 * The gap between `start` and `top` stops small wobbles near the top
 * from counting twice.
 *
 * Optional checks (p = landmarks, s = the near side's joint indices):
 *   plausible(p, s)            - does this look like a real body in this exercise?
 *   form(p, s, start)          - a problem seen during the rep, or null
 *   finish(start, deepest, s)  - a problem judged at the end of the rep, or null
 * `start` is the pose when the rep began, `deepest` the pose at its lowest angle.
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
    plausible: (p, s) => {
      const shoulder = p[s.shoulder];
      const elbow = p[s.elbow];
      const wrist = p[s.wrist];
      const ankle = p[s.ankle];
      const upperArm = distance(shoulder, elbow);
      // A push-up body runs roughly horizontally across the frame.
      const horizontal = Math.abs(shoulder.y - ankle.y) < Math.abs(shoulder.x - ankle.x);
      // Hands are on the floor, below the shoulders (image y grows
      // downward). A small allowance covers the bottom of a deep rep.
      // Pushing the arms out while standing or sitting fails this.
      const handsDown = wrist.y > shoulder.y - upperArm * 0.25;
      return (
        horizontal && handsDown && inProportion(upperArm, distance(elbow, wrist))
      );
    },
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
    plausible: (p, s) => {
      const shoulder = p[s.shoulder];
      const hip = p[s.hip];
      const knee = p[s.knee];
      const ankle = p[s.ankle];
      // Standing upright: shoulder above hip, hip and knee above the
      // ankle. Image y grows downward.
      const upright = shoulder.y < hip.y && hip.y < ankle.y && knee.y < ankle.y;
      return upright && inProportion(distance(hip, knee), distance(knee, ankle));
    },
    form: (p, s, start) => {
      // Lifting a foot (a knee raise or march) bends the knee like a
      // squat does, but the ankle leaves the floor.
      const shin = distance(start[s.knee], start[s.ankle]);
      return start[s.ankle].y - p[s.ankle].y > shin * 0.35
        ? 'Keep both feet on the floor. Lifting a knee is not a squat.'
        : null;
    },
    finish: (start, deepest, s) => {
      // In a squat the hips sink; bending one knee leaves them up.
      const leg =
        distance(start[s.hip], start[s.knee]) + distance(start[s.knee], start[s.ankle]);
      return deepest[s.hip].y - start[s.hip].y < leg * 0.2
        ? 'Sit your hips down, not just your knees.'
        : null;
    },
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
  // The start position must hold this long before reps count, so a
  // brief phantom body can't start counting.
  armMs: 300,
  // Joint angles changing faster than a body can move mean the tracking
  // jumped (degrees per millisecond; 1.0 = 33° between two video frames).
  maxDegPerMs: 1.0,
};

function sideVisibility(p, side, joints) {
  let total = 0;
  for (const name of joints) {
    total += p[side[name]]?.visibility ?? 0;
  }
  return total / joints.length;
}

// The pose model guesses joints it can't see, often outside the image.
// A guessed joint can't be trusted, so each needed joint must be clearly
// visible and inside the frame on its own; an average would let a clear
// upper body hide guessed hips and feet.
function jointUsable(point, minVisibility) {
  return (
    point !== undefined &&
    (point.visibility ?? 0) >= minVisibility &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

// Pick the side of the body facing the camera. Side-on exercises hide
// the far arm and leg, so only the near side is used. Returns null when
// neither side is fully visible or the body doesn't look real.
function pickSide(p, exercise, minVisibility) {
  const { joints } = exercise;
  const order =
    sideVisibility(p, SIDES.left, joints) >= sideVisibility(p, SIDES.right, joints)
      ? ['left', 'right']
      : ['right', 'left'];

  for (const name of order) {
    const side = SIDES[name];
    const usable = joints.every(joint => jointUsable(p[side[joint]], minVisibility));
    if (usable && (!exercise.plausible || exercise.plausible(p, side))) {
      return { name, joints: side };
    }
  }
  return null;
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
  let armedSince = null;
  let lastRaw = null;
  let lastRawAt = null;

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
    armedSince = null;
    lastRaw = null;
    lastRawAt = null;
  }

  // Back to waiting for a steady start position, dropping any rep in
  // progress without counting or rejecting it.
  function disarm() {
    attempt = null;
    phase = 'waiting';
    smoothed = null;
    armedSince = null;
  }

  function finishAttempt(t, joints) {
    const reasons = [];

    if (attempt.minAngle > exercise.bottom) {
      reasons.push(exercise.lowerCue);
    }
    if (t - attempt.startedAt < settings.minRepMs) {
      reasons.push('Too fast to count. Control the movement.');
    }
    reasons.push(...attempt.formIssues);

    const finishIssue = exercise.finish?.(attempt.start, attempt.deepest, joints);
    if (finishIssue && !reasons.includes(finishIssue)) {
      reasons.push(finishIssue);
    }

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
      ? pickSide(landmarks, exercise, settings.minVisibility)
      : null;

    if (!picked) {
      tracking = false;
      armedSince = null;
      // A long gap mid-rep means we can't judge it fairly: drop it.
      if (
        phase === 'down' &&
        lastSeen !== null &&
        t - lastSeen > settings.maxGapMs
      ) {
        disarm();
      }
      return snapshot();
    }

    tracking = true;
    side = picked.name;
    lastSeen = t;

    const raw = exercise.angle(landmarks, picked.joints);

    // A joint angle jumping faster than a body can move means the
    // tracking glitched. Throw away whatever was in progress.
    const jumped =
      lastRaw !== null &&
      t > lastRawAt &&
      Math.abs(raw - lastRaw) / (t - lastRawAt) > settings.maxDegPerMs;
    lastRaw = raw;
    lastRawAt = t;
    if (jumped) {
      disarm();
      return snapshot();
    }

    smoothed =
      smoothed === null
        ? raw
        : smoothed + (raw - smoothed) * settings.smoothing;
    const value = smoothed;

    if (phase === 'waiting') {
      // Reps only count after holding the start position briefly.
      if (value >= exercise.top) {
        armedSince ??= t;
        if (t - armedSince >= settings.armMs) phase = 'top';
      } else {
        armedSince = null;
      }
      return snapshot();
    }

    if (phase === 'top') {
      if (value < exercise.start) {
        phase = 'down';
        attempt = {
          startedAt: t,
          minAngle: value,
          formIssues: [],
          start: landmarks,
          deepest: landmarks,
        };
      }
      return snapshot();
    }

    // phase === 'down'
    if (value < attempt.minAngle) {
      attempt.minAngle = value;
      attempt.deepest = landmarks;
    }

    const issue = exercise.form?.(landmarks, picked.joints, attempt.start);
    if (issue && !attempt.formIssues.includes(issue)) {
      attempt.formIssues.push(issue);
    }

    if (value >= exercise.top) {
      finishAttempt(t, picked.joints);
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
