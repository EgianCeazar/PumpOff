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

export function describeSet(set) {
  const kind = set.mode === 'timed' ? `${set.seconds}s set` : 'set';
  return `${exerciseName(set.exercise)} · ${kind} · ${set.reps} reps`;
}

export function describeMistakes(reasons = {}) {
  return Object.entries(reasons)
    .map(([reason, count]) => (count > 1 ? `${reason} (×${count})` : reason))
    .join(' · ');
}
