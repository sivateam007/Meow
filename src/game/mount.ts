import { createAudio } from "@/game/audio";
import type { Level } from "@/game/levels";
import {
  hudOf,
  loadLevel,
  makeInput,
  setPaused as pauseSim,
  stepSim,
  createSim,
  type FinishPayload,
  type HudPayload,
  type RaceMode,
} from "@/game/sim";
import { createWorld } from "@/game/world";
import { deckAt, gapAhead } from "@/game/track";

export type StartOptions = {
  color: string;
  mode?: RaceMode;
  emote?: string;
  hat?: string;
};

export type PreviewOptions = {
  color: string;
  emote?: string;
  hat?: string;
};

export type GameApi = {
  start: (level: number | Level, options: StartOptions) => void;
  preview: (level: number | Level, options: PreviewOptions) => void;
  setColor: (color: string) => void;
  setHat: (hat: string) => void;
  setBuild: (build: string) => void;
  setEmote: (emote: string) => void;
  setPaused: (paused: boolean) => void;
  setMuted: (muted: boolean) => void;
  unlock: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      setSteer: (v: number) => void;
    };
    __dashDebug?: () => {
      phase: string;
      time: number;
      runners: { name: string; s: number; speed: number; state: string; place: number; tumbles: number; lat: number }[];
    };
    __worldSample?: () => { withSky: number[][]; noSky: number[][] };
    __trackScan?: () => { length: number; holes: { start: number; end: number; len: number }[]; playerS: number };
    __worldDebug?: () => {
      cam: number[];
      aspect: number;
      look: number[];
      levelChildren: number;
      firstTypes: string[];
      meshes: number;
      visible: number;
      builtGen: number;
      buf: number[];
      render: { calls: number; triangles: number; points: number; lines: number };
      trackMesh: {
        verts: number;
        bbox: number[][] | null;
        visible: boolean;
        matVisible: boolean;
      } | null;
      cats: { v: boolean; p: number[] }[];
    };
  }
}

export function mountGame(
  canvas: HTMLCanvasElement,
  hooks: {
    onHud: (hud: HudPayload) => void;
    onCoin: () => void;
    onFinish: (payload: FinishPayload) => void;
    onHit: () => void;
  },
): GameApi {
  const input = makeInput();
  const sim = createSim(0);
  const world = createWorld(canvas);
  const audio = createAudio();
  const held = new Set<number>();
  const steerPointers = new Map<number, number>();
  let elapsed = 0;
  let last = performance.now();
  let acc = 0;
  let hudAcc = 0;
  let foot = 0;
  let lastBeep = -1;
  let alive = true;
  let raf = 0;

  window.__controlsTest = {
    getYaw: () => sim.player.bodyYaw,
    getSpeed: () => sim.player.speed,
    setKeys: (codes: string[]) => {
      input.keys = new Set(codes);
    },
    setSteer: (v: number) => {
      input.probeSteer = v;
    },
  };
  window.__worldDebug = () => world.debug();
  window.__worldSample = () => world.sample();
  window.__trackScan = () => {
    const track = sim.level.track;
    const holes: { start: number; end: number; len: number }[] = [];
    let x = 0;
    while (x < Math.min(track.length, 120)) {
      if (!deckAt(track, x)) {
        const start = x;
        while (x < track.length && !deckAt(track, x)) x += 0.15;
        holes.push({ start: Number(start.toFixed(2)), end: Number(x.toFixed(2)), len: Number((x - start).toFixed(2)) });
      } else x += 0.15;
    }
    return { length: Number(track.length.toFixed(1)), holes, playerS: Number(sim.player.s.toFixed(2)) };
  };
  window.__dashDebug = () => ({
    phase: sim.phase,
    time: sim.time,
    mode: sim.mode,
    length: sim.level.track.length,
    checkpoints: sim.level.checkpoints,
    gates: sim.gates,
    modeLevel: sim.level.id,
    nearHazards: sim.level.hazards
      .filter((h: any) => Math.abs(h.at - sim.player.s) < 14)
      .map((h: any) => ({ kind: h.kind, at: Number(h.at.toFixed(2)) })),
    runners: sim.runners.map((r) => ({
      name: r.name,
      s: Number(r.s.toFixed(2)),
      speed: Number(r.speed.toFixed(2)),
      state: r.state,
      place: r.place,
      tumbles: r.tumbles,
      lat: Number(r.lateral.toFixed(2)),
      y: Number((r.y ?? 0).toFixed(2)),
      lean: Number((r.lean ?? 0).toFixed(2)),
    })),
  });

  const steerOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest("[data-steer]") : null;

  const isUi = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest("[data-ui]") && !steerOf(target);

  /** Last contact X per pointer — swipe steering reads real deltas, not
   *  `movementX`, which many touch browsers report as 0. */
  const lastX = new Map<number, number>();
  let swipeDir = 0;
  const SWIPE_SENSITIVITY = 0.55;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    audio.unlock();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    input.keys.delete(e.code);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    audio.unlock();
    if (isUi(e.target)) return;
    lastX.set(e.pointerId, e.clientX);
    const steer = steerOf(e.target);
    if (steer) {
      // The on-screen arrows steer only — a tap to dodge must not also
      // launch you into the trap you are dodging.
      const v = Number(steer.getAttribute("data-steer")) || 0;
      steerPointers.set(e.pointerId, v);
      input.buttonSteer = v;
      return;
    }
    held.add(e.pointerId);
    input.pointers = held.size;
  };
  const onPointerUp = (e: PointerEvent) => {
    held.delete(e.pointerId);
    lastX.delete(e.pointerId);
    input.pointers = held.size;
    if (steerPointers.has(e.pointerId)) {
      steerPointers.delete(e.pointerId);
      input.buttonSteer = 0;
      for (const v of steerPointers.values()) input.buttonSteer = v;
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!held.has(e.pointerId) || steerPointers.has(e.pointerId)) return;
    const prev = lastX.get(e.pointerId);
    lastX.set(e.pointerId, e.clientX);
    if (prev == null) return;
    const dx = e.clientX - prev;
    if (Math.abs(dx) > 6) {
      swipeDir = dx > 0 ? 1 : -1;
      input.drag += dx * SWIPE_SENSITIVITY;
      input.swipeDir = swipeDir;
    }
  };
  const onBlur = () => {
    input.keys.clear();
    held.clear();
    steerPointers.clear();
    lastX.clear();
    input.pointers = 0;
    input.buttonSteer = 0;
    input.drag = 0;
  };
  const onVis = () => {
    if (document.visibilityState === "visible") audio.resume();
    else onBlur();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);

  const loop = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 5) {
      const scale = sim.hitstop > 0 ? 0.25 : 1;
      stepSim(sim, (1 / 60) * scale, input, {
        onCoin: () => {
          audio.coin();
          hooks.onCoin();
        },
        onHit: () => {
          audio.hit();
          hooks.onHit();
        },
        onFinish: (payload) => {
          if (payload.eliminated) {
            audio.place();
          } else if (payload.place === 1) {
            audio.win();
            world.celebrate(sim);
          } else audio.place();
          hooks.onFinish(payload);
        },
      });
      if (sim.hitstop > 0) sim.hitstop = Math.max(0, sim.hitstop - 1 / 60);
      // The sim only ever *sets* shake on a wipe; the frame loop owns the decay
      // so a single tumble can't leave the camera permanently jittering.
      if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - (1 / 60) * 2.2);
      acc -= 1 / 60;
      steps++;
    }
    if (steps === 5) acc = 0;

    // 3-2-1-GO stingers, driven by the fixed-step countdown.
    if (sim.phase === "race" && sim.countdown > 0) {
      const n = Math.ceil(sim.countdown);
      if (n !== lastBeep) {
        lastBeep = n;
        audio.beep();
      }
    } else if (lastBeep > 0) {
      lastBeep = -1;
      audio.go();
    }

    if (sim.phase === "race" && !sim.paused && sim.player.state === "run" && sim.player.speed > 5) {
      foot -= dt;
      if (foot <= 0) {
        audio.foot();
        foot = 0.32;
      }
    }

    world.render(sim, dt, elapsed);
    hudAcc += dt;
    if (hudAcc >= 0.1) {
      hudAcc = 0;
      hooks.onHud(hudOf(sim));
    }
    raf = requestAnimationFrame(loop);
  };

  world.resize();
  const observer = new ResizeObserver(() => world.resize());
  observer.observe(canvas);
  raf = requestAnimationFrame(loop);

  return {
    start(level, options) {
      audio.unlock();
      audio.startMusic();
      lastBeep = -1;
      world.setHat(options.hat ?? "none");
      loadLevel(sim, level, options.color, "race", options.mode ?? "classic", options.emote ?? "bounce");
      hooks.onHud(hudOf(sim));
    },
    preview(level, options) {
      world.setHat(options.hat ?? "none");
      loadLevel(sim, level, options.color, "menu", "classic", options.emote ?? "bounce");
    },
    setColor(color) {
      sim.player.color = color;
    },
    setHat(hat) {
      world.setHat(hat);
    },
    setBuild(build) {
      world.setBuild(build);
    },
    setEmote(emote) {
      sim.emote = emote;
    },
    setPaused(paused: boolean) {
      pauseSim(sim, paused);
    },
    setMuted(muted) {
      audio.setMuted(muted);
      if (!muted) audio.unlock();
    },
    unlock() {
      audio.unlock();
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      delete window.__controlsTest;
      delete window.__dashDebug;
      delete window.__worldDebug;
      delete window.__worldSample;
      audio.stopMusic();
      world.dispose();
    },
  };
}
