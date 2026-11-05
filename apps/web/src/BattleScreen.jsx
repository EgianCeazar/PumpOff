import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  LogOut,
  RotateCcw,
  Share2,
  SwitchCamera,
  Swords,
  Timer,
  VideoOff,
} from 'lucide-react';
import {
  BATTLE_PROTOCOL,
  COUNTDOWN_MS,
  EXERCISES,
  battleReducer,
  battleSecondsFor,
  canStart,
  createBattle,
  createTracker,
  makeRoomCode,
  makeSet,
  normalizeRoomCode,
  parseMessage,
} from '@pumpoff/core';
import { joinRoom, onlineAvailable, preferredTransport } from './battleLink.js';
import { createPeerVideo } from './peerVideo.js';
import { usePoseCamera } from './usePoseCamera.js';
import { formatHold } from './format.js';

const NAME_KEY = 'pumpoff.name';
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
const writeName = name => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not saved; the name is still used for this battle.
  }
};

// An invite link looks like …/PumpOff/#battle/ABC234.
export const battleCodeFromHash = () => {
  const match = window.location.hash.match(/^#battle\/([A-Za-z0-9-]+)/);
  return match ? normalizeRoomCode(match[1]) : null;
};

const newClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const isHold = exercise => EXERCISES[exercise]?.kind === 'hold';
const scoreText = (score, exercise) => (isHold(exercise) ? formatHold(score?.holdMs ?? 0) : String(score?.reps ?? 0));
const marginText = (margin, exercise) =>
  isHold(exercise) ? formatHold(margin) : `${margin} ${margin === 1 ? 'rep' : 'reps'}`;

export default function BattleScreen({ onSaveSet, visible = true }) {
  const [name, setName] = useState(readName);
  const [joinCode, setJoinCode] = useState(() => battleCodeFromHash() ?? '');
  const [joinError, setJoinError] = useState('');
  const [room, setRoom] = useState(null); // { code, transport }
  const [linkStatus, setLinkStatus] = useState('idle');
  const [battle, setBattle] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoState, setVideoState] = useState('new');
  const [countdown, setCountdown] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [savedNote, setSavedNote] = useState('');
  const [copied, setCopied] = useState(false);

  const clientIdRef = useRef(newClientId());
  const linkRef = useRef(null);
  const peerRef = useRef(null);
  const battleRef = useRef(battle);
  battleRef.current = battle;
  const trackerRef = useRef(null);
  const countingRef = useRef(false);
  const timersRef = useRef([]);
  const lastSentRef = useRef({ at: 0, key: '' });
  const setStartRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const onSaveSetRef = useRef(onSaveSet);
  onSaveSetRef.current = onSaveSet;

  const dispatch = useCallback(event => setBattle(prev => (prev ? battleReducer(prev, event) : prev)), []);
  const send = useCallback(message => linkRef.current?.send(message), []);

  /* ---------------------------- counting ---------------------------- */

  const onFrame = useCallback(
    (landmarks, now) => {
      if (!countingRef.current || !trackerRef.current) return;
      const snap = trackerRef.current.update(landmarks, now);
      setSnapshot(snap);
      const score = { reps: snap.reps, holdMs: snap.holdMs ?? 0, notCounted: snap.rejected.length };
      // Send live scores when they change, at most four times a second.
      const key = `${score.reps}|${Math.floor(score.holdMs / 1000)}|${score.notCounted}`;
      const at = Date.now();
      if (key !== lastSentRef.current.key && at - lastSentRef.current.at > 250) {
        lastSentRef.current = { at, key };
        dispatch({ type: 'local-score', ...score });
        send({ type: 'score', ...score });
      }
    },
    [dispatch, send],
  );

  const camera = usePoseCamera({ onFrame });
  const streamRef = useRef(camera.stream);
  streamRef.current = camera.stream;

  /* ---------------------------- video with the other player ---------------------------- */

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setRemoteStream(null);
    setVideoState('new');
  }, []);

  const ensurePeer = useCallback(() => {
    if (peerRef.current || !battleRef.current) return peerRef.current;
    peerRef.current = createPeerVideo({
      polite: battleRef.current.role === 'guest',
      sendSignal: data => linkRef.current?.signal(data),
      onRemoteStream: setRemoteStream,
      onState: setVideoState,
    });
    if (streamRef.current) peerRef.current.setLocalStream(streamRef.current);
    return peerRef.current;
  }, []);

  useEffect(() => {
    peerRef.current?.setLocalStream(camera.stream);
  }, [camera.stream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  /* ---------------------------- the room ---------------------------- */

  // Tells the other player who we are and where we stand.
  const introduce = useCallback(() => {
    const current = battleRef.current;
    if (!current) return;
    send({ type: 'hello', name: current.me.name, protocol: BATTLE_PROTOCOL });
    if (current.role === 'host') send({ type: 'format', ...current.format });
    send({ type: 'ready', ready: current.me.ready });
  }, [send]);

  useEffect(() => {
    if (!room) return undefined;
    const link = joinRoom({
      code: room.code,
      clientId: clientIdRef.current,
      transport: room.transport,
      onMessage: raw => dispatch({ type: 'remote', message: parseMessage(raw) }),
      onSignal: data => ensurePeer()?.handleSignal(data),
      onPeers: others => {
        if (others.length) {
          introduce();
          ensurePeer();
        } else {
          dispatch({ type: 'peer-gone' });
          closePeer();
        }
      },
      onStatus: setLinkStatus,
    });
    linkRef.current = link;
    return () => {
      link.send({ type: 'leave' });
      link.close();
      linkRef.current = null;
      closePeer();
    };
  }, [room, dispatch, ensurePeer, introduce, closePeer]);

  const enterRoom = (code, role) => {
    const trimmed = name.trim();
    writeName(trimmed);
    setBattle(createBattle({ role, name: trimmed || 'You', format: { exercise: 'squat', seconds: 60 } }));
    setRoom({ code, transport: preferredTransport() });
    setJoinError('');
  };

  const createRoom = () => enterRoom(makeRoomCode(), 'host');

  const join = event => {
    event.preventDefault();
    const code = normalizeRoomCode(joinCode);
    if (!code) {
      setJoinError('Room codes are 6 letters and numbers, like K7Q2MD.');
      return;
    }
    enterRoom(code, 'guest');
  };

  const leave = () => {
    clearTimers();
    countingRef.current = false;
    setRoom(null);
    setBattle(null);
    setLinkStatus('idle');
    setSnapshot(null);
    setCountdown(null);
    setSecondsLeft(null);
    if (window.location.hash.startsWith('#battle/')) window.location.hash = 'battle';
  };

  const inviteLink = room ? `${window.location.origin}${window.location.pathname}#battle/${room.code}` : '';

  const shareInvite = async () => {
    const text = `Battle me on PumpOff. Room code ${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PumpOff battle', text, url: inviteLink });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${inviteLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard blocked; the code is on screen.
    }
  };

  /* ---------------------------- lobby actions ---------------------------- */

  const setReady = ready => {
    dispatch({ type: 'local-ready', ready });
    send({ type: 'ready', ready });
  };

  const pickFormat = (exercise, seconds) => {
    const allowed = battleSecondsFor(exercise);
    const format = { exercise, seconds: allowed.includes(seconds) ? seconds : allowed[1] };
    dispatch({ type: 'local-format', ...format });
    send({ type: 'format', ...format });
  };

  const startBattle = () => {
    if (!battleRef.current || !canStart(battleRef.current)) return;
    dispatch({ type: 'local-start' });
    send({ type: 'start' });
  };

  const rematch = () => {
    dispatch({ type: 'rematch' });
    send({ type: 'rematch' });
  };

  // Turning the camera off means you're no longer ready.
  useEffect(() => {
    if (!camera.cameraOn && battle?.phase === 'lobby' && battle.me.ready) setReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.cameraOn, battle?.phase, battle?.me.ready]);

  /* ---------------------------- the clock ---------------------------- */

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }
  const later = (fn, ms) => timersRef.current.push(setTimeout(fn, ms));

  // Time's up here: report the final count and save the set.
  const finishMine = useCallback(() => {
    countingRef.current = false;
    const current = battleRef.current;
    const snap = trackerRef.current?.snapshot();
    if (!current || !snap) return;
    const score = { reps: snap.reps, holdMs: snap.holdMs ?? 0, notCounted: snap.rejected.length };
    dispatch({ type: 'local-final', ...score });
    send({ type: 'final', ...score });

    const hold = isHold(current.format.exercise);
    if ((hold && score.holdMs >= 1000) || (!hold && (score.reps || score.notCounted))) {
      const now = Date.now();
      const set = makeSet({
        exercise: current.format.exercise,
        reps: snap.reps,
        rejected: snap.rejected,
        holdMs: hold ? snap.holdMs : null,
        startedAt: setStartRef.current ?? now,
        endedAt: now,
        mode: 'timed',
        seconds: current.format.seconds,
      });
      onSaveSetRef.current?.(set);
      setSavedNote("Your set is saved to today's workout.");
    }
  }, [dispatch, send]);

  const phase = battle?.phase;
  useEffect(() => {
    if (!battle) return;
    if (phase === 'countdown') {
      clearTimers();
      trackerRef.current = createTracker(battle.format.exercise);
      countingRef.current = false;
      lastSentRef.current = { at: 0, key: '' };
      setSnapshot(null);
      setSavedNote('');
      setSecondsLeft(null);
      const steps = Math.round(COUNTDOWN_MS / 1000);
      setCountdown(steps);
      for (let i = 1; i < steps; i += 1) later(() => setCountdown(steps - i), i * 1000);
      later(() => {
        setCountdown(null);
        setStartRef.current = Date.now();
        countingRef.current = true;
        dispatch({ type: 'go', at: Date.now() });
        const seconds = battle.format.seconds;
        setSecondsLeft(seconds);
        for (let s = 1; s <= seconds; s += 1) later(() => setSecondsLeft(seconds - s), s * 1000);
        later(finishMine, seconds * 1000);
      }, COUNTDOWN_MS);
    } else if (phase === 'lobby' || phase === 'finished') {
      // A rematch, or the other player left mid-battle: stop the clock.
      if (phase === 'lobby' || battle.them?.left) {
        clearTimers();
        countingRef.current = false;
        setCountdown(null);
        setSecondsLeft(null);
      }
    }
    // Runs on phase changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  // Leaving the tab hands the camera back (phones only let one screen use
  // it), except mid-battle, where the clock is running.
  const midBattle = phase === 'countdown' || phase === 'active';
  useEffect(() => {
    if (!visible && !midBattle) camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, midBattle]);

  /* ---------------------------- view ---------------------------- */

  if (!room || !battle) {
    return (
      <main className="app battle">
        <header className="page-head">
          <h1>Battle</h1>
          <p className="sub">Race a friend over live video. Same exercise, same clock; each phone counts its own reps.</p>
        </header>

        {!onlineAvailable && (
          <p className="notice">
            Online battles aren't set up yet, so for now this connects two tabs in this browser only.
          </p>
        )}

        <section className="panel battle-start">
          <label className="field">
            <span>Your name</span>
            <input
              value={name}
              maxLength={24}
              autoComplete="nickname"
              placeholder="So your friend knows it's you"
              onChange={event => setName(event.target.value)}
            />
          </label>

          <button type="button" className="primary" onClick={createRoom}>
            <Swords aria-hidden="true" />
            Create a room
          </button>

          <form className="join-row" onSubmit={join}>
            <label className="field">
              <span>Or join with a code</span>
              <input
                value={joinCode}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="K7Q2MD"
                onChange={event => setJoinCode(event.target.value)}
              />
            </label>
            <button type="submit">Join</button>
          </form>
          {joinError && <p className="error">{joinError}</p>}
        </section>
      </main>
    );
  }

  const { me, them, format, result } = battle;
  const exercise = EXERCISES[format.exercise];
  const hold = exercise.kind === 'hold';
  const host = battle.role === 'host';
  const lobby = phase === 'lobby';
  const live = phase === 'countdown' || phase === 'active';
  const myScore = live && snapshot
    ? { reps: snapshot.reps, holdMs: snapshot.holdMs ?? 0 }
    : me.final ?? me.score;

  let statusLine = '';
  if (linkStatus === 'connecting') statusLine = 'Connecting…';
  else if (linkStatus === 'error') statusLine = "Can't reach the battle server. Check your connection.";
  else if (linkStatus === 'full') statusLine = 'That room already has two players.';
  else if (!them) statusLine = host ? 'Send your friend the code or link.' : 'Waiting for the room to open…';

  return (
    <main className="app battle">
      <header className="page-head battle-head">
        <div>
          <h1>Battle</h1>
          <p className="room-code">
            Room <strong>{room.code}</strong>
          </p>
        </div>
        <div className="head-actions">
          {host && lobby && (
            <button type="button" onClick={shareInvite}>
              {copied ? <Check aria-hidden="true" /> : navigator.share ? <Share2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Invite'}
            </button>
          )}
          <button type="button" onClick={leave}>
            <LogOut aria-hidden="true" />
            Leave
          </button>
        </div>
      </header>

      {room.transport === 'local' && (
        <p className="notice">Test mode: connects tabs in this browser only.</p>
      )}
      {statusLine && <p className="meta">{statusLine}</p>}

      <div className="battle-grid">
        <section className="battle-main">
          <div className="scoreboard" aria-live="polite">
            <div className="player me">
              <span className="player-name">{me.name}</span>
              <strong>{scoreText(myScore, format.exercise)}</strong>
              {lobby && <span className={`ready${me.ready ? ' yes' : ''}`}>{me.ready ? 'Ready' : 'Not ready'}</span>}
            </div>
            <div className="versus">
              {phase === 'countdown' && countdown !== null ? (
                <strong className="countdown">{countdown}</strong>
              ) : phase === 'active' && secondsLeft !== null ? (
                <span className="clock">
                  <Timer aria-hidden="true" />
                  {secondsLeft}s
                </span>
              ) : (
                <span>vs</span>
              )}
            </div>
            <div className="player them">
              <span className="player-name">{them ? them.name : 'Waiting…'}</span>
              <strong>{them ? scoreText(them.final ?? them.score, format.exercise) : '–'}</strong>
              {lobby && them && (
                <span className={`ready${them.ready ? ' yes' : ''}`}>{them.ready ? 'Ready' : 'Not ready'}</span>
              )}
            </div>
          </div>

          <div className={`stage battle-stage${phase === 'active' ? ' live' : ''}`}>
            <video ref={camera.videoRef} playsInline muted className={camera.facing === 'user' ? 'mirror' : ''} />
            <canvas ref={camera.canvasRef} className={camera.facing === 'user' ? 'mirror' : ''} />

            {/* During the battle your own count is huge, like the Workout screen: it's read from 2 m away. */}
            {phase === 'active' && (
              <div className="hud-count" aria-hidden="true">
                <strong key={hold ? 'hold' : myScore.reps}>{scoreText(myScore, format.exercise)}</strong>
                <span>you</span>
              </div>
            )}

            {them && (
              <div className="peer-video">
                {remoteStream ? (
                  <video ref={remoteVideoRef} playsInline muted autoPlay />
                ) : (
                  <span className="peer-empty">
                    <VideoOff aria-hidden="true" />
                    {videoState === 'failed' ? 'No video on this network' : 'Their camera is off'}
                  </span>
                )}
              </div>
            )}

            {phase === 'countdown' && countdown !== null && <div className="stage-countdown">{countdown}</div>}

            {!camera.cameraOn && (
              <div className="stage-empty">
                <Camera aria-hidden="true" />
                <span className="stage-empty-title">
                  {camera.modelState === 'loading' && 'Loading the pose model…'}
                  {camera.modelState === 'ready' && 'Start your camera to get ready.'}
                  {camera.modelState === 'failed' && 'The pose model could not load. Check your connection and reload.'}
                </span>
                <span className="stage-setup">
                  <strong>Setup:</strong> {exercise.setup}
                </span>
              </div>
            )}
          </div>

          {camera.error && <p className="error">{camera.error}</p>}

          <div className="controls">
            {!camera.cameraOn && (
              <button
                type="button"
                className="primary"
                onClick={() => camera.start()}
                disabled={camera.modelState !== 'ready'}
              >
                <Camera aria-hidden="true" />
                Start camera
              </button>
            )}
            {lobby && camera.cameraOn && host && (
              <button type="button" className="primary" onClick={startBattle} disabled={!canStart(battle)}>
                <Swords aria-hidden="true" />
                {canStart(battle) ? 'Start battle' : them ? 'Waiting for both to be ready' : 'Waiting for your friend'}
              </button>
            )}
            {lobby && camera.cameraOn && (
              <button type="button" className={host ? '' : 'primary'} onClick={() => setReady(!me.ready)}>
                <Check aria-hidden="true" />
                {me.ready ? "I'm not ready" : "I'm ready"}
              </button>
            )}
            {camera.cameraOn && (
              <button type="button" onClick={camera.switchCamera} disabled={live}>
                <SwitchCamera aria-hidden="true" />
                {camera.facing === 'user' ? 'Back camera' : 'Front camera'}
              </button>
            )}
            {camera.cameraOn && lobby && (
              <button type="button" onClick={camera.stop}>
                <CameraOff aria-hidden="true" />
                Stop camera
              </button>
            )}
          </div>
        </section>

        <aside className="battle-side">
          {lobby && (
            <section className="panel">
              <h2>{host ? 'Pick the battle' : 'The battle'}</h2>
              <div className="chips" role="group" aria-label="Exercise">
                {Object.values(EXERCISES).map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={item.key === format.exercise ? 'active' : ''}
                    aria-pressed={item.key === format.exercise}
                    disabled={!host}
                    onClick={() => pickFormat(item.key, format.seconds)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <div className="chips" role="group" aria-label="Length">
                {battleSecondsFor(format.exercise).map(seconds => (
                  <button
                    key={seconds}
                    type="button"
                    className={seconds === format.seconds ? 'active' : ''}
                    aria-pressed={seconds === format.seconds}
                    disabled={!host}
                    onClick={() => pickFormat(format.exercise, seconds)}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <p className="meta">
                {hold
                  ? `Longest plank in good form within ${format.seconds} seconds wins.`
                  : `Most counted ${exercise.name.toLowerCase()} in ${format.seconds} seconds wins. A tie goes to the cleaner set.`}
                {!host && ' The host picks.'}
              </p>
            </section>
          )}

          {phase === 'finished' && result && (
            <section className="panel battle-result">
              <h2>{resultHeadline(result, them, format.exercise)}</h2>
              <dl className="result-grid">
                <div>
                  <dt>{me.name}</dt>
                  <dd>{scoreText(me.final ?? me.score, format.exercise)}</dd>
                </div>
                <div>
                  <dt>{them?.name ?? 'Opponent'}</dt>
                  <dd>{scoreText(them?.final ?? them?.score, format.exercise)}</dd>
                </div>
              </dl>
              {(result.suspicious?.me || result.suspicious?.them) && (
                <p className="meta">
                  One score is faster than a person can move. Friend battles trust each phone's own count.
                </p>
              )}
              {savedNote && <p className="meta">{savedNote}</p>}
              <div className="controls">
                {!them?.left && (
                  <button type="button" className="primary" onClick={rematch}>
                    <RotateCcw aria-hidden="true" />
                    Rematch
                  </button>
                )}
                <button type="button" onClick={leave}>
                  <LogOut aria-hidden="true" />
                  Leave room
                </button>
              </div>
            </section>
          )}

          {me.final && !result && (
            <section className="panel">
              <h2>Time!</h2>
              <p className="sub">Waiting for {them?.name ?? 'your opponent'}'s final count…</p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function resultHeadline(result, them, exercise) {
  const other = them?.name ?? 'Your opponent';
  if (result.reason === 'forfeit') return `${other} left. You win.`;
  if (result.winner === 'draw') return "It's a draw.";
  if (result.reason === 'cleaner') {
    return result.winner === 'me' ? 'Tied, but your form was cleaner. You win.' : `Tied, but ${other}'s form was cleaner.`;
  }
  const by = marginText(result.margin, exercise);
  return result.winner === 'me' ? `You win by ${by}.` : `${other} wins by ${by}.`;
}
