import { createClient } from '@supabase/supabase-js';

// How two players' devices find each other and pass messages.
//
// Online: a Supabase Realtime channel per room code (free tier). Its
// broadcast carries battle messages and video-call setup; its presence
// shows who is in the room. Only the project URL and the public anon
// key are used here; both are meant to ship in the browser.
//
// Local: a BroadcastChannel between tabs of this browser, for testing
// a battle on one computer without any server.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const onlineAvailable = Boolean(SUPABASE_URL && SUPABASE_KEY);

// `?local` in the address forces local mode, for testing in two tabs.
export function preferredTransport() {
  const forceLocal = new URLSearchParams(window.location.search).has('local');
  return onlineAvailable && !forceLocal ? 'online' : 'local';
}

let client = null;
function supabase() {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  return client;
}

/*
 * Joins a room. Callbacks:
 *   onMessage(payload)   a battle message from the other player (unparsed)
 *   onSignal(data)       video-call setup from the other player
 *   onPeers(ids)         the other players now in the room
 *   onStatus(status)     'connecting' | 'connected' | 'full' | 'error' | 'closed'
 * Returns { send(message), signal(data), close() }.
 */
export function joinRoom({ code, clientId, transport, onMessage, onSignal, onPeers, onStatus }) {
  const room = `pumpoff-battle-${code}`;
  return transport === 'online'
    ? joinOnline({ room, clientId, onMessage, onSignal, onPeers, onStatus })
    : joinLocal({ room, clientId, onMessage, onSignal, onPeers, onStatus });
}

/* ---------------------------- online (Supabase) ---------------------------- */

function joinOnline({ room, clientId, onMessage, onSignal, onPeers, onStatus }) {
  const joinedAt = Date.now();
  let closed = false;
  const channel = supabase().channel(room, {
    config: { broadcast: { self: false }, presence: { key: clientId } },
  });

  channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
    if (payload?.from !== clientId) onMessage(payload?.message);
  });
  channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
    if (payload?.from !== clientId) onSignal(payload?.data);
  });
  channel.on('presence', { event: 'sync' }, () => {
    // The two earliest arrivals hold the room; anyone later is turned away.
    const people = Object.entries(channel.presenceState())
      .map(([id, metas]) => ({ id, joinedAt: metas?.[0]?.joinedAt ?? 0 }))
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    const seats = people.slice(0, 2).map(person => person.id);
    if (!seats.includes(clientId) && people.some(person => person.id === clientId)) {
      onStatus('full');
      close();
      return;
    }
    onPeers(seats.filter(id => id !== clientId));
  });

  onStatus('connecting');
  channel.subscribe(async status => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      await channel.track({ joinedAt });
      onStatus('connected');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      onStatus('error');
    }
  });

  function close() {
    if (closed) return;
    closed = true;
    channel.untrack().catch(() => {});
    supabase().removeChannel(channel);
    onStatus('closed');
  }

  return {
    send: message => channel.send({ type: 'broadcast', event: 'msg', payload: { from: clientId, message } }),
    signal: data => channel.send({ type: 'broadcast', event: 'signal', payload: { from: clientId, data } }),
    close,
  };
}

/* ---------------------------- local (same browser) ---------------------------- */

const HEARTBEAT_MS = 1000;
const GONE_AFTER_MS = 3500;

function joinLocal({ room, clientId, onMessage, onSignal, onPeers, onStatus }) {
  const joinedAt = Date.now();
  const channel = new BroadcastChannel(room);
  const seen = new Map(); // id → { joinedAt, lastSeen }
  let lastReported = '';

  function report() {
    const now = Date.now();
    for (const [id, info] of seen) if (now - info.lastSeen > GONE_AFTER_MS) seen.delete(id);
    const others = [...seen.entries()]
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
      .map(([id]) => id)
      .slice(0, 1);
    const key = others.join(',');
    if (key !== lastReported) {
      lastReported = key;
      onPeers(others);
    }
  }

  channel.onmessage = ({ data }) => {
    if (!data || data.from === clientId) return;
    if (data.kind === 'ping' || data.kind === 'bye') {
      if (data.kind === 'bye') seen.delete(data.from);
      else seen.set(data.from, { joinedAt: data.joinedAt, lastSeen: Date.now() });
      report();
    } else if (data.kind === 'msg') {
      onMessage(data.message);
    } else if (data.kind === 'signal') {
      onSignal(data.data);
    }
  };

  const ping = () => channel.postMessage({ kind: 'ping', from: clientId, joinedAt });
  const heartbeat = setInterval(() => {
    ping();
    report();
  }, HEARTBEAT_MS);
  ping();
  onStatus('connected');

  return {
    send: message => channel.postMessage({ kind: 'msg', from: clientId, message }),
    signal: data => channel.postMessage({ kind: 'signal', from: clientId, data }),
    close: () => {
      clearInterval(heartbeat);
      channel.postMessage({ kind: 'bye', from: clientId });
      channel.close();
      onStatus('closed');
    },
  };
}
