// Synthetic bodies and sets for the tracker tests. Coordinates are
// image-normalized (0–1), with y growing downward like MediaPipe's.

export const FRAME_MS = 1000 / 30;

const NEAR = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

// A side-on body: the near side is clearly visible, the far side is
// hidden behind it (low visibility), as a real side-on camera sees it.
export function sideOnBody(points, side) {
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
  const joints = NEAR[side];
  for (const [name, [x, y]] of Object.entries(points)) {
    Object.assign(body[joints[name]], { x, y, visibility: 0.95 });
  }
  return body;
}

// Push-up (or high plank) seen from the side. `elbow` is the elbow angle
// in degrees; `sag` moves the hips below (+) or above (−) the
// shoulder–ankle line.
export function pushup(elbow, { sag = 0, side = 'left' } = {}) {
  const rad = (elbow * Math.PI) / 180;
  const shoulder = [0.35, 0.55];
  const elbowPos = [0.35, 0.67];
  const wrist = [elbowPos[0] + 0.12 * Math.sin(rad), elbowPos[1] - 0.12 * Math.cos(rad)];
  return sideOnBody(
    { shoulder, elbow: elbowPos, wrist, hip: [0.6, 0.57 + sag], ankle: [0.85, 0.6] },
    side,
  );
}

// Squat seen from the side. `knee` is the knee angle in degrees. Lunges
// look the same from the near leg's point of view: the knee bends and
// the hips drop.
export function squat(knee, { side = 'left' } = {}) {
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
export function setAngles({ top, bottom, count, repMs = 1200, holdMs = 400 }) {
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

export function framesFor(pose, angles, options, startT = 0) {
  return angles.map((angle, i) => ({ t: startT + i * FRAME_MS, landmarks: pose(angle, options) }));
}
