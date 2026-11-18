import { useId, useRef, useState, type ReactNode } from "react";

/** Biểu đồ SVG thuần (không thêm thư viện), màu lấy từ token theme qua CSS variable nên đổi theme là đổi theo. */

export type Series = { name: string; color: string; values: number[] };

const nf = new Intl.NumberFormat("vi-VN");

/** Rút gọn số trục: 1.2tr, 350k. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}tỷ`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}tr`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function niceMax(v: number): number {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const f = v / pow;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * pow;
}

/** Đường cong mượt (Catmull-Rom -> Bezier) qua các điểm. */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const W = 640;
const H = 240;
const PAD = { l: 44, r: 12, t: 12, b: 26 };

/** Biểu đồ vùng (nhiều đường) hoặc cột theo thời gian, có lưới, nhãn trục, tooltip khi rê chuột. */
export function TrendChart({
  labels,
  series,
  kind,
  format = (n) => nf.format(n),
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  kind: "area" | "bar";
  format?: (n: number) => string;
  ariaLabel: string;
}) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const rawMax = Math.max(0, ...series.flatMap((s) => s.values));
  const rawMin = Math.min(0, ...series.flatMap((s) => s.values));
  const max = niceMax(rawMax);
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (kind === "bar" ? ((i + 0.5) / n) * iw : n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((v - min) / (max - min || 1)) * ih;
  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4);
  const labelStep = Math.max(1, Math.ceil(n / 6));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = (px - PAD.l) / iw;
    const idx = kind === "bar" ? Math.floor(t * n) : Math.round(t * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  };

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="block h-auto w-full touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={kind === "bar" ? 1 : 0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={kind === "bar" ? 0.55 : 0.02} />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {compact(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelStep === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
              {l}
            </text>
          ) : null,
        )}

        {kind === "area" &&
          series.map((s, si) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = smooth(pts);
            const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z` : "";
            return (
              <g key={si}>
                <path d={area} fill={`url(#${uid}g${si})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}

        {kind === "bar" &&
          series.map((s, si) => {
            const slot = iw / n;
            const bw = Math.min(28, (slot * 0.7) / series.length);
            return s.values.map((v, i) => {
              const bx = x(i) - (bw * series.length) / 2 + si * bw;
              const top = Math.min(y(v), y(0));
              return (
                <rect key={`${si}-${i}`} x={bx} y={top} width={bw - 1} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={Math.min(4, bw / 2)} fill={v < 0 ? "var(--color-error)" : `url(#${uid}g${si})`} opacity={hover === null || hover === i ? 1 : 0.45} />
              );
            });
          })}

        {hover !== null && (
          <g pointerEvents="none">
            {kind === "area" && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-line-strong)" />}
            {kind === "area" &&
              series.map((s, si) => <circle key={si} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r="4" fill="var(--color-surface)" stroke={s.color} strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-32 -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 text-caption shadow-popup"
          style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`, top: 0 }}
        >
          <div className="mb-1 font-semibold text-ink">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="font-medium text-ink">{format(s.values[hover] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-caption text-muted">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.name}
        </li>
      ))}
    </ul>
  );
}

/** Đường nhỏ không trục cho thẻ KPI. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const uid = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const w = 96;
  const h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as [number, number]);
  const line = smooth(pts);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-24" aria-hidden="true">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Biểu đồ vành khuyên + chú giải có số và phần trăm. */
export function Donut({
  slices,
  centerLabel,
}: {
  slices: { name: string; value: number; color: string }[];
  centerLabel: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0" role="img" aria-label={`${centerLabel}: ${total}`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-subtle)" strokeWidth="16" />
        {total > 0 &&
          slices
            .filter((s) => s.value > 0)
            .map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.name}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 70 70)"
                />
              );
              acc += len;
              return el;
            })}
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--color-ink)">
          {nf.format(total)}
        </text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="var(--color-muted)">
          {centerLabel}
        </text>
      </svg>
      <ul className="m-0 grid min-w-40 flex-1 list-none gap-1.5 p-0 text-body">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
            <span className="font-medium text-ink">
              {nf.format(s.value)} <span className="text-faint">({total ? Math.round((s.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cột ngang xếp hạng, thanh dùng gradient theo màu truyền vào. */
export function RankBars({
  items,
  color,
  format = (n) => nf.format(n),
}: {
  items: { key: string; label: ReactNode; value: number; hint?: string }[];
  color: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {items.map((it, i) => (
        <li key={it.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-body">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: color, opacity: 1 - i * 0.07 }}>
                {i + 1}
              </span>
              <span className="truncate text-ink">{it.label}</span>
            </span>
            <span className="shrink-0 font-medium text-ink">
              {format(it.value)}
              {it.hint && <span className="ml-1.5 text-caption font-normal text-muted">{it.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, white))` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
