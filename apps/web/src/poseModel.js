import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

// One model shared by screens that load it lazily (the battle screen),
// so opening it twice doesn't load the model twice. Never closed.
let shared = null;
export function getSharedPoseLandmarker() {
  shared ??= loadPoseLandmarker().catch(error => {
    shared = null;
    throw error;
  });
  return shared;
}

// Loads MediaPipe Pose Landmarker, trying the GPU first and falling
// back to the CPU on devices where WebGL setup fails.
export async function loadPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = delegate => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  try {
    return await PoseLandmarker.createFromOptions(vision, options('GPU'));
  } catch (error) {
    console.warn('Pose model GPU setup failed; using CPU.', error);
    return PoseLandmarker.createFromOptions(vision, options('CPU'));
  }
}
