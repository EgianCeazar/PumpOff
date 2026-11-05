import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision';
import { EXERCISES, createRepCounter, encodeFrame } from '@pumpoff/core';
import { loadPoseLandmarker } from './poseModel.js';

const SET_SECONDS = 60;
const COUNTDOWN_SECONDS = 3;

const blankSnapshot = exercise => ({
  exercise,
  reps: 0,
  rejected: [],
  phase: 'waiting',
  angle: null,
  tracking: false,
  side: null,
  lastEvent: null,
});

export default function RepCounterScreen() {
  const [exercise, setExercise] = useState('pushup');
  const [modelState, setModelState] = useState('loading'); // loading | ready | failed
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState('user');
  const [snapshot, setSnapshot] = useState(() => blankSnapshot('pushup'));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // free: counting any time · countdown/active: timed set · done: set finished
  const [setPhase, setSetPhase] = useState('free');
  const [secondsLeft, setSecondsLeft] = useState(SET_SECONDS);
  const [setResult, setSetResult] = useState(null);

  const [recording, setRecording] = useState(false);
  const [recordingFile, setRecordingFile] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const counterRef = useRef(createRepCounter('pushup'));
  const rafRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const countingRef = useRef(true);
  const recordRef = useRef(null); // { startedAt, frames }
  const timersRef = useRef([]);

  /* ---------------------------- model ---------------------------- */

  useEffect(() => {
    let cancelled = false;
    loadPoseLandmarker()
      .then(model => {
        if (cancelled) {
          model.close();
          return;
        }
        landmarkerRef.current = model;
        setModelState('ready');
      })
      .catch(err => {
        console.error('Could not load the pose model', err);
        if (!cancelled) setModelState('failed');
      });
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  /* ---------------------------- frame loop ---------------------------- */

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
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#a3e635', lineWidth: 3 });
    drawing.drawLandmarks(landmarks, { color: '#f97316', radius: 3 });
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const model = landmarkerRef.current;

    if (video && model && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const now = performance.now();
      const result = model.detectForVideo(video, now);
      const landmarks = result.landmarks?.[0] ?? null;
      draw(landmarks);

      if (recordRef.current) {
        recordRef.current.frames.push(encodeFrame(now - recordRef.current.startedAt, landmarks));
      }

      if (countingRef.current) {
        const snap = counterRef.current.update(landmarks, now);
        setSnapshot(snap);
        if (snap.lastEvent?.type === 'rep') {
          setMessage(`Rep ${snap.lastEvent.reps}`);
        } else if (snap.lastEvent?.type === 'rejected') {
          setMessage(`Not counted: ${snap.lastEvent.reason}`);
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  /* ---------------------------- camera ---------------------------- */

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(
    async (facingMode = facing) => {
      setError('');
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        lastVideoTimeRef.current = -1;
        setCameraOn(true);
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error('Camera failed', err);
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
            : 'Could not start the camera. Check that no other app is using it.',
        );
      }
    },
    [facing, loop, stopCamera],
  );

  const switchCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    if (cameraOn) startCamera(next);
  };

  useEffect(
    () => () => {
      stopCamera();
      timersRef.current.forEach(clearTimeout);
    },
    [stopCamera],
  );

  /* ---------------------------- counting ---------------------------- */

  const resetCounter = useCallback(
    key => {
      counterRef.current = createRepCounter(key);
      setSnapshot(blankSnapshot(key));
      setMessage('');
    },
    [],
  );

  const chooseExercise = key => {
    if (setPhase === 'countdown' || setPhase === 'active') return;
    setExercise(key);
    setSetPhase('free');
    setSetResult(null);
    countingRef.current = true;
    resetCounter(key);
  };

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const startTimedSet = () => {
    clearTimers();
    resetCounter(exercise);
    setSetResult(null);
    countingRef.current = false;
    setSetPhase('countdown');
    setSecondsLeft(COUNTDOWN_SECONDS);

    // Countdown, then the timed set, one tick per second.
    for (let i = 1; i <= COUNTDOWN_SECONDS; i += 1) {
      timersRef.current.push(setTimeout(() => setSecondsLeft(COUNTDOWN_SECONDS - i), i * 1000));
    }
    timersRef.current.push(
      setTimeout(() => {
        countingRef.current = true;
        setSetPhase('active');
        setSecondsLeft(SET_SECONDS);
        setMessage('Go!');
      }, COUNTDOWN_SECONDS * 1000),
    );
    for (let i = 1; i <= SET_SECONDS; i += 1) {
      timersRef.current.push(
        setTimeout(() => setSecondsLeft(SET_SECONDS - i), (COUNTDOWN_SECONDS + i) * 1000),
      );
    }
    timersRef.current.push(
      setTimeout(() => {
        countingRef.current = false;
        const final = counterRef.current.snapshot();
        setSetPhase('done');
        setSetResult(final);
        setMessage('Time!');
      }, (COUNTDOWN_SECONDS + SET_SECONDS) * 1000),
    );
  };

  const endTimedSet = () => {
    clearTimers();
    countingRef.current = true;
    setSetPhase('free');
    resetCounter(exercise);
  };

  /* ---------------------------- recording ---------------------------- */

  const toggleRecording = () => {
    if (recording) {
      const record = recordRef.current;
      recordRef.current = null;
      setRecording(false);
      const payload = {
        exercise,
        recordedAt: new Date().toISOString(),
        countedReps: counterRef.current.snapshot().reps,
        // Fill in the reps you actually did before adding this file
        // to packages/core/test/fixtures.
        expectedReps: null,
        note: '',
        frames: record.frames,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (recordingFile) URL.revokeObjectURL(recordingFile.url);
      setRecordingFile({
        url: URL.createObjectURL(blob),
        name: `${exercise}-${payload.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`,
        frames: record.frames.length,
        sizeKb: Math.round(blob.size / 1024),
      });
    } else {
      recordRef.current = { startedAt: performance.now(), frames: [] };
      setRecording(true);
    }
  };

  /* ---------------------------- view ---------------------------- */

  const info = EXERCISES[exercise];
  const timedBusy = setPhase === 'countdown' || setPhase === 'active';
  const shown = setPhase === 'done' && setResult ? setResult : snapshot;

  return (
    <main className="app">
      <header>
        <p className="eyebrow">PumpOff · prototype</p>
        <h1>Rep Counter</h1>
        <p className="sub">Prop up your phone or laptop, pick an exercise, and let the camera count your reps.</p>
      </header>

      <section className="panel">
        <div className="segmented" role="group" aria-label="Exercise">
          {Object.values(EXERCISES).map(item => (
            <button
              key={item.key}
              type="button"
              className={item.key === exercise ? 'active' : ''}
              aria-pressed={item.key === exercise}
              disabled={timedBusy}
              onClick={() => chooseExercise(item.key)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <p className="setup"><strong>Setup:</strong> {info.setup}</p>

        <div className="stage">
          <video ref={videoRef} playsInline muted className={facing === 'user' ? 'mirror' : ''} />
          <canvas ref={canvasRef} className={facing === 'user' ? 'mirror' : ''} />

          <div className="hud-reps" aria-live="polite">
            <span>{info.name}</span>
            <strong>{shown.reps}</strong>
          </div>

          {cameraOn && (
            <div className={`hud-pill ${snapshot.tracking ? 'ok' : ''}`}>
              {snapshot.tracking
                ? `Tracking ${snapshot.side} side${snapshot.phase === 'waiting' ? ' · get into the start position' : ''}`
                : 'Step into frame'}
            </div>
          )}

          {timedBusy && (
            <div className="hud-timer">
              {setPhase === 'countdown' ? (secondsLeft > 0 ? secondsLeft : 'Go') : `${secondsLeft}s`}
            </div>
          )}

          {message && <div className="hud-message">{message}</div>}

          {!cameraOn && (
            <div className="stage-empty">
              {modelState === 'loading' && 'Loading the pose model…'}
              {modelState === 'ready' && 'Start the camera to begin.'}
              {modelState === 'failed' && 'The pose model could not load. Check your connection and reload.'}
            </div>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="controls">
          {cameraOn ? (
            <button type="button" className="secondary" onClick={stopCamera}>Stop camera</button>
          ) : (
            <button type="button" onClick={() => startCamera()} disabled={modelState !== 'ready'}>
              Start camera
            </button>
          )}
          <button type="button" className="secondary" onClick={switchCamera}>
            {facing === 'user' ? 'Use back camera' : 'Use front camera'}
          </button>
          {timedBusy ? (
            <button type="button" className="secondary" onClick={endTimedSet}>Stop set</button>
          ) : (
            <button type="button" onClick={startTimedSet} disabled={!cameraOn}>
              Start {SET_SECONDS}s set
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => chooseExercise(exercise)}
            disabled={timedBusy}
          >
            Reset count
          </button>
        </div>

        {snapshot.angle !== null && cameraOn && (
          <p className="meta">
            Angle {snapshot.angle}° · needs {info.bottom}° or lower, back to {info.top}°
          </p>
        )}
      </section>

      {setPhase === 'done' && setResult && (
        <section className="panel result">
          <h2>Set complete</h2>
          <div className="result-grid">
            <div><span>Reps counted</span><strong>{setResult.reps}</strong></div>
            <div><span>Not counted</span><strong>{setResult.rejected.length}</strong></div>
          </div>
          {setResult.rejected.length > 0 && (
            <ul className="reasons">
              {[...new Set(setResult.rejected.map(item => item.reason))].map(reason => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          <button type="button" onClick={startTimedSet}>Go again</button>
        </section>
      )}

      <section className="panel">
        <h2>Record a set for tuning</h2>
        <p className="sub">
          Records the body tracking (not video) while you do a set, so the counter can be tested against real reps.
          Count your reps yourself, then add that number to the file.
        </p>
        <div className="controls">
          <button
            type="button"
            className={recording ? 'danger' : 'secondary'}
            onClick={toggleRecording}
            disabled={!cameraOn && !recording}
          >
            {recording ? 'Stop recording' : 'Start recording'}
          </button>
          {recordingFile && !recording && (
            <a className="button-link" href={recordingFile.url} download={recordingFile.name}>
              Download {recordingFile.name} ({recordingFile.sizeKb} KB)
            </a>
          )}
        </div>
        {recording && <p className="meta">Recording… do your set, then stop.</p>}
      </section>

      <footer className="meta">Pose tracking runs on this device. No video is uploaded.</footer>
    </main>
  );
}
