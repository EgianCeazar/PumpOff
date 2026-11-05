import { useState } from 'react';
import { EXERCISES } from '@pumpoff/core';
import { formatHold, formatShortDate } from './format.js';

// One exercise per week as bars, picked with the buttons above the chart.
// One exercise at a time keeps a single honest axis: reps and plank
// minutes never share a scale. The color is validated categorical slot 1
// for the dark surface.
const BAR = '#3987e5';

const W = 640;
const H = 220;
const PAD = { left: 40, right: 8, top: 12, bottom: 28 };

// Rounded top corners only, so the bar stays anchored to the baseline.
function barPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, width / 2, height);
  return `M${x} ${y + height}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height}Z`;
}

// The smallest round number (1, 1.2, 1.5, 2, 2.5 … × a power of ten) at
// or above the tallest bar, so the bars use most of the chart's height.
function niceMax(value, floor) {
  if (value <= floor) return floor;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(m => m * power >= value);
  return step * power;
}

export default function WeeklyChart({ weeks }) {
  const used = Object.values(EXERCISES).filter(exercise =>
    weeks.some(week => (week.reps[exercise.key] ?? 0) > 0 || (week.holdMs[exercise.key] ?? 0) > 0),
  );
  const [picked, setPicked] = useState(null);
  const [hover, setHover] = useState(null);

  if (!used.length) {
    return <p className="sub">Nothing logged in the last 8 weeks.</p>;
  }

  const exercise = used.find(item => item.key === picked) ?? used[0];
  const hold = exercise.kind === 'hold';
  // Plank is charted in minutes; everything else in reps.
  const valueOf = week => (hold ? (week.holdMs[exercise.key] ?? 0) / 60000 : week.reps[exercise.key] ?? 0);
  const label = value => (hold ? `${formatHold(value * 60000)} held` : `${value} reps`);
  const tickLabel = value => (hold ? formatHold(value * 60000) : String(value));

  const max = niceMax(Math.max(0, ...weeks.map(valueOf)), hold ? 1 : 10);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const groupW = plotW / weeks.length;
  const barW = Math.min(28, groupW - 16);
  const y = value => PAD.top + plotH - (value / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart">
      {used.length > 1 && (
        <div className="chips" role="group" aria-label="Exercise to chart">
          {used.map(item => (
            <button
              key={item.key}
              type="button"
              className={item.key === exercise.key ? 'active' : ''}
              aria-pressed={item.key === exercise.key}
              onClick={() => {
                setPicked(item.key);
                setHover(null);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      <p className="chart-title">
        {exercise.name}: {hold ? 'time held' : 'reps'} per week
      </p>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${exercise.name} ${hold ? 'time held' : 'reps'} per week for the last 8 weeks`}>
          {ticks.map(tick => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="grid" />
              <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="axis">
                {tickLabel(tick)}
              </text>
            </g>
          ))}
          {weeks.map((week, i) => {
            const value = valueOf(week);
            const x = PAD.left + i * groupW + (groupW - barW) / 2;
            const active = hover?.week === i;
            const show = () => setHover({ week: i, value, x: x + barW / 2, top: y(value) });
            return (
              <g key={week.weekStart}>
                {value > 0 && (
                  <path
                    d={barPath(x, y(value), barW, y(0) - y(value))}
                    fill={BAR}
                    opacity={hover && !active ? 0.55 : 1}
                  />
                )}
                {/* A hit area taller than the bar, so small bars are easy to hover or tap. */}
                <rect
                  x={PAD.left + i * groupW}
                  y={PAD.top}
                  width={groupW}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={show}
                  onMouseLeave={() => setHover(null)}
                  onClick={show}
                />
                <text x={PAD.left + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" className="axis">
                  {formatShortDate(week.weekStart)}
                </text>
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="baseline" />
        </svg>
        {hover && (
          <div className="tooltip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.top / H) * 100}%` }}>
            <strong>{label(hover.value)}</strong>
            <span>week of {formatShortDate(weeks.at(hover.week).weekStart)}</span>
          </div>
        )}
      </div>
      <details>
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              {used.map(item => (
                <th key={item.key}>{item.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map(week => (
              <tr key={week.weekStart}>
                <td>{formatShortDate(week.weekStart)}</td>
                {used.map(item => (
                  <td key={item.key}>
                    {item.kind === 'hold' ? formatHold(week.holdMs[item.key] ?? 0) : week.reps[item.key] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
