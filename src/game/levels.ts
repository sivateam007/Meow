import { HAZARD_LABEL, SIDED_KINDS, type Hazard, type HazardKind } from "@/game/hazards";
import { buildTrack, deckAt, type Module, type TrackData } from "@/game/track";

export type BotSpec = {
  name: string;
  speed: number;
  mistake: number;
  reaction: number;
  color: string;
  lat: number;
  s: number;
};

export type Level = {
  id: number;
  name: string;
  blurb: string;
  tags: string[];
  track: TrackData;
  hazards: Hazard[];
  checkpoints: number[];
  coins: { at: number; lat: number }[];
  bots: BotSpec[];
};

type HazardSpec = {
  kind: HazardKind;
  at: number;
  period: number;
  phase?: number;
  side?: 1 | -1;
};

type Spec = {
  name: string;
  blurb: string;
  modules: Module[];
  hazards: HazardSpec[];
};

const ROSTER = ["Zip", "Boing", "Nibs", "Tuck", "Momo", "Pips", "Kip", "Rolo"];
const RIVAL_COLORS = ["#ff4d6d", "#3db7ff", "#1fce93"];
const LANES = [-1.4, 1.3, 0.2, -0.9, 1.6, -1.7, 0.7, 1.1];

/** Rivals get faster, sharper and steadier as the tour progresses. */
function botPack(levelIndex: number): BotSpec[] {
  const i = levelIndex;
  const speed = Math.min(13.55, 10.1 + i * 0.17);
  const mistake = Math.max(0.028, 0.17 - i * 0.0055);
  const reaction = Math.max(0.07, 0.2 - i * 0.0055);
  return [0, 1, 2].map((k) => ({
    name: ROSTER[(levelIndex + k) % ROSTER.length],
    speed: Number(Math.min(13.85, speed + k * 0.55).toFixed(2)),
    mistake: Number(Math.max(0.02, mistake - k * 0.03).toFixed(3)),
    reaction: Number(Math.max(0.06, reaction - k * 0.03).toFixed(3)),
    color: RIVAL_COLORS[k],
    lat: LANES[(levelIndex + k * 3) % LANES.length],
    s: 2.2 + k * 1.5,
  }));
}

const S = (len: number): Module => ({ t: "straight", len });
const T = (deg: number, radius: number): Module => ({ t: "turn", deg, radius });
const G = (len: number): Module => ({ t: "gap", len });
const R = (len: number, rise: number): Module => ({ t: "ramp", len, rise });

const SPECS: Spec[] = [
  {
    name: "Dock Dash",
    blurb: "Learn the hold. Let the hammer swing past.",
    modules: [S(26), S(18), T(28, 18), S(22), T(-36, 16), S(24)],
    hazards: [
      { kind: "hammer", at: 0.1, period: 2.5, side: 1, phase: 0.1 },
      { kind: "hammer", at: 0.28, period: 2.2, side: -1, phase: 0.45 },
      { kind: "rotor", at: 0.48, period: 2.8, phase: 0.2 },
      { kind: "hammer", at: 0.68, period: 2.0, side: 1, phase: 0.7 },
      { kind: "crusher", at: 0.86, period: 2.6, phase: 0.15 },
    ],
  },
  {
    name: "Hammer Lane",
    blurb: "Alternating mallets. Don't camp the edge.",
    modules: [S(20), T(40, 14), S(18), S(16), T(-48, 13), S(22), S(16)],
    hazards: [
      { kind: "hammer", at: 0.12, period: 2.1, side: 1 },
      { kind: "hammer", at: 0.26, period: 1.85, side: -1, phase: 0.4 },
      { kind: "saw", at: 0.4, period: 2.3, phase: 0.2 },
      { kind: "hammer", at: 0.55, period: 1.7, side: 1, phase: 0.15 },
      { kind: "hammer", at: 0.7, period: 1.6, side: -1, phase: 0.55 },
      { kind: "rotor", at: 0.86, period: 2.2, phase: 0.3 },
    ],
  },
  {
    name: "Side Gates",
    blurb: "The gap slides. Match it, then commit.",
    modules: [S(18), S(16), T(-32, 16), S(20), T(42, 14), S(22), S(14)],
    hazards: [
      { kind: "bar", at: 0.12, period: 2.4, phase: 0 },
      { kind: "saw", at: 0.26, period: 2.1, phase: 0.3 },
      { kind: "bar", at: 0.4, period: 2.15, phase: 0.5 },
      { kind: "hammer", at: 0.54, period: 1.9, side: -1, phase: 0.2 },
      { kind: "bar", at: 0.68, period: 1.9, phase: 0.15 },
      { kind: "saw", at: 0.84, period: 1.8, phase: 0.6 },
    ],
  },
  {
    name: "Gap Run",
    blurb: "Build speed before the hole. A dead stop will not clear it.",
    modules: [S(18), G(4.2), S(16), T(34, 15), S(12), G(4.8), S(16), G(4.4), S(18)],
    hazards: [
      { kind: "crusher", at: 0.22, period: 2.3, phase: 0.1 },
      { kind: "rotor", at: 0.4, period: 2.2, phase: 0.35 },
      { kind: "hammer", at: 0.58, period: 1.8, side: 1, phase: 0.5 },
      { kind: "crusher", at: 0.78, period: 2.05, phase: 0.2 },
    ],
  },
  {
    name: "Crusher Curve",
    blurb: "Turns hide the slam. Watch the block, not the rivals.",
    modules: [S(14), T(55, 12), S(14), T(-60, 12), S(16), R(10, 1.6), S(14), R(10, -1.6), S(16)],
    hazards: [
      { kind: "crusher", at: 0.1, period: 2.1, phase: 0 },
      { kind: "hammer", at: 0.24, period: 1.7, side: -1, phase: 0.25 },
      { kind: "bar", at: 0.38, period: 1.95, phase: 0.4 },
      { kind: "crusher", at: 0.52, period: 1.85, phase: 0.15 },
      { kind: "rotor", at: 0.66, period: 1.9, phase: 0.5 },
      { kind: "hammer", at: 0.8, period: 1.55, side: 1, phase: 0.33 },
      { kind: "saw", at: 0.92, period: 1.7, phase: 0.1 },
    ],
  },
  {
    name: "Rotor Yard",
    blurb: "Bars spin through the lane. Slip the side or wait for the slot.",
    modules: [S(16), S(14), G(5), S(16), T(48, 13), S(16), T(-40, 14), S(18)],
    hazards: [
      { kind: "rotor", at: 0.1, period: 2.0, phase: 0 },
      { kind: "rotor", at: 0.24, period: 1.7, phase: 0.45 },
      { kind: "saw", at: 0.4, period: 1.75, phase: 0.2 },
      { kind: "rotor", at: 0.56, period: 1.55, phase: 0.3 },
      { kind: "bar", at: 0.7, period: 1.8, phase: 0.1 },
      { kind: "crusher", at: 0.84, period: 1.7, phase: 0.55 },
    ],
  },
  {
    name: "High Switch",
    blurb: "Climb, drop, and don't brake on the lip.",
    modules: [S(14), R(12, 2.4), S(12), G(5.2), S(12), T(-50, 12), S(12), R(12, -2.4), G(4.6), S(14), T(36, 14), S(16)],
    hazards: [
      { kind: "hammer", at: 0.08, period: 1.7, side: 1, phase: 0.2 },
      { kind: "bar", at: 0.2, period: 1.85, phase: 0.4 },
      { kind: "crusher", at: 0.36, period: 1.7, phase: 0.1 },
      { kind: "saw", at: 0.5, period: 1.6, phase: 0.55 },
      { kind: "rotor", at: 0.64, period: 1.55, phase: 0.25 },
      { kind: "hammer", at: 0.78, period: 1.45, side: -1, phase: 0.66 },
      { kind: "bar", at: 0.9, period: 1.6, phase: 0.05 },
    ],
  },
  {
    name: "Final Riot",
    blurb: "Everything, faster. One clean run takes the flag.",
    modules: [S(16), T(32, 14), S(12), G(5.2), S(14), T(-58, 12), S(14), R(10, 2), S(12), G(5.4), S(12), R(10, -2), T(44, 13), S(18)],
    hazards: [
      { kind: "hammer", at: 0.07, period: 1.55, side: -1, phase: 0.1 },
      { kind: "bar", at: 0.16, period: 1.7, phase: 0.35 },
      { kind: "rotor", at: 0.26, period: 1.5, phase: 0.2 },
      { kind: "saw", at: 0.36, period: 1.45, phase: 0.5 },
      { kind: "crusher", at: 0.46, period: 1.55, phase: 0.15 },
      { kind: "hammer", at: 0.56, period: 1.4, side: 1, phase: 0.6 },
      { kind: "rotor", at: 0.66, period: 1.4, phase: 0.4 },
      { kind: "bar", at: 0.76, period: 1.5, phase: 0.05 },
      { kind: "crusher", at: 0.86, period: 1.45, phase: 0.28 },
      { kind: "saw", at: 0.94, period: 1.35, phase: 0.72 },
    ],
  },
  {
    name: "Saw Alley",
    blurb: "Discs skate the whole width. Read the wave, then sprint.",
    modules: [S(22), S(16), T(36, 15), S(18), S(16), T(-36, 15), S(20)],
    hazards: [
      { kind: "saw", at: 0.1, period: 2.0, phase: 0.1 },
      { kind: "saw", at: 0.24, period: 1.8, phase: 0.5 },
      { kind: "bar", at: 0.38, period: 2.0, phase: 0.25 },
      { kind: "saw", at: 0.52, period: 1.6, phase: 0.8 },
      { kind: "hammer", at: 0.66, period: 1.7, side: -1, phase: 0.3 },
      { kind: "saw", at: 0.8, period: 1.5, phase: 0.2 },
      { kind: "crusher", at: 0.92, period: 1.8, phase: 0.45 },
    ],
  },
  {
    name: "Ball Room",
    blurb: "Giant balls sweep the lane. Wait for the swing, then go.",
    modules: [S(24), S(18), T(-30, 18), S(20), S(18), T(44, 14), S(20)],
    hazards: [
      { kind: "ball", at: 0.12, period: 2.8, phase: 0.1 },
      { kind: "ball", at: 0.3, period: 2.5, side: -1, phase: 0.55 },
      { kind: "hammer", at: 0.46, period: 2.0, side: 1, phase: 0.2 },
      { kind: "ball", at: 0.62, period: 2.3, phase: 0.75 },
      { kind: "rotor", at: 0.78, period: 2.0, phase: 0.3 },
      { kind: "ball", at: 0.92, period: 2.1, side: -1, phase: 0.15 },
    ],
  },
  {
    name: "Piston Row",
    blurb: "Blocks punch across the deck. Hug the open side.",
    modules: [S(20), S(16), T(38, 14), S(18), S(16), T(-42, 14), S(18), S(14)],
    hazards: [
      { kind: "pusher", at: 0.1, period: 2.4, side: 1, phase: 0.1 },
      { kind: "pusher", at: 0.24, period: 2.2, side: -1, phase: 0.5 },
      { kind: "saw", at: 0.38, period: 1.9, phase: 0.25 },
      { kind: "pusher", at: 0.52, period: 2.0, side: 1, phase: 0.35 },
      { kind: "pusher", at: 0.66, period: 1.8, side: -1, phase: 0.7 },
      { kind: "hammer", at: 0.8, period: 1.7, side: 1, phase: 0.4 },
      { kind: "pusher", at: 0.93, period: 1.7, side: 1, phase: 0.2 },
    ],
  },
  {
    name: "Switchback",
    blurb: "Hard corners hide the trap. Brake before the bend.",
    modules: [S(14), T(64, 12), S(14), T(-64, 12), S(14), T(56, 11), S(14), T(-56, 11), S(16)],
    hazards: [
      { kind: "hammer", at: 0.12, period: 1.9, side: 1, phase: 0.2 },
      { kind: "rotor", at: 0.26, period: 1.8, phase: 0.6 },
      { kind: "ball", at: 0.4, period: 2.4, side: -1, phase: 0.3 },
      { kind: "crusher", at: 0.54, period: 1.7, phase: 0.15 },
      { kind: "saw", at: 0.68, period: 1.6, phase: 0.45 },
      { kind: "pusher", at: 0.82, period: 1.9, side: -1, phase: 0.25 },
      { kind: "hammer", at: 0.94, period: 1.5, side: -1, phase: 0.6 },
    ],
  },
  {
    name: "Long Jump",
    blurb: "Three gaps, one rhythm: sprint, launch, land, brake.",
    modules: [S(16), G(5.6), S(14), G(5.2), S(12), R(12, 2.2), S(12), G(5.8), S(14), R(10, -2.2), S(18)],
    hazards: [
      { kind: "hammer", at: 0.14, period: 2.0, side: -1, phase: 0.2 },
      { kind: "rotor", at: 0.3, period: 1.9, phase: 0.4 },
      { kind: "crusher", at: 0.46, period: 1.8, phase: 0.1 },
      { kind: "bar", at: 0.62, period: 1.8, phase: 0.55 },
      { kind: "saw", at: 0.76, period: 1.6, phase: 0.2 },
      { kind: "hammer", at: 0.9, period: 1.6, side: 1, phase: 0.35 },
    ],
  },
  {
    name: "Spin Cycle",
    blurb: "Bars everywhere. Move in the gaps between the sweeps.",
    modules: [S(18), S(16), T(40, 14), S(16), S(14), T(-40, 14), S(16), S(16)],
    hazards: [
      { kind: "rotor", at: 0.09, period: 1.9, phase: 0.1 },
      { kind: "rotor", at: 0.21, period: 1.75, phase: 0.5 },
      { kind: "rotor", at: 0.33, period: 1.6, phase: 0.25 },
      { kind: "saw", at: 0.45, period: 1.7, phase: 0.6 },
      { kind: "rotor", at: 0.57, period: 1.5, phase: 0.35 },
      { kind: "rotor", at: 0.69, period: 1.4, phase: 0.7 },
      { kind: "pusher", at: 0.81, period: 1.8, side: 1, phase: 0.3 },
      { kind: "rotor", at: 0.93, period: 1.35, phase: 0.15 },
    ],
  },
  {
    name: "Slam Alley",
    blurb: "Ceiling to floor. Time the slam or get flattened.",
    modules: [S(20), S(16), T(34, 15), S(18), S(16), T(-34, 15), S(18)],
    hazards: [
      { kind: "crusher", at: 0.1, period: 2.0, phase: 0.1 },
      { kind: "crusher", at: 0.22, period: 1.85, phase: 0.5 },
      { kind: "hammer", at: 0.36, period: 1.7, side: 1, phase: 0.3 },
      { kind: "crusher", at: 0.5, period: 1.7, phase: 0.7 },
      { kind: "crusher", at: 0.64, period: 1.6, phase: 0.15 },
      { kind: "bar", at: 0.78, period: 1.7, phase: 0.4 },
      { kind: "crusher", at: 0.92, period: 1.5, phase: 0.6 },
    ],
  },
  {
    name: "Teeter",
    blurb: "Ramps launch you into moving steel. Land facing a gap.",
    modules: [S(14), R(11, 2.0), S(10), G(5.0), S(12), R(11, -2.0), S(14), T(46, 13), S(14), G(5.2), S(16)],
    hazards: [
      { kind: "bar", at: 0.16, period: 1.9, phase: 0.2 },
      { kind: "ball", at: 0.3, period: 2.5, phase: 0.4 },
      { kind: "saw", at: 0.44, period: 1.7, phase: 0.15 },
      { kind: "pusher", at: 0.58, period: 1.9, side: -1, phase: 0.5 },
      { kind: "rotor", at: 0.72, period: 1.6, phase: 0.3 },
      { kind: "hammer", at: 0.86, period: 1.5, side: -1, phase: 0.2 },
    ],
  },
  {
    name: "Double Time",
    blurb: "Two hazards, one window. Never stop between them.",
    modules: [S(18), S(16), T(30, 16), S(16), S(14), T(-48, 13), S(18), S(16)],
    hazards: [
      { kind: "hammer", at: 0.1, period: 1.7, side: 1, phase: 0.1 },
      { kind: "ball", at: 0.17, period: 2.3, side: -1, phase: 0.6 },
      { kind: "saw", at: 0.3, period: 1.6, phase: 0.3 },
      { kind: "crusher", at: 0.38, period: 1.6, phase: 0.7 },
      { kind: "pusher", at: 0.52, period: 1.8, side: 1, phase: 0.4 },
      { kind: "rotor", at: 0.6, period: 1.5, phase: 0.2 },
      { kind: "hammer", at: 0.74, period: 1.5, side: -1, phase: 0.5 },
      { kind: "ball", at: 0.82, period: 2.1, phase: 0.25 },
      { kind: "saw", at: 0.94, period: 1.4, phase: 0.6 },
    ],
  },
  {
    name: "Tight Squeeze",
    blurb: "Pistons and saws share the same lane. Pick a side and trust it.",
    modules: [S(20), S(16), T(-36, 15), S(18), G(4.8), S(16), T(40, 15), S(18)],
    hazards: [
      { kind: "pusher", at: 0.1, period: 2.1, side: 1, phase: 0.15 },
      { kind: "saw", at: 0.2, period: 1.7, phase: 0.4 },
      { kind: "pusher", at: 0.32, period: 1.9, side: -1, phase: 0.55 },
      { kind: "saw", at: 0.44, period: 1.5, phase: 0.1 },
      { kind: "pusher", at: 0.58, period: 1.75, side: 1, phase: 0.7 },
      { kind: "bar", at: 0.7, period: 1.6, phase: 0.35 },
      { kind: "pusher", at: 0.82, period: 1.6, side: -1, phase: 0.2 },
      { kind: "saw", at: 0.94, period: 1.35, phase: 0.55 },
    ],
  },
  {
    name: "Sky Bridge",
    blurb: "A thin high road with holes in it. No room to drift.",
    modules: [S(16), R(14, 3.0), S(14), G(5.6), S(14), G(5.2), S(14), T(34, 15), S(14), G(5.6), S(14), R(14, -3.0), S(18)],
    hazards: [
      { kind: "rotor", at: 0.12, period: 1.8, phase: 0.2 },
      { kind: "hammer", at: 0.26, period: 1.7, side: 1, phase: 0.5 },
      { kind: "crusher", at: 0.4, period: 1.7, phase: 0.3 },
      { kind: "saw", at: 0.54, period: 1.5, phase: 0.7 },
      { kind: "pusher", at: 0.66, period: 1.8, side: -1, phase: 0.35 },
      { kind: "rotor", at: 0.78, period: 1.45, phase: 0.6 },
      { kind: "ball", at: 0.9, period: 2.2, phase: 0.4 },
    ],
  },
  {
    name: "Hammer Rush",
    blurb: "Twelve mallets, one lane. Hold your nerve and your line.",
    modules: [S(24), S(18), T(30, 17), S(20), S(18), T(-30, 17), S(22)],
    hazards: [
      { kind: "hammer", at: 0.08, period: 1.6, side: 1, phase: 0.1 },
      { kind: "hammer", at: 0.17, period: 1.5, side: -1, phase: 0.5 },
      { kind: "hammer", at: 0.26, period: 1.4, side: 1, phase: 0.3 },
      { kind: "hammer", at: 0.36, period: 1.3, side: -1, phase: 0.7 },
      { kind: "hammer", at: 0.46, period: 1.45, side: 1, phase: 0.2 },
      { kind: "hammer", at: 0.56, period: 1.35, side: -1, phase: 0.6 },
      { kind: "hammer", at: 0.66, period: 1.3, side: 1, phase: 0.45 },
      { kind: "hammer", at: 0.76, period: 1.25, side: -1, phase: 0.15 },
      { kind: "hammer", at: 0.86, period: 1.2, side: 1, phase: 0.8 },
      { kind: "hammer", at: 0.95, period: 1.15, side: -1, phase: 0.35 },
    ],
  },
  {
    name: "Gauntlet",
    blurb: "Every trap in the book, strung together.",
    modules: [S(16), T(36, 14), S(14), G(5.0), S(16), T(-36, 14), S(14), R(10, 1.8), S(16), G(5.0), S(18)],
    hazards: [
      { kind: "hammer", at: 0.08, period: 1.6, side: -1, phase: 0.2 },
      { kind: "saw", at: 0.18, period: 1.5, phase: 0.5 },
      { kind: "pusher", at: 0.28, period: 1.8, side: 1, phase: 0.3 },
      { kind: "rotor", at: 0.38, period: 1.5, phase: 0.65 },
      { kind: "ball", at: 0.5, period: 2.2, phase: 0.3 },
      { kind: "crusher", at: 0.6, period: 1.5, phase: 0.75 },
      { kind: "bar", at: 0.7, period: 1.5, phase: 0.2 },
      { kind: "hammer", at: 0.8, period: 1.4, side: 1, phase: 0.55 },
      { kind: "saw", at: 0.9, period: 1.3, phase: 0.15 },
      { kind: "pusher", at: 0.97, period: 1.6, side: -1, phase: 0.4 },
    ],
  },
  {
    name: "Twisted",
    blurb: "You can't see the next trap until you're in the turn.",
    modules: [T(70, 12), S(12), T(-70, 12), S(12), T(64, 11), S(12), T(-64, 11), S(12), T(58, 11), S(14), T(-58, 11), S(16)],
    hazards: [
      { kind: "hammer", at: 0.1, period: 1.6, side: 1, phase: 0.25 },
      { kind: "rotor", at: 0.2, period: 1.5, phase: 0.4 },
      { kind: "saw", at: 0.3, period: 1.5, phase: 0.7 },
      { kind: "ball", at: 0.42, period: 2.2, side: -1, phase: 0.2 },
      { kind: "crusher", at: 0.52, period: 1.5, phase: 0.5 },
      { kind: "pusher", at: 0.62, period: 1.7, side: 1, phase: 0.15 },
      { kind: "bar", at: 0.72, period: 1.4, phase: 0.6 },
      { kind: "hammer", at: 0.82, period: 1.35, side: -1, phase: 0.3 },
      { kind: "saw", at: 0.93, period: 1.3, phase: 0.45 },
    ],
  },
  {
    name: "Skyline Sprint",
    blurb: "Long straights, full throttle, split-second brakes.",
    modules: [S(30), T(44, 18), S(26), T(-44, 18), S(26), G(5.4), S(24)],
    hazards: [
      { kind: "pusher", at: 0.1, period: 2.0, side: 1, phase: 0.1 },
      { kind: "hammer", at: 0.2, period: 1.6, side: -1, phase: 0.45 },
      { kind: "saw", at: 0.3, period: 1.5, phase: 0.2 },
      { kind: "rotor", at: 0.4, period: 1.5, phase: 0.6 },
      { kind: "crusher", at: 0.5, period: 1.5, phase: 0.3 },
      { kind: "ball", at: 0.6, period: 2.2, phase: 0.5 },
      { kind: "bar", at: 0.7, period: 1.4, phase: 0.15 },
      { kind: "hammer", at: 0.8, period: 1.4, side: 1, phase: 0.7 },
      { kind: "pusher", at: 0.9, period: 1.6, side: -1, phase: 0.25 },
      { kind: "saw", at: 0.97, period: 1.3, phase: 0.4 },
    ],
  },
  {
    name: "Grand Final",
    blurb: "The whole riot at race pace. Take the flag and be done.",
    modules: [
      S(16), T(40, 13), S(12), G(5.4), S(14), T(-46, 13), S(12), R(11, 2.4), S(12), G(5.6),
      S(14), T(52, 12), S(12), R(11, -2.4), S(14), T(-40, 14), S(16), G(5.2), S(18),
    ],
    hazards: [
      { kind: "hammer", at: 0.05, period: 1.45, side: 1, phase: 0.15 },
      { kind: "saw", at: 0.12, period: 1.35, phase: 0.4 },
      { kind: "rotor", at: 0.19, period: 1.35, phase: 0.7 },
      { kind: "pusher", at: 0.26, period: 1.6, side: -1, phase: 0.2 },
      { kind: "crusher", at: 0.33, period: 1.4, phase: 0.55 },
      { kind: "ball", at: 0.41, period: 2.1, phase: 0.3 },
      { kind: "hammer", at: 0.48, period: 1.3, side: -1, phase: 0.6 },
      { kind: "bar", at: 0.55, period: 1.35, phase: 0.1 },
      { kind: "saw", at: 0.62, period: 1.3, phase: 0.6 },
      { kind: "rotor", at: 0.69, period: 1.3, phase: 0.25 },
      { kind: "pusher", at: 0.76, period: 1.5, side: 1, phase: 0.45 },
      { kind: "crusher", at: 0.83, period: 1.35, phase: 0.8 },
      { kind: "hammer", at: 0.9, period: 1.25, side: 1, phase: 0.3 },
      { kind: "saw", at: 0.97, period: 1.2, phase: 0.5 },
    ],
  },
];

/* -------------------------------------------------------------------------
 * Endless tour
 *
 * The handcrafted 22 are the tutorial + first cup. After that the tour keeps
 * going with deterministic, difficulty-scaled courses so there is always a
 * next track to chase — the same long-tail progression as the original.
 * ---------------------------------------------------------------------- */

const GEN_A = [
  "Neon", "Turbo", "Candy", "Sky", "Rocket", "Lucky", "Frost", "Sunset",
  "Comet", "Jelly", "Bolt", "Pixel", "Cloud", "Pepper", "Mint", "Tango",
  "Rumble", "Zigzag", "Bubble", "Velvet",
];
const GEN_B = [
  "Sprint", "Switchback", "Loop", "Dash", "Climb", "Chase", "Rush",
  "Junction", "Drop", "Circuit", "Carnival", "Tunnel", "Crossover", "Run",
  "Canyon", "Parkour", "Corkscrew", "Mile", "Bounce", "Riot",
];
const GEN_BLURBS = [
  "New deck, new trap pattern. Find the rhythm.",
  "The tour keeps climbing. So does the pace.",
  "One clean line is worth ten risky ones.",
  "The pack is faster here. Do not give them a gap.",
  "Every arch is a second chance. Every gate is a decision.",
  "Read the steel, pick a lane, commit.",
  "Long way round or straight through? Both are on the clock.",
  "Fast feet, quiet hands. Take the flag.",
  "The course has teeth now. Show it yours.",
  "Hold the throttle a beat longer than feels safe.",
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function generatedSpecs(count: number): Spec[] {
  const out: Spec[] = [];
  const used = new Set(SPECS.map((s) => s.name));
  const kinds: HazardKind[] = ["hammer", "saw", "rotor", "pusher", "bar", "crusher", "ball", "laser", "spinner", "bounce"];
  for (let n = 0; n < count; n++) {
    const id = SPECS.length + n;
    const r = rng(9173 + id * 7919);
    const modules: Module[] = [S(14 + Math.floor(r() * 9))];
    const segments = 5 + Math.floor(r() * 5);
    for (let i = 0; i < segments; i++) {
      const pick = r();
      if (pick < 0.34) modules.push(S(9 + Math.floor(r() * 14)));
      else if (pick < 0.62) modules.push(T((r() < 0.5 ? -1 : 1) * (32 + Math.floor(r() * 36)), 11 + Math.floor(r() * 8)));
      else if (pick < 0.8) modules.push(G(4.4 + r() * 1.35));
      else modules.push(R(9 + Math.floor(r() * 5), (r() < 0.5 ? -1 : 1) * (1.8 + r() * 1.5)));
    }
    modules.push(S(16 + Math.floor(r() * 12)));

    const hazardCount = Math.min(13, 7 + Math.floor(id / 14));
    const hazards: HazardSpec[] = [];
    for (let k = 0; k < hazardCount; k++) {
      const kind = kinds[(id + k * 3) % kinds.length];
      const period = Math.max(1.12, 2.25 - id * 0.0085 + (r() - 0.5) * 0.24);
      const at = Math.min(0.96, 0.075 + (k / Math.max(1, hazardCount - 1)) * 0.87 + (r() - 0.5) * 0.014);
      const phase = r();
      if (kind === "hammer" || kind === "ball" || kind === "pusher") {
        hazards.push({ kind, at, period, phase, side: r() < 0.5 ? 1 : -1 });
      } else {
        hazards.push({ kind, at, period, phase });
      }
    }

    let name = `${GEN_A[(id * 7 + 3) % GEN_A.length]} ${GEN_B[(id * 11 + 5) % GEN_B.length]}`;
    if (used.has(name)) name = `${name} ${Math.floor(id / GEN_A.length) + 1}`;
    while (used.has(name)) name = `${name}*`;
    used.add(name);

    out.push({
      name,
      blurb: GEN_BLURBS[id % GEN_BLURBS.length],
      modules,
      hazards,
    });
  }
  return out;
}

const ALL_SPECS: Spec[] = [...SPECS, ...generatedSpecs(976)];

function nearHazard(hazards: Hazard[], s: number, pad: number) {
  return hazards.some((h) => Math.abs(h.at - s) < pad);
}

function makeHazard(h: HazardSpec, at: number): Hazard {
  if (h.kind === "hammer" || h.kind === "ball" || h.kind === "pusher") {
    return {
      kind: h.kind,
      at,
      period: h.period,
      phase: h.phase ?? 0,
      side: h.side ?? 1,
    } as Hazard;
  }
  return { kind: h.kind, at, period: h.period, phase: h.phase ?? 0 } as Hazard;
}

function assembleLevel(id: number, spec: Spec): Level {
  const track = buildTrack(spec.modules);
  const hazards: Hazard[] = [];
  for (const h of spec.hazards) {
    let at = h.at * track.length;
    let guard = 0;
    while (guard < 24 && !deckAt(track, at)) {
      at = Math.min(track.length - 2, at + 0.8);
      guard++;
    }
    if (!deckAt(track, at) || at < 4 || at > track.length - 3) continue;
    hazards.push(makeHazard(h, at));
  }

  const checkpoints = [0];
  for (let s = 22; s < track.length - 10; s += 26) {
    if (deckAt(track, s)) checkpoints.push(s);
  }
  for (let s = 6; s < track.length - 4; s += 0.4) {
    if (deckAt(track, s) && !deckAt(track, s + 0.8)) {
      const c = Math.max(0, s - 2.4);
      if (deckAt(track, c)) checkpoints.push(c);
    }
  }
  checkpoints.sort((a, b) => a - b);
  // A checkpoint is a respawn point: never leave it on a gap or inside a
  // hazard's hit box, or a wipeout turns into a loop of instant re-wipeouts.
  const clear = (pos: number) =>
    pos >= 1.5 && deckAt(track, pos) && !hazards.some((h) => Math.abs(h.at - pos) < 3.6);
  const moved = checkpoints.map((c) => {
    if (clear(c)) return c;
    for (let step = 1; step <= 8; step++) if (clear(c - step * 1.1)) return c - step * 1.1;
    for (let step = 1; step <= 8; step++) if (clear(c + step * 1.1)) return c + step * 1.1;
    return c;
  });
  moved.sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const c of moved) {
    if (uniq.length === 0 || c - uniq[uniq.length - 1] > 6) uniq.push(c);
  }

  const coins: { at: number; lat: number }[] = [];
  let n = 0;
  for (let s = 5; s < track.length - 4; s += 5.5) {
    if (!deckAt(track, s)) continue;
    if (nearHazard(hazards, s, 1.8)) continue;
    if (n % 5 === 4) {
      coins.push({ at: s, lat: -1.3 }, { at: s + 0.1, lat: 0 }, { at: s + 0.2, lat: 1.3 });
    } else {
      coins.push({ at: s, lat: ((n % 3) - 1) * 1.25 });
    }
    n++;
  }

  const tags = [...new Set(spec.hazards.map((h) => HAZARD_LABEL[h.kind]))];

  return {
    id,
    name: spec.name,
    blurb: spec.blurb,
    tags,
    track,
    hazards,
    checkpoints: uniq,
    coins,
    bots: botPack(id),
  };
}

export function buildLevels(): Level[] {
  return ALL_SPECS.map((spec, id) => assembleLevel(id, spec));
}

export const LEVELS = buildLevels();

export const CUSTOM_LEVEL_ID = 1000;
export const ENDLESS_LEVEL_ID = 1001;

/** Endless Mode: a very long course that never truly ends. */
export function makeEndlessLevel(): Level {
  const modules: Module[] = [S(14)];
  // Generate a long, winding course by repeating random segments.
  const r = rng(7777);
  const segCount = 40;
  for (let i = 0; i < segCount; i++) {
    const rv = r();
    if (rv < 0.3) modules.push(S(12 + Math.floor(r() * 10)));
    else if (rv < 0.5) modules.push(T((r() < 0.5 ? 1 : -1) * (30 + Math.floor(r() * 30)), 12 + Math.floor(r() * 4)));
    else if (rv < 0.65) modules.push(G(4 + r() * 2));
    else if (rv < 0.8) modules.push(R(10 + Math.floor(r() * 4), 1.5 + r() * 1.5));
    else modules.push(S(10 + Math.floor(r() * 8)));
  }
  modules.push(S(18));

  const kinds: HazardKind[] = ["hammer", "saw", "rotor", "pusher", "bar", "crusher", "ball", "laser", "spinner", "bounce"];
  const hazards: HazardSpec[] = [];
  const count = Math.max(30, Math.min(60, segCount));
  for (let k = 0; k < count; k++) {
    const kind = kinds[(k * 7 + 3) % kinds.length];
    const at = 0.05 + (k / Math.max(1, count - 1)) * 0.92;
    const period = Math.max(1.1, 2.0 - k * 0.01);
    if (kind === "hammer" || kind === "ball" || kind === "pusher") {
      hazards.push({ kind, at, period, phase: (k * 0.17) % 1, side: k % 2 === 0 ? 1 : -1 });
    } else {
      hazards.push({ kind, at, period, phase: (k * 0.17) % 1 });
    }
  }

  const level = assembleLevel(ENDLESS_LEVEL_ID, {
    name: "Endless Run",
    blurb: "Run forever. The course never ends. How far can you go?",
    modules,
    hazards,
  });
  // Override the level id to ENDLESS_LEVEL_ID
  level.id = ENDLESS_LEVEL_ID;
  return level;
}

/** Fun City: turn the player's tile list into a real, hazard-filled course. */
export function makeCustomLevel(tiles: string[]): Level {
  const modules: Module[] = [S(14)];
  for (const tile of tiles) {
    if (tile === "left") modules.push(T(40, 13));
    else if (tile === "right") modules.push(T(-40, 13));
    else if (tile === "gap") modules.push(G(5));
    else if (tile === "ramp") modules.push(R(12, 2.2));
    else modules.push(S(15));
  }
  modules.push(S(18));

  const kinds: HazardKind[] = ["hammer", "saw", "rotor", "pusher", "bar", "crusher", "ball", "laser", "spinner", "bounce"];
  const hazards: HazardSpec[] = [];
  const count = Math.max(6, Math.min(12, Math.round(tiles.length * 0.9) + 3));
  for (let k = 0; k < count; k++) {
    const kind = kinds[(k + tiles.length) % kinds.length];
    const at = 0.12 + (k / Math.max(1, count - 1)) * 0.8;
    const period = Math.max(1.25, 2.1 - k * 0.045);
    if (kind === "hammer" || kind === "ball" || kind === "pusher") {
      hazards.push({ kind, at, period, phase: (k * 0.27) % 1, side: k % 2 === 0 ? 1 : -1 });
    } else {
      hazards.push({ kind, at, period, phase: (k * 0.27) % 1 });
    }
  }

  return assembleLevel(CUSTOM_LEVEL_ID, {
    name: "Fun City",
    blurb: "Your course, your rules. Race it as often as you like.",
    modules,
    hazards,
  });
}

/** Kinds that hang off a side post — kept next to the specs that use them. */
export const SIDE_POSTED = SIDED_KINDS;
