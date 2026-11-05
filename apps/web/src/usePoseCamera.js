import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision';
import { getSharedPoseLandmarker } from './poseModel.js';

/*
 * Camera + pose tracking for a screen: starts and stops the camera, runs
 * the pose model on each new video frame, draws the skeleton, and calls
 * `onFrame(landmarks, now)` so the screen can count.
 *
 * Returns refs for the <video> and <canvas>, the live camera stream (to
 * send to the other player), and controls.
 */
export function usePoseCamera({ onFrame }) {
  const [modelState, setModelState] = useState('loading'); // loading | ready | failed
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState('user');
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    let cancelled = false;
    getSharedPoseLandmarker()
      .then(model => {
        if (cancelled) return;
        modelRef.current = model;
        setModelState('ready');
      })
      .catch(err => {
        console.error('Could not load the pose model', err);
        if (!cancelled) setModelState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draw = useCallback(landmarks => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;
    const drawing = new DrawingUtils(ctx);
    // Same look as the workout screen: white limbs with a dark edge, joints in the button colour.
    const joint = getComputedStyle(document.documentElement).getPropertyValue('--act').trim() || '#c2421b';
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: 'rgba(0,0,0,0.45)', lineWidth: 7 });
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 4 });
    drawing.drawLandmarks(landmarks, { color: '#ffffff', fillColor: joint, lineWidth: 2, radius: 5 });
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const model = modelRef.current;
    if (video && model && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const now = performance.now();
      const landmarks = model.detectForVideo(video, now).landmarks?.[0] ?? null;
      draw(landmarks);
      onFrameRef.current?.(landmarks, now);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setCameraOn(false);
  }, []);

  const start = useCallback(
    async (facingMode = facing) => {
      setError('');
      stop();
      try {
        // Modest resolution: the same stream goes to the other player.
        const next = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = next;
        const video = videoRef.current;
        video.srcObject = next;
        await video.play();
        lastVideoTimeRef.current = -1;
        setStream(next);
        setCameraOn(true);
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error('Camera failed', err);
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
            : 'Could not start the camera. Close the Workout camera or any other app using it, then try again.',
        );
      }
    },
    [facing, loop, stop],
  );

  const switchCamera = useCallback(() => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    if (streamRef.current) start(next);
  }, [facing, start]);

  useEffect(() => stop, [stop]);

  return { videoRef, canvasRef, stream, cameraOn, modelState, facing, error, start, stop, switchCamera };
}
