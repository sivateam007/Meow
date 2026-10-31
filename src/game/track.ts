export type Module =
  | { t: "straight"; len: number }
  | { t: "turn"; deg: number; radius: number }
  | { t: "gap"; len: number }
  | { t: "ramp"; len: number; rise: number };

export type Sample = {
  s: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  deck: boolean;
};

export type TrackData = {
  samples: Sample[];
  length: number;
};

const STEP = 0.4;

export function buildTrack(mods: Module[]): TrackData {
  const samples: Sample[] = [];
  let x = 0;
  let y = 1.15;
  let z = 0;
  let yaw = 0;
  let s = 0;

  const push = (deck: boolean) => {
    samples.push({ s, x, y, z, yaw, deck });
  };

  push(true);

  for (const m of mods) {
    if (m.t === "turn") {
      const rad = (m.deg * Math.PI) / 180;
      const len = Math.abs(rad) * m.radius;
      const n = Math.max(1, Math.round(len / STEP));
      for (let i = 1; i <= n; i++) {
        const ds = len / n;
        const dyaw = rad / n;
        const yawMid = yaw + dyaw * 0.5;
        s += ds;
        x += -Math.sin(yawMid) * ds;
        z += -Math.cos(yawMid) * ds;
        yaw += dyaw;
        push(true);
      }
      continue;
    }

    const len = m.len;
    const n = Math.max(m.t === "gap" ? 2 : 1, Math.round(len / STEP));
    const y0 = y;
    const y1 = m.t === "ramp" ? y + m.rise : y;
    for (let i = 1; i <= n; i++) {
      const ds = len / n;
      s += ds;
      x += -Math.sin(yaw) * ds;
      z += -Math.cos(yaw) * ds;
      y = y0 + (y1 - y0) * (i / n);
      const deck = m.t === "gap" ? i === n : true;
      push(deck);
    }
  }

  if (samples.length > 0) samples[samples.length - 1].deck = true;
  return { samples, length: s };
}

export type Span = { lo: number; hi: number; t: number };

export function spanAt(track: TrackData, s: number): Span {
  const samples = track.samples;
  if (s <= samples[0].s) return { lo: 0, hi: 1, t: 0 };
  const last = samples.length - 1;
  if (s >= samples[last].s) return { lo: last - 1, hi: last, t: 1 };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s < s) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = (s - a.s) / (b.s - a.s || 1);
  return { lo, hi, t };
}

export type Pose = {
  s: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  deck: boolean;
};

export function poseAt(track: TrackData, s: number): Pose {
  const samples = track.samples;
  const { lo, hi, t } = spanAt(track, Math.max(0, Math.min(track.length, s)));
  const a = samples[lo];
  const b = samples[hi];
  const lerp = (p: number, q: number) => p + (q - p) * t;
  let dy = b.yaw - a.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const yaw = a.yaw + dy * t;
  const deck = t < 0.02 ? a.deck : a.deck && b.deck;
  return {
    s,
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    z: lerp(a.z, b.z),
    yaw,
    tx: -Math.sin(yaw),
    tz: -Math.cos(yaw),
    rx: Math.cos(yaw),
    rz: -Math.sin(yaw),
    deck,
  };
}

export function deckAt(track: TrackData, s: number) {
  if (s < -0.05) return false;
  if (s >= track.length - 0.02) return true;
  return poseAt(track, s).deck;
}

/** Upcoming hole. Null if the deck runs to the finish. */
export function gapAhead(track: TrackData, s: number): { start: number; end: number; length: number } | null {
  let x = Math.max(0, s);
  if (deckAt(track, x)) {
    while (x < track.length && deckAt(track, x)) x += 0.2;
    if (x >= track.length - 0.05) return null;
  }
  const start = x;
  while (x < track.length && !deckAt(track, x)) x += 0.15;
  const length = Math.max(0, x - start);
  if (length < 0.3) return null;
  return { start, end: x, length };
}
