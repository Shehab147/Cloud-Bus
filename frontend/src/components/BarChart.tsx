import { useState } from 'react';

export type BarDatum = { label: string; shortLabel: string; value: number };

const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(' ');

/** Smallest "clean" axis maximum (1, 2, 5, 10, 20, 50, ...) that fits the data. */
export function niceMax(max: number): number {
  if (max <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 5, 10].map((step) => step * magnitude).find((candidate) => candidate >= max)) ?? max;
}

/**
 * Single-series column chart for small admin dashboards.
 * - One hue (the theme's primary), columns capped at 24px with a 4px rounded top,
 *   square at the baseline, hairline gridlines, no legend (the card title names the series).
 * - Only the peak is labelled on the chart; every value is in the hover/focus
 *   tooltip and in the "View as table" fallback.
 * - The whole column is the hover/focus target, not just the painted bar.
 */
export function BarChart({ data, ariaLabel, unit, height = 144, labelEvery = 1 }: { data: BarDatum[]; ariaLabel: string; unit: string; height?: number; labelEvery?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((item) => item.value));
  const top = niceMax(max);
  const peak = max > 0 ? data.findIndex((item) => item.value === max) : -1;
  const last = data.length - 1;

  return (
    <figure className="space-y-2">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-xs tabular-nums text-muted-foreground" style={{ height }} aria-hidden="true">
          <span>{top}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex items-end border-b border-border" style={{ height }} role="list" aria-label={ariaLabel}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border/50" aria-hidden="true" />
            {max === 0 && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No activity in this period</p>}
            {data.map((item, index) => {
              const percent = (item.value / top) * 100;
              const anchor = index <= 1 ? 'left-0' : index >= last - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div
                  key={`${item.label}-${index}`}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${item.label}: ${item.value} ${unit}`}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center px-px outline-none focus-visible:bg-muted/60"
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  {item.value > 0 && (
                    <div
                      className={cx('w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity', active !== null && active !== index && 'opacity-60')}
                      style={{ height: `${percent}%` }}
                    />
                  )}
                  {index === peak && active === null && (
                    <span className="pointer-events-none absolute text-xs font-medium tabular-nums text-foreground" style={{ bottom: `calc(${percent}% + 4px)` }}>{item.value}</span>
                  )}
                  {active === index && (
                    <div className={cx('pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md', anchor)} role="status">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{item.value} <span className="font-normal text-muted-foreground">{unit}</span></p>
                      <p className="text-muted-foreground">{item.label}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex" aria-hidden="true">
            {data.map((item, index) => (
              <span key={`${item.label}-${index}`} className="min-w-0 flex-1 text-center text-xs text-muted-foreground">
                {index % labelEvery === 0 ? item.shortLabel : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-4 font-medium">Period</th><th className="py-1 font-medium">{unit}</th></tr></thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={`${item.label}-${index}`} className="border-t border-border/50"><td className="py-1 pr-4">{item.label}</td><td className="py-1 tabular-nums">{item.value}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
