import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision';
import { EXERCISES, createTracker, encodeFrame, makeSet, personalBests, sessionSummary } from '@pumpoff/core';
import {
  Camera,
  CameraOff,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleX,
  Download,
  Flag,
  Info,
  RotateCcw,
  Save,
  Square,
  SwitchCamera,
  Timer,
  Trophy,
} from 'lucide-react';
import { loadPoseLandmarker } from './poseModel.js';
import { describeMistakes, describeSet, formatDuration, formatHold, formatPercent } from './format.js';

const SET_SECONDS = 60;
const COUNTDOWN_SECONDS = 3;
// Rep ticks under the count show this many of the most recent attempts.
const MAX_TICKS = 30;
// A plank shorter than this isn't worth logging.
const MIN_HOLD_MS = 1000;

const isHold = key => EXERCISES[key]?.kind === 'hold';

const blankSnapshot = exercise => ({
  exercise,
  kind: isHold(exercise) ? 'hold' : 'reps',
  reps: 0,
  holdMs: 0,
  holding: false,
  issue: null,
  rejected: [],
  phase: 'waiting',
  angle: null,
  tracking: false,
  side: null,
  lastEvent: null,
});

const hasSomethingToSave = snap =>
  snap.kind === 'hold' ? snap.holdMs >= MIN_HOLD_MS : Boolean(snap.reps || snap.rejected.length);

const BEST_LABELS = { anySet: 'best set', timed60: 'best 60s set', longestHold: 'longest hold' };

function bestMessage(beaten) {
  if (!beaten?.length) return '';
  return `New personal ${beaten.map(key => BEST_LABELS[key] ?? 'best').join(' and ')}.`;
}

export default function RepCounterScreen({ log, onSaveSet, onFinishWorkout }) {
  const [exercise, setExercise] = useState('pushup');
  const [modelState, setModelState] = useState('loading'); // loading | ready | failed
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState('user');
  const [snapshot, setSnapshot] = useState(() => blankSnapshot('pushup'));
  const [message, setMessage] = useState(null); // { text, tone: 'ok' | 'warn' | 'info' }
  const [error, setError] = useState('');
  // One mark per rep attempt in this set, in order: 'ok' counted, 'no' not counted.
  const [marks, setMarks] = useState([]);
  // While the camera runs the exercise picker folds away; this opens it again.
  const [showPicker, setShowPicker] = useState(false);

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
  const counterRef = useRef(createTracker('pushup'));
  const rafRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const countingRef = useRef(true);
  const recordRef = useRef(null); // { startedAt, frames }
  const timersRef = useRef([]);
  // When the current set's first rep attempt began (wall clock).
  const setStartRef = useRef(null);
  const onSaveSetRef = useRef(onSaveSet);
  onSaveSetRef.current = onSaveSet;

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
    // White limbs with a dark edge read on any camera image; joints take the button colour.
    const joint = getComputedStyle(document.documentElement).getPropertyValue('--act').trim() || '#c2421b';
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: 'rgba(0,0,0,0.45)', lineWidth: 7 });
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 4 });
    drawing.drawLandmarks(landmarks, { color: '#ffffff', fillColor: joint, lineWidth: 2, radius: 5 });
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
        // A free set starts with its first rep attempt (about 1.5 s
        // before the first rep finishes).
        if (snap.lastEvent && setStartRef.current === null) {
          setStartRef.current = Date.now() - 1500;
        }
        const event = snap.lastEvent;
        if (event?.type === 'rep') {
          setMessage({ text: `Rep ${event.reps}`, tone: 'ok' });
          setMarks(prev => [...prev, 'ok']);
        } else if (event?.type === 'rejected') {
          setMessage({ text: `Not counted: ${event.reason}`, tone: 'warn' });
          setMarks(prev => [...prev, 'no']);
        }
        else if (event?.type === 'start') setMessage({ text: 'Holding. Keep it straight.', tone: 'ok' });
        else if (event?.type === 'resume') setMessage({ text: 'Back in position. Timer running.', tone: 'ok' });
        else if (event?.type === 'break') setMessage({ text: `Paused: ${event.reason}`, tone: 'warn' });
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

  // Keep the screen awake while the camera runs, so a propped-up phone
  // doesn't dim or lock mid-set. Browsers drop the lock when the tab is
  // hidden, so take it again when the page comes back.
  useEffect(() => {
    if (!cameraOn || !navigator.wakeLock) return undefined;
    let lock = null;
    let active = true;
    const take = async () => {
      try {
        if (active && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
      } catch {
        // Not allowed (battery saver, unsupported): the set still works, the screen may just dim.
      }
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', take);
      lock?.release().catch(() => {});
    };
  }, [cameraOn]);

  // The picker folds away again each time the camera starts.
  useEffect(() => {
    if (cameraOn) setShowPicker(false);
  }, [cameraOn]);

  /* ---------------------------- counting ---------------------------- */

  const resetCounter = useCallback(
    key => {
      counterRef.current = createTracker(key);
      setStartRef.current = null;
      setSnapshot(blankSnapshot(key));
      setMessage(null);
      setMarks([]);
    },
    [],
  );

  // Saves the counter's current set into the workout. Returns null when
  // there's nothing to save.
  const saveCurrentSet = (mode, seconds = null) => {
    const snap = counterRef.current.snapshot();
    if (!hasSomethingToSave(snap)) return null;
    const now = Date.now();
    const hold = snap.kind === 'hold';
    const set = makeSet({
      exercise: snap.exercise,
      reps: snap.reps,
      rejected: snap.rejected,
      holdMs: hold ? snap.holdMs : null,
      startedAt: setStartRef.current ?? now,
      endedAt: now,
      mode,
      seconds,
    });
    return { set, beaten: onSaveSetRef.current(set) };
  };

  const saveFreeSet = () => {
    const saved = saveCurrentSet('free');
    if (!saved) return;
    resetCounter(exercise);
    const best = bestMessage(saved.beaten);
    const what =
      saved.set.holdMs !== null
        ? `${formatHold(saved.set.holdMs)} plank`
        : `${saved.set.reps} ${EXERCISES[exercise].name.toLowerCase()}`;
    setMessage({ text: `Saved: ${what}${best ? ` · ${best}` : ''}`, tone: 'ok' });
  };

  const finishWorkout = () => {
    if (setPhase === 'countdown' || setPhase === 'active') return;
    saveCurrentSet('free');
    resetCounter(exercise);
    setSetPhase('free');
    setSetResult(null);
    onFinishWorkout();
    setMessage({ text: 'Workout saved. See it in History.', tone: 'ok' });
  };

  const chooseExercise = key => {
    if (setPhase === 'countdown' || setPhase === 'active') return;
    setExercise(key);
    setShowPicker(false);
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
        setStartRef.current = Date.now();
        setSetPhase('active');
        setSecondsLeft(SET_SECONDS);
        setMessage({ text: 'Go', tone: 'info' });
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
        const saved = saveCurrentSet('timed', SET_SECONDS);
        setSetPhase('done');
        setSetResult({ ...final, saved: Boolean(saved), beaten: saved?.beaten ?? [] });
        setMessage({ text: saved?.beaten.length ? bestMessage(saved.beaten) : 'Time. Set saved.', tone: 'ok' });
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
  const hold = info.kind === 'hold';
  const timedBusy = setPhase === 'countdown' || setPhase === 'active';
  const shown = setPhase === 'done' && setResult ? setResult : snapshot;

  let pill = 'Step into frame';
  if (snapshot.tracking && hold) {
    pill = snapshot.holding ? 'Holding' : snapshot.issue ?? 'Get into position';
  } else if (snapshot.tracking) {
    pill = `Tracking ${snapshot.side} side${snapshot.phase === 'waiting' ? ' · get into the start position' : ''}`;
  }

  const trackingOk = snapshot.tracking && (!hold || snapshot.holding);
  const MessageIcon = message?.tone === 'warn' ? CircleX : message?.tone === 'ok' ? CircleCheck : Info;

  return (
    <main className={`app workout${cameraOn ? ' focus' : ''}`}>
      <header className="page-head">
        <h1>Workout</h1>
        <p className="sub">Prop up your phone, pick an exercise, and let the camera count your reps.</p>
      </header>

      <div className="workout-grid">
        <section className="workout-main" aria-label="Rep counter">
          {cameraOn && (
            <div className="focus-bar">
              <strong>{info.name}</strong>
              <button
                type="button"
                className="link"
                aria-expanded={showPicker}
                aria-controls="exercise-picker"
                disabled={timedBusy}
                onClick={() => setShowPicker(value => !value)}
              >
                {showPicker ? 'Done' : 'Change exercise'}
                <ChevronDown className={`chev${showPicker ? ' open' : ''}`} aria-hidden="true" />
              </button>
            </div>
          )}
          <div
            id="exercise-picker"
            className="chips"
            role="group"
            aria-label="Exercise"
            hidden={cameraOn && !showPicker}
          >
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
          <div className="stage">
            <video ref={videoRef} playsInline muted className={facing === 'user' ? 'mirror' : ''} />
            <canvas ref={canvasRef} className={facing === 'user' ? 'mirror' : ''} />

            <div className="hud-count" aria-live="polite">
              {/* Keyed on the value so each new rep replays the short count-up animation. */}
              <strong key={hold ? 'hold' : shown.reps}>{hold ? formatHold(snapshot.holdMs) : shown.reps}</strong>
              <span>
                {info.name.toLowerCase()} {hold ? 'held' : 'counted'}
              </span>
              {!hold && marks.length > 0 && (
                <span className="ticks" aria-label={`${marks.filter(m => m === 'ok').length} counted, ${marks.filter(m => m === 'no').length} not counted`}>
                  {/* Keys are each attempt's position in the set, so only the newest tick animates in. */}
                  {marks.slice(-MAX_TICKS).map((mark, i) => (
                    <i key={Math.max(0, marks.length - MAX_TICKS) + i} className={mark} />
                  ))}
                </span>
              )}
            </div>

            {setPhase === 'countdown' && (
              <div className="countdown" aria-live="assertive">
                <span key={secondsLeft}>{secondsLeft > 0 ? secondsLeft : 'Go'}</span>
              </div>
            )}

            <div className="hud-side">
              {cameraOn && (
                <div className={`hud-pill${trackingOk ? ' ok' : ''}`}>
                  <span className="dot" aria-hidden="true" />
                  {pill}
                </div>
              )}
              {setPhase === 'active' && (
                <div className="hud-timer">
                  <Timer aria-hidden="true" />
                  {secondsLeft}s
                </div>
              )}
            </div>

            {message && (
              <div className={`hud-message ${message.tone}`} role="status">
                <MessageIcon aria-hidden="true" />
                <span>{message.text}</span>
              </div>
            )}

            {!cameraOn && (
              <div className="stage-empty">
                <Camera aria-hidden="true" />
                <span className="stage-empty-title">
                  {modelState === 'loading' && 'Loading the pose model…'}
                  {modelState === 'ready' && 'Start the camera to begin.'}
                  {modelState === 'failed' && 'The pose model could not load. Check your connection and reload.'}
                </span>
                <span className="stage-setup">
                  <strong>Setup:</strong> {info.setup}
                </span>
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <div className="controls">
            {!cameraOn && (
              <button type="button" className="primary" onClick={() => startCamera()} disabled={modelState !== 'ready'}>
                <Camera aria-hidden="true" />
                Start camera
              </button>
            )}
            {!timedBusy && (
              <button
                type="button"
                className={cameraOn ? 'primary' : ''}
                onClick={saveFreeSet}
                disabled={!hasSomethingToSave(snapshot)}
              >
                <Save aria-hidden="true" />
                {hold ? 'Save hold' : 'Save set'}
              </button>
            )}
            {timedBusy ? (
              <button type="button" onClick={endTimedSet}>
                <Square aria-hidden="true" />
                Stop set
              </button>
            ) : (
              !hold && (
                <button type="button" onClick={startTimedSet} disabled={!cameraOn}>
                  <Timer aria-hidden="true" />
                  Start {SET_SECONDS}s set
                </button>
              )
            )}
            <button type="button" onClick={() => chooseExercise(exercise)} disabled={timedBusy}>
              <RotateCcw aria-hidden="true" />
              {hold ? 'Reset timer' : 'Reset count'}
            </button>
            <button type="button" onClick={switchCamera}>
              <SwitchCamera aria-hidden="true" />
              {facing === 'user' ? 'Back camera' : 'Front camera'}
            </button>
            {cameraOn && (
              <button type="button" onClick={stopCamera}>
                <CameraOff aria-hidden="true" />
                Stop camera
              </button>
            )}
          </div>

          {cameraOn && (
            <p className="setup">
              <strong>Setup:</strong> {info.setup}
            </p>
          )}

          {!hold && snapshot.angle !== null && cameraOn && (
            <p className="meta">
              Angle {snapshot.angle}° · needs {info.bottom}° or lower, back to {info.top}°
            </p>
          )}
        </section>

        <div className="workout-side">
          {setPhase === 'done' && setResult && (
            <section className="panel result">
              <h2>Set complete</h2>
              {setResult.beaten?.length > 0 && (
                <p className="best-tag">
                  <Trophy aria-hidden="true" />
                  {bestMessage(setResult.beaten)}
                </p>
              )}
              {setResult.saved && <p className="meta">Saved to your workout.</p>}
              <dl className="result-grid">
                <div>
                  <dt>Reps counted</dt>
                  <dd>{setResult.reps}</dd>
                </div>
                <div>
                  <dt>Not counted</dt>
                  <dd>{setResult.rejected.length}</dd>
                </div>
              </dl>
              {setResult.rejected.length > 0 && (
                <ul className="reasons">
                  {[...new Set(setResult.rejected.map(item => item.reason))].map(reason => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <div className="controls">
                <button type="button" className="primary" onClick={startTimedSet}>
                  <Timer aria-hidden="true" />
                  Go again
                </button>
              </div>
            </section>
          )}

          {log.current ? (
            <CurrentWorkout log={log} session={log.current} onFinish={finishWorkout} busy={timedBusy} />
          ) : (
            <section className="panel quiet">
              <h2>Today's workout</h2>
              <p className="sub">Saved sets show up here. Finish the workout when you're done to move it to History.</p>
            </section>
          )}

          <details className="panel tuning">
            <summary>
              Record a set for tuning
              <ChevronDown className="chev" aria-hidden="true" />
            </summary>
            <p className="sub">
              Records the body tracking (not video) while you do a set, so the counter can be tested against real reps.
              Count your reps yourself, then add that number to the file.
            </p>
            <div className="controls">
              <button
                type="button"
                className={recording ? 'danger' : ''}
                onClick={toggleRecording}
                disabled={!cameraOn && !recording}
              >
                <Circle aria-hidden="true" />
                {recording ? 'Stop recording' : 'Start recording'}
              </button>
              {recordingFile && !recording && (
                <a className="button-link" href={recordingFile.url} download={recordingFile.name}>
                  <Download aria-hidden="true" />
                  Download {recordingFile.name} ({recordingFile.sizeKb} KB)
                </a>
              )}
            </div>
            {recording && <p className="meta">Recording… do your set, then stop.</p>}
          </details>

          <p className="meta privacy">Pose tracking runs on this device. No video is uploaded.</p>
        </div>
      </div>
    </main>
  );
}

// Which sets currently hold a personal best, as setId → labels.
function recordHolders(log) {
  const holders = new Map();
  const add = (record, label) => {
    if (!record?.setId) return;
    holders.set(record.setId, [...(holders.get(record.setId) ?? []), label]);
  };
  for (const entry of Object.values(personalBests(log))) {
    add(entry.anySet, 'Best set');
    add(entry.timed?.[SET_SECONDS], `Best ${SET_SECONDS}s set`);
    add(entry.longestHold, 'Longest hold');
  }
  return holders;
}

function CurrentWorkout({ log, session, onFinish, busy }) {
  const summary = sessionSummary(session);
  const records = recordHolders(log);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Today's workout</h2>
        <span className="meta">
          {summary.sets} {summary.sets === 1 ? 'set' : 'sets'} · {summary.reps} reps · {formatDuration(summary.durationMs)}
        </span>
      </div>
      <ol className="set-list">
        {session.sets.map(set => (
          <li key={set.id}>
            <span>
              {describeSet(set)}
              {records.has(set.id) && (
                <span className="best-tag small">
                  <Trophy aria-hidden="true" />
                  {records.get(set.id).join(' · ')}
                </span>
              )}
            </span>
            {set.notCounted > 0 && (
              <small>
                {set.notCounted} not counted: {describeMistakes(set.notCountedReasons)}
              </small>
            )}
          </li>
        ))}
      </ol>
      <p className="meta">Clean reps: {formatPercent(summary.cleanRate)}</p>
      <div className="controls">
        <button type="button" onClick={onFinish} disabled={busy}>
          <Flag aria-hidden="true" />
          Finish workout
        </button>
      </div>
    </section>
  );
}
