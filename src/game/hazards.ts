export type Hazard =
  | { kind: "hammer"; at: number; period: number; phase: number; side: 1 | -1 }
  | { kind: "ball"; at: number; period: number; phase: number; side: 1 | -1 }
  | { kind: "pusher"; at: number; period: number; phase: number; side: 1 | -1 }
  | { kind: "rotor"; at: number; period: number; phase: number }
  | { kind: "saw"; at: number; period: number; phase: number }
  | { kind: "bar"; at: number; period: number; phase: number }
  | { kind: "crusher"; at: number; period: number; phase: number }
  | { kind: "laser"; at: number; period: number; phase: number }
  | { kind: "spinner"; at: number; period: number; phase: number }
  | { kind: "bounce"; at: number; period: number; phase: number };

export type HazardKind = Hazard["kind"];

/** Kinds that hang off a side post and need a `side`. */
export const SIDED_KINDS: HazardKind[] = ["hammer", "ball", "pusher"];

export const HAZARD_LABEL: Record<HazardKind, string> = {
  hammer: "Swinging hammers",
  ball: "Giant pendulum balls",
  pusher: "Piston pushes",
  rotor: "Spinning bars",
  saw: "Sliding saws",
  bar: "Shutter gates",
  crusher: "Slam crushers",
  laser: "Laser beams",
  spinner: "Spinning sweepers",
  bounce: "Bounce pads",
};

export function frac(n: number) {
  return n - Math.floor(n);
}

function phase(time: number, period: number, p: number) {
  return frac(time / period + p);
}

function easeInOut(t: number) {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export function hammerPose(h: Extract<Hazard, { kind: "hammer" }>, time: number) {
  const phi = Math.sin(phase(time, h.period, h.phase) * Math.PI * 2) * 1.05;
  const pivotLat = h.side * 2.85;
  const pivotY = 3.35;
  const arm = 3.15;
  const headLat = pivotLat - h.side * Math.sin(phi) * arm;
  const headY = pivotY - Math.cos(phi) * arm;
  return { pivotLat, pivotY, headLat, headY, phi, arm };
}

/** Giant ball swinging across the deck on a chain. */
export function ballPose(h: Extract<Hazard, { kind: "ball" }>, time: number) {
  const phi = Math.sin(phase(time, h.period, h.phase) * Math.PI * 2) * 0.86;
  const pivotY = 4.6;
  const arm = 3.9;
  const lat = Math.sin(phi) * arm;
  const y = pivotY - Math.cos(phi) * arm;
  return { lat, y, phi, pivotY, arm };
}

/** 0 = tucked off the deck, 1 = fully punched across the lane. */
export function pusherExtend(h: Extract<Hazard, { kind: "pusher" }>, time: number) {
  const u = phase(time, h.period, h.phase);
  if (u >= 0.42 && u < 0.56) return easeInOut((u - 0.42) / 0.14);
  if (u >= 0.56 && u < 0.74) return 1;
  if (u >= 0.74 && u < 0.88) return 1 - easeInOut((u - 0.74) / 0.14);
  return 0;
}

/** Lateral of the pusher's inner face (deck spans -2.7 … 2.7). */
export function pusherEdge(h: Extract<Hazard, { kind: "pusher" }>, time: number) {
  const e = pusherExtend(h, time);
  return h.side * (3.55 - 5.95 * e);
}

export function rotorAngle(h: Extract<Hazard, { kind: "rotor" }>, time: number) {
  return phase(time, h.period, h.phase) * Math.PI * 2;
}

export function spinnerAngle(h: Extract<Hazard, { kind: "spinner" }>, time: number) {
  return phase(time, h.period, h.phase) * Math.PI * 2;
}

export function sawLat(h: Extract<Hazard, { kind: "saw" }>, time: number) {
  return Math.sin(phase(time, h.period, h.phase) * Math.PI * 2) * 1.65;
}

export function barGap(h: Extract<Hazard, { kind: "bar" }>, time: number) {
  return Math.sin(phase(time, h.period, h.phase) * Math.PI * 2) * 1.35;
}

/** Returns true when the laser beam is active (on). */
export function laserOn(h: Extract<Hazard, { kind: "laser" }>, time: number) {
  const u = phase(time, h.period, h.phase);
  return u < 0.5;
}
export function crusherBottom(h: Extract<Hazard, { kind: "crusher" }>, time: number) {
  const u = phase(time, h.period, h.phase);
  const up = 3.15;
  const down = 0.15;
  if (u >= 0.62 && u < 0.78) {
    const k = (u - 0.62) / 0.16;
    return up + (down - up) * k;
  }
  if (u >= 0.78 && u < 0.92) return down;
  if (u >= 0.92) {
    const k = (u - 0.92) / 0.08;
    return down + (up - down) * k;
  }
  return up;
}

function distPointSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return Math.hypot(dx, dy);
}

export function hitsHazard(h: Hazard, time: number, s: number, lat: number, y: number) {
  const ds = s - h.at;
  if (h.kind === "hammer") {
    if (ds * ds > 1.35 * 1.35) return false;
    const pose = hammerPose(h, time);
    const dx = lat - pose.headLat;
    const dy = y - pose.headY;
    if (dx * dx + dy * dy < 1.05 * 1.05) return true;
    return distPointSeg(lat, y, pose.pivotLat, pose.pivotY, pose.headLat, pose.headY) < 0.42;
  }
  if (h.kind === "ball") {
    if (ds * ds > 1.5 * 1.5) return false;
    const pose = ballPose(h, time);
    const dx = lat - pose.lat;
    const dy = y - pose.y;
    if (dx * dx + dy * dy < 1.12 * 1.12) return true;
    // The chain sweeps too.
    return distPointSeg(lat, y, 0, pose.pivotY, pose.lat, pose.y) < 0.34;
  }
  if (h.kind === "pusher") {
    if (Math.abs(ds) > 0.82 || y > 1.75) return false;
    const edge = pusherEdge(h, time);
    return h.side === 1 ? lat > edge : lat < edge;
  }
  if (h.kind === "rotor") {
    if (y > 1.7 || Math.abs(ds) > 2.7) return false;
    const ang = rotorAngle(h, time);
    const len = 2.55;
    const hl = -Math.cos(ang) * len;
    const hs = -Math.sin(ang) * len;
    return distPointSeg(lat, ds, -hl, -hs, hl, hs) < 0.42;
  }
  if (h.kind === "saw") {
    if (y > 1.45) return false;
    const latC = sawLat(h, time);
    const dl = lat - latC;
    return ds * ds + dl * dl < 1.2 * 1.2;
  }
  if (h.kind === "bar") {
    if (Math.abs(ds) > 0.48 || y > 1.35) return false;
    return Math.abs(lat - barGap(h, time)) > 0.82;
  }
  if (h.kind === "laser") {
    if (Math.abs(ds) > 1.1 || y < 0.8 || y > 1.6) return false;
    return laserOn(h, time);
  }
  if (h.kind === "spinner") {
    if (y > 0.85 || Math.abs(ds) > 2.8) return false;
    const ang = spinnerAngle(h, time);
    const len = 2.2;
    const hl = -Math.cos(ang) * len;
    const hs = -Math.sin(ang) * len;
    return distPointSeg(lat, ds, -hl, -hs, hl, hs) < 0.38;
  }
  if (h.kind === "bounce") {
    return false; // beneficial, never hits
  }
  if (Math.abs(ds) > 0.85 || Math.abs(lat) > 2.5 || y > 1.65) return false;
  return crusherBottom(h, time) < 1.55;
}

/** A lateral that is safe right now, or null if the whole deck is hot. */
export function safeLat(h: Hazard, time: number, prefer: number) {
  if (h.kind === "laser" || h.kind === "spinner") return null;
  let best: number | null = null;
  let bestD = 99;
  for (let lat = -2.3; lat <= 2.3; lat += 1.15) {
    if (!hitsHazard(h, time, h.at, lat, 1.05)) {
      const d = Math.abs(lat - prefer);
      if (d < bestD) {
        bestD = d;
        best = lat;
      }
    }
  }
  return best;
}
