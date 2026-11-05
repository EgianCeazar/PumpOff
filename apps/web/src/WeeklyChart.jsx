import { useState } from 'react';
import { formatShortDate } from './format.js';

// Reps per week as grouped bars, one bar per exercise.
// Colors are the validated categorical slots 1 and 2 for a dark surface.
const SERIES = [
  { key: 'squat', label: 'Squats', color: '#3987e5' },
  { key: 'pushup', label: 'Push-ups', color: '#d95926' },
];

const W = 640;
const H = 220;
const PAD = { left: 36, right: 8, top: 12, bottom: 28 };

// Rounded top corners only, so the bar stays anchored to the baseline.
function barPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, width / 2, height);
  return `M${x} ${y + height}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height}Z`;
}

// The smallest round number (1, 2, 2.5, 5 × a power of ten) at or above
// the tallest bar, so the bars use most of the chart's height.
function niceMax(value) {
  if (value <= 10) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(m => m * power >= value);
  return step * power;
}

export default function WeeklyChart({ weeks }) {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(0, ...weeks.flatMap(week => SERIES.map(s => week.reps[s.key] ?? 0))));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const groupW = plotW / weeks.length;
  const barW = Math.min(18, (groupW - 12) / SERIES.length - 2);
  const y = value => PAD.top + plotH - (value / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart">
      <div className="legend">
        {SERIES.map(s => (
          <span key={s.key}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Reps per week for the last 8 weeks">
          {ticks.map(tick => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="grid" />
              <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="axis">
                {tick}
              </text>
            </g>
          ))}
          {weeks.map((week, i) => {
            const groupX = PAD.left + i * groupW;
            const barsW = SERIES.length * barW + (SERIES.length - 1) * 2;
            const startX = groupX + (groupW - barsW) / 2;
            return (
              <g key={week.weekStart}>
                {SERIES.map((s, j) => {
                  const value = week.reps[s.key] ?? 0;
                  const x = startX + j * (barW + 2);
                  const active = hover?.week === i && hover?.series === s.key;
                  return (
                    <g key={s.key}>
                      {value > 0 && (
                        <path
                          d={barPath(x, y(value), barW, y(0) - y(value))}
                          fill={s.color}
                          opacity={hover && !active ? 0.55 : 1}
                        />
                      )}
                      {/* A hit area taller than the bar, so small bars are easy to hover or tap. */}
                      <rect
                        x={x - 1}
                        y={PAD.top}
                        width={barW + 2}
                        height={plotH}
                        fill="transparent"
                        onMouseEnter={() => setHover({ week: i, series: s.key, value, label: s.label, x: x + barW / 2, top: y(value) })}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => setHover({ week: i, series: s.key, value, label: s.label, x: x + barW / 2, top: y(value) })}
                      />
                    </g>
                  );
                })}
                <text x={groupX + groupW / 2} y={H - 8} textAnchor="middle" className="axis">
                  {formatShortDate(week.weekStart)}
                </text>
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="baseline" />
        </svg>
        {hover && (
          <div className="tooltip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.top / H) * 100}%` }}>
            <strong>{hover.value}</strong> {hover.label.toLowerCase()}
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
              {SERIES.map(s => (
                <th key={s.key}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map(week => (
              <tr key={week.weekStart}>
                <td>{formatShortDate(week.weekStart)}</td>
                {SERIES.map(s => (
                  <td key={s.key}>{week.reps[s.key] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
