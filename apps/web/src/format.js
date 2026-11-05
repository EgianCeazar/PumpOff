import { EXERCISES } from '@pumpoff/core';

export const exerciseName = key => EXERCISES[key]?.name ?? key;

export function formatDay(t) {
  return new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(t) {
  return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatShortDate(t) {
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatPercent(rate) {
  return rate === null || rate === undefined ? '–' : `${Math.round(rate * 100)}%`;
}

// A hold time as m:ss, e.g. 1:05.
export function formatHold(ms = 0) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function describeSet(set) {
  if (set.holdMs !== null && set.holdMs !== undefined) {
    return `${exerciseName(set.exercise)} · ${formatHold(set.holdMs)} hold`;
  }
  const timed = set.mode === 'timed' ? ` · ${set.seconds}s set` : '';
  return `${exerciseName(set.exercise)}${timed} · ${set.reps} reps`;
}

export function describeMistakes(reasons = {}) {
  return Object.entries(reasons)
    .map(([reason, count]) => (count > 1 ? `${reason} (×${count})` : reason))
    .join(' · ');
}
