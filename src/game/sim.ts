import { hitsHazard, safeLat, type Hazard } from "@/game/hazards";
import { LEVELS, type Level } from "@/game/levels";
import { deckAt, gapAhead, poseAt } from "@/game/track";

/**
 * Chase-cam basis (controls skill):
 *   forward = (-sin(yaw), 0, -cos(yaw)); yaw 0 faces world −Z
 *   +yaw turns the nose left on a camera sitting behind the runner
 *   A / ←  → steer +1 → +yaw and lateral decreases (screen left)
 *   D / →  → steer −1 → −yaw and lateral increases (screen right)
 *   W / hold / Space → throttle. Release → brake to a stop.
 */

export const PLAYER_SPEED = 14.2;
export const ACCEL = 34;
export const BRAKE = 62;
export const STRAFE = 8.2;
const JUMP_TIME = 0.8;
const JUMP_VY = 9.0;
const GRAV = (2 * JUMP_VY) / JUMP_TIME;
const LAT_LIM = 2.35;

export type RaceMode = "classic" | "elimination" | "endless";

export type Runner = {
  name: string;
  color: string;
  isPlayer: boolean;
  s: number;
  lateral: number;
  prevLat: number;
  speed: number;
  maxSpeed: number;
  y: number;
  vy: number;
  lean: number;
  bodyYaw: number;
  anim: number;
  state: "run" | "air" | "tumble" | "done" | "out";
  eliminated: boolean;
  tumbleT: number;
  tumbleSide: number;
  checkpoint: number;
  invuln: number;
  finishTime: number;
  place: number;
  coins: number;
  tumbles: number;
  hold: boolean;
  wantLat: number;
  thinkT: number;
  mistake: number;
  reaction: number;
};

export type Coin = { at: number; lat: number; taken: boolean };

export type FinishPayload = {
  place: number;
  time: number;
  pickups: number;
  tumbles: number;
  levelId: number;
  mode: RaceMode;
  eliminated: boolean;
  standings: {
    name: string;
    place: number;
    time: number;
    done: boolean;
    eliminated: boolean;
    me: boolean;
    color: string;
    s: number;
    tumbles: number;
  }[];
};

export type CutEvent = { name: string; t: number; me: boolean };

export type HudPayload = {
  place: number;
  total: number;
  s: number;
  length: number;
  time: number;
  countdown: number;
  speed: number;
  maxSpeed: number;
  hint: string;
  name: string;
  levelId: number;
  pickups: number;
  mode: RaceMode;
  /** Arc length of the next elimination gate, or null. */
  gate: number | null;
  alive: number;
  lastCut: CutEvent | null;
  rivals: {
    name: string;
    s: number;
    color: string;
    me: boolean;
    done: boolean;
    eliminated: boolean;
  }[];
};

export type Sim = {
  level: Level;
  runners: Runner[];
  coins: Coin[];
  time: number;
  phase: "menu" | "race" | "done";
  /** Seconds of 3-2-1-GO before the pack is released. */
  countdown: number;
  hitstop: number;
  shake: number;
  foot: number;
  gen: number;
  paused: boolean;
  player: Runner;
  mode: RaceMode;
  gates: number[];
  gateIndex: number;
  emote: string;
  lastCut: CutEvent | null;
};

export type InputState = {
  keys: Set<string>;
  pointers: number;
  buttonSteer: number;
  drag: number;
  probeSteer: number | null;
  swipeDir: number;
};

export function makeInput(): InputState {
  return {
    keys: new Set(),
    pointers: 0,
    buttonSteer: 0,
    drag: 0,
    probeSteer: null,
    swipeDir: 0,
  };
}

function makeRunner(
  partial: Pick<Runner, "name" | "color" | "isPlayer" | "s" | "lateral" | "maxSpeed" | "mistake" | "reaction">,
): Runner {
  return {
    ...partial,
    prevLat: partial.lateral,
    speed: 0,
    y: 0,
    vy: 0,
    lean: 0,
    bodyYaw: 0,
    anim: 0,
    state: "run",
    eliminated: false,
    tumbleT: 0,
    tumbleSide: 1,
    checkpoint: 0,
    invuln: 0,
    finishTime: 0,
    place: 1,
    coins: 0,
    tumbles: 0,
    hold: false,
    wantLat: partial.lateral,
    thinkT: 0,
  };
}

export function createSim(
  levelOrId: number | Level,
  mode: RaceMode = "classic",
  emote = "bounce",
): Sim {
  const level =
    typeof levelOrId === "number"
      ? LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelOrId))]
      : levelOrId;
  const player = makeRunner({
    name: "You",
    color: "#8fb0dd",
    isPlayer: true,
    s: 0,
    lateral: 0,
    maxSpeed: PLAYER_SPEED,
    mistake: 0,
    reaction: 0,
  });
  const bots = level.bots.map((b) =>
    makeRunner({
      name: b.name,
      color: b.color,
      isPlayer: false,
      s: b.s,
      lateral: b.lat,
      maxSpeed: b.speed,
      mistake: b.mistake,
      reaction: b.reaction,
    }),
  );
  return {
    level,
    runners: [player, ...bots],
    coins: level.coins.map((c) => ({ ...c, taken: false })),
    time: 0,
    phase: "menu",
    countdown: 0,
    hitstop: 0,
    shake: 0,
    foot: 0,
    gen: 1,
    paused: false,
    player,
    mode,
    gates:
      mode === "elimination"
        ? [level.track.length * 0.44, level.track.length * 0.7]
        : [],
    gateIndex: 0,
    emote,
    lastCut: null,
  };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function holding(input: InputState) {
  return (
    input.pointers > 0 ||
    input.keys.has("KeyW") ||
    input.keys.has("Space") ||
    input.keys.has("ArrowUp")
  );
}

function steerOf(input: InputState) {
  if (input.probeSteer != null) return clamp(input.probeSteer, -1, 1);
  let steer = input.buttonSteer;
  if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) steer += 1;
  if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) steer -= 1;
  return clamp(steer, -1, 1);
}

function tumble(sim: Sim, r: Runner, side: number) {
  if (r.state === "tumble" || r.state === "done" || r.state === "out" || r.eliminated) return;
  r.state = "tumble";
  r.tumbleT = 0;
  r.tumbleSide = side || (r.lateral >= 0 ? 1 : -1);
  r.speed = 0;
  r.tumbles += 1;
  r.vy = 0;
  if (r.isPlayer) sim.hitstop = 0.12;
  sim.shake = Math.max(sim.shake, r.isPlayer ? 0.55 : 0.2);
}

function respawn(r: Runner) {
  r.state = "run";
  r.s = r.checkpoint;
  r.lateral = 0;
  r.prevLat = 0;
  r.speed = 0;
  r.y = 0;
  r.vy = 0;
  r.lean = 0;
  r.invuln = 0.7;
  r.tumbleT = 0;
}

function think(sim: Sim, r: Runner, dt: number) {
  r.thinkT -= dt;
  if (r.thinkT > 0) return;
  r.thinkT = 0.12 + r.reaction * 0.25;

  let wantHold = true;
  let wantLat = r.lateral;
  const look = r.s + Math.max(2.2, r.speed * (0.42 + r.reaction));

  const hole = gapAhead(sim.level.track, r.s);
  if (hole && hole.length > 0 && hole.start - r.s < 8 && hole.start >= r.s - 0.2) {
    const dist = Math.max(0, hole.start - r.s);
    const range = r.speed * JUMP_TIME + 0.35;
    if (dist < 1.1 && range < hole.length - 0.15) wantHold = true;
    else wantHold = true;
  }

  for (const h of sim.level.hazards) {
    if (h.at < r.s - 0.4 || h.at > look) continue;
    const eta = r.speed > 0.8 ? Math.max(0, (h.at - r.s) / r.speed) : 0.45;
    if (eta > 0.85) continue;
    const future = sim.time + eta;
    const safe = safeLat(h, future, r.lateral);
    if (safe == null) {
      if (eta < 0.55) wantHold = false;
    } else {
      wantLat = safe;
      const need = Math.abs(safe - r.lateral);
      if (need > STRAFE * eta + 0.25 && eta < 0.38) wantHold = false;
    }
  }

  if (!wantHold) {
    let threat = false;
    for (const h of sim.level.hazards) {
      if (h.at < r.s - 0.3 || h.at > r.s + 3.2) continue;
      if (safeLat(h, sim.time, r.lateral) == null || hitsHazard(h, sim.time, h.at, r.lateral, 1.05)) {
        threat = true;
        break;
      }
    }
    if (!threat) wantHold = true;
  }

  if (Math.random() < r.mistake) wantHold = !wantHold;
  r.hold = wantHold;
  r.wantLat = clamp(wantLat, -LAT_LIM, LAT_LIM);
}

function jumpRange(speed: number) {
  return speed * JUMP_TIME + 0.35;
}

function integrate(sim: Sim, r: Runner, dt: number, input: InputState, onCoin: () => void, onHit: () => void) {
  if (r.state === "done" || r.state === "out" || r.eliminated) return;

  if (r.state === "tumble") {
    r.tumbleT += dt;
    if (r.tumbleT > 0.88) respawn(r);
    const pose = poseAt(sim.level.track, r.s);
    r.bodyYaw = pose.yaw + r.lean;
    return;
  }

  if (r.invuln > 0) r.invuln -= dt;

  if (!r.isPlayer) think(sim, r, dt);

  const hold = r.isPlayer ? holding(input) : r.hold;
  const steer = r.isPlayer ? steerOf(input) : 0;

  if (r.state !== "air") {
    if (hold) r.speed = Math.min(r.maxSpeed, r.speed + ACCEL * dt);
    else r.speed = Math.max(0, r.speed - BRAKE * dt);
  } else if (hold) {
    r.speed = Math.min(r.maxSpeed, r.speed + ACCEL * 0.25 * dt);
  }

  if (r.isPlayer) {
    r.lateral -= steer * STRAFE * dt;
    // Swipe: keep the sign, damp the amplitude across fixed steps.
    if (input.swipeDir !== 0) {
      const step = Math.sign(input.swipeDir) * Math.min(Math.abs(input.drag) * 0.9, 1.1);
      r.lateral += step;
      input.drag = 0;
      input.swipeDir = 0;
    } else {
      r.lateral += Math.max(-1.1, Math.min(1.1, input.drag));
      input.drag = 0;
    }
  } else {
    const diff = r.wantLat - r.lateral;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), STRAFE * dt);
    r.lateral += step;
  }
  r.lateral = clamp(r.lateral, -LAT_LIM, LAT_LIM);

  const latVel = dt > 0 ? (r.lateral - r.prevLat) / dt : 0;
  r.prevLat = r.lateral;
  const leanTarget =
    (r.isPlayer ? steer : clamp(-latVel / STRAFE, -1, 1)) * 0.58 +
    clamp(-latVel * 0.035, -0.28, 0.28);
  r.lean += (leanTarget - r.lean) * Math.min(1, dt * 12);
  r.anim += Math.max(0.8, r.speed) * dt * (r.speed > 1 ? 1.35 : 0.4);

  const track = sim.level.track;

  if (r.state === "air") {
    r.s += r.speed * dt;
    r.vy -= GRAV * dt;
    r.y += r.vy * dt;
    if (r.y <= 0) {
      r.y = 0;
      r.vy = 0;
      if (!deckAt(track, r.s)) {
        tumble(sim, r, r.tumbleSide);
        if (r.isPlayer) onHit();
        return;
      }
      r.state = "run";
    }
  } else {
    const nextS = r.s + r.speed * dt;
    const onDeck = deckAt(track, r.s);
    const nextDeck = deckAt(track, nextS);
    if (onDeck && !nextDeck) {
      const hole = gapAhead(track, r.s);
      const need = hole ? hole.length : 4;
      if (jumpRange(r.speed) >= need - 0.2) {
        r.state = "air";
        r.vy = JUMP_VY;
        r.y = 0;
        r.s = nextS;
      } else {
        r.s = Math.min(nextS, hole ? hole.start : nextS);
        tumble(sim, r, r.lateral >= 0 ? 1 : -1);
        if (r.isPlayer) onHit();
        return;
      }
    } else {
      r.s = nextS;
      if (!deckAt(track, r.s)) {
        tumble(sim, r, 1);
        if (r.isPlayer) onHit();
        return;
      }
    }
  }

  if (r.s >= track.length) {
    r.s = track.length;
    r.state = "done";
    r.finishTime = sim.time;
    r.speed = 0;
    const pose = poseAt(track, r.s);
    r.bodyYaw = pose.yaw + r.lean;
    return;
  }

  for (const c of sim.level.checkpoints) {
    if (c > r.checkpoint && r.s >= c && deckAt(track, r.s)) r.checkpoint = c;
  }

  if (r.invuln <= 0) {
    const bodyY = 1.05 + Math.max(0, r.y);
    for (const h of sim.level.hazards) {
      if (Math.abs(h.at - r.s) > 3.4) continue;
      if (hitsHazard(h, sim.time, r.s, r.lateral, bodyY)) {
        const side = h.kind === "hammer" ? h.side : r.lateral >= 0 ? 1 : -1;
        tumble(sim, r, side);
        if (r.isPlayer) onHit();
        return;
      }
    }
  }

  if (r.isPlayer) {
    for (const c of sim.coins) {
      if (c.taken) continue;
      if (Math.abs(c.at - r.s) < 0.85 && Math.abs(c.lat - r.lateral) < 0.85 && r.y < 1.2) {
        c.taken = true;
        r.coins += 1;
        onCoin();
      }
    }
  }

  const pose = poseAt(track, r.s);
  r.bodyYaw = pose.yaw + r.lean;
}

function rank(sim: Sim) {
  const active = sim.runners.filter((r) => !r.eliminated);
  active.sort((a, b) => {
    const ad = a.state === "done" ? 0 : 1;
    const bd = b.state === "done" ? 0 : 1;
    if (ad !== bd) return ad - bd;
    if (a.state === "done" && b.state === "done") return a.finishTime - b.finishTime;
    return b.s - a.s;
  });
  active.forEach((r, i) => {
    r.place = i + 1;
  });
  // Eliminated runners keep the place they were cut in (4th, then 3rd …).
}

function finishPayload(sim: Sim, eliminated: boolean): FinishPayload {
  return {
    place: sim.player.place,
    time: eliminated ? sim.time : sim.player.finishTime,
    pickups: sim.player.coins,
    tumbles: sim.player.tumbles,
    levelId: sim.level.id,
    mode: sim.mode,
    eliminated,
    standings: sim.runners
      .map((runner) => ({
        name: runner.name,
        place: runner.place,
        time: runner.finishTime,
        done: runner.state === "done",
        eliminated: runner.eliminated,
        me: runner.isPlayer,
        color: runner.color,
        s: runner.s,
        tumbles: runner.tumbles,
      }))
      .sort((a, b) => a.place - b.place),
  };
}

/** Cut the last active runner each time the player reaches a gate. */
function checkEliminationGate(sim: Sim, cb: { onFinish: (p: FinishPayload) => void }) {
  if (sim.mode !== "elimination" || sim.player.state === "done") return false;
  while (sim.gateIndex < sim.gates.length && sim.player.s >= sim.gates[sim.gateIndex]) {
    const gate = sim.gates[sim.gateIndex];
    sim.gateIndex += 1;
    const active = sim.runners.filter(
      (r) => !r.eliminated && r.state !== "done" && r.state !== "out",
    );
    if (active.length <= 1) continue;
    active.sort((a, b) => a.s - b.s);
    const victim = active[0];
    victim.eliminated = true;
    victim.state = "out";
    victim.place = active.length;
    victim.finishTime = sim.time;
    victim.speed = 0;
    victim.y = 0;
    victim.vy = 0;
    sim.lastCut = { name: victim.name, t: sim.time, me: victim.isPlayer };
    sim.shake = Math.max(sim.shake, 0.42);
    rank(sim);
    if (victim.isPlayer) {
      sim.phase = "done";
      cb.onFinish(finishPayload(sim, true));
      return true;
    }
    // A little visual punctuation at the gate the pack just crossed.
    void gate;
  }
  return false;
}

export function hintFor(sim: Sim) {
  const r = sim.player;
  if (sim.phase !== "race" || r.state === "done") return "";
  if (sim.countdown > 0) return "";
  if (r.state === "out") return "Eliminated";
  if (sim.mode === "elimination") {
    const gate = sim.gates[sim.gateIndex];
    if (gate != null) {
      const dist = gate - r.s;
      const last = r.place === sim.runners.length;
      if (dist > 0 && dist < 12 && last) return "Last place — sprint!";
      if (dist > 0 && dist < 9 && !last) return "Elimination gate";
    }
  }
  if (r.state === "tumble") return "Back to the arch";
  if (r.state === "air") return "Hang on";
  const hole = gapAhead(sim.level.track, r.s);
  if (hole && hole.length > 0 && hole.start - r.s < 7 && hole.start > r.s) {
    const range = jumpRange(r.speed);
    if (range < hole.length && hole.start - r.s < 5) return "Get a run-up";
  }
  for (const h of sim.level.hazards) {
    const dist = h.at - r.s;
    if (dist < 0 || dist > 6) continue;
    const eta = r.speed > 1 ? dist / r.speed : 0.4;
    if (eta > 0.7) continue;
    const future = sim.time + Math.max(0.05, eta);
    if (hitsHazard(h, future, h.at, r.lateral, 1.05)) {
      const safe = safeLat(h, future, r.lateral);
      const slides = h.kind === "bar" || h.kind === "saw" || h.kind === "rotor" || h.kind === "pusher" || h.kind === "ball";
      if (safe != null && Math.abs(safe - r.lateral) > 0.45 && slides) {
        return safe < r.lateral ? "Slide left" : "Slide right";
      }
      if (r.speed > 2) return "Release";
    }
  }
  if (r.speed < 1.2) return "Hold to run";
  return "";
}

export function stepSim(
  sim: Sim,
  dt: number,
  input: InputState,
  cb: { onCoin: () => void; onHit: () => void; onFinish: (p: FinishPayload) => void },
) {
  if (sim.phase !== "race" || sim.paused) {
    const pose = poseAt(sim.level.track, sim.player.s);
    sim.player.bodyYaw = pose.yaw + sim.player.lean;
    return;
  }
  if (sim.countdown > 0) {
    sim.countdown = Math.max(0, sim.countdown - dt);
    const pose = poseAt(sim.level.track, sim.player.s);
    sim.player.bodyYaw = pose.yaw + sim.player.lean;
    sim.player.anim += dt * 2.2;
    return;
  }
  sim.time += dt;
  const wasDone = sim.player.state === "done";
  for (const r of sim.runners) {
    integrate(sim, r, dt, input, cb.onCoin, cb.onHit);
  }
  rank(sim);
  if (!wasDone && checkEliminationGate(sim, cb)) return;
  if (sim.phase !== "race") return;
  if (!wasDone && sim.player.state === "done") {
    cb.onFinish(finishPayload(sim, false));
    sim.phase = "done";
  }
}

export function loadLevel(
  sim: Sim,
  levelOrId: number | Level,
  color: string,
  phase: "menu" | "race",
  mode: RaceMode = "classic",
  emote = "bounce",
) {
  const gen = sim.gen + 1;
  const next = createSim(levelOrId, mode, emote);
  next.player.color = color;
  next.phase = phase;
  next.gen = gen;
  if (phase === "race") {
    next.countdown = 3.0;
    for (const b of next.runners) {
      if (!b.isPlayer) b.speed = b.maxSpeed * 0.92;
    }
  }
  Object.assign(sim, next);
}

export function setPaused(sim: Sim, paused: boolean) {
  sim.paused = paused;
}

export function hudOf(sim: Sim): HudPayload {
  return {
    place: sim.player.place,
    total: sim.runners.length,
    s: sim.player.s,
    length: sim.level.track.length,
    time: sim.time,
    countdown: sim.countdown,
    speed: sim.player.speed,
    maxSpeed: PLAYER_SPEED,
    hint: hintFor(sim),
    name: sim.level.name,
    levelId: sim.level.id,
    pickups: sim.player.coins,
    mode: sim.mode,
    gate: sim.gateIndex < sim.gates.length ? sim.gates[sim.gateIndex] : null,
    alive: sim.runners.filter((r) => !r.eliminated).length,
    lastCut: sim.lastCut,
    rivals: sim.runners.map((r) => ({
      name: r.name,
      s: r.s,
      color: r.color,
      me: r.isPlayer,
      done: r.state === "done",
      eliminated: r.eliminated,
    })),
  };
}

export function menuLineup(sim: Sim) {
  const level = sim.level;
  sim.runners[0].s = 0;
  sim.runners[0].lateral = 0;
  sim.runners[0].speed = 0;
  level.bots.forEach((b, i) => {
    const r = sim.runners[i + 1];
    if (!r) return;
    r.s = Math.min(level.track.length * 0.08, b.s);
    r.lateral = b.lat;
    r.speed = 0;
    r.state = "run";
  });
}

export type { Hazard };
