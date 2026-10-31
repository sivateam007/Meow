export type RecordScore = { time: number; place: number };

export type DailyState = {
  /** Last day the daily chest was claimed, as YYYY-MM-DD. */
  date: string;
  /** Consecutive claim days. */
  streak: number;
  claimed: boolean;
};

export type AchievementId =
  | "first_win"
  | "five_wins"
  | "ten_wins"
  | "twenty_five_wins"
  | "first_podium"
  | "five_podiums"
  | "clean_run"
  | "five_clean"
  | "hundred_coins"
  | "five_hundred_coins"
  | "thousand_coins"
  | "ten_races"
  | "twenty_five_races"
  | "fifty_races"
  | "first_elimination_win"
  | "three_elimination_wins"
  | "reach_racer"
  | "reach_champion"
  | "reach_legend"
  | "first_fun_city"
  | "fun_city_decor"
  | "claim_daily"
  | "claim_all_missions";

export type AchievementItem = {
  id: AchievementId;
  progress: number;
  target: number;
  reward: number;
  claimed: boolean;
};

export type AchievementState = {
  items: AchievementItem[];
};

export type MissionId = "coins" | "race" | "podium" | "clean" | "beat";

export type MissionItem = {
  id: MissionId;
  progress: number;
  target: number;
  reward: number;
  claimed: boolean;
};

export type MissionState = {
  date: string;
  items: MissionItem[];
};

export type Save = {
  version: 2;
  coins: number;
  unlocked: number;
  skin: string;
  owned: string[];
  hat: string;
  ownedHats: string[];
  emote: string;
  ownedEmotes: string[];
  records: Record<string, RecordScore>;
  muted: boolean;
  races: number;
  wins: number;
  podiums: number;
  cleanRuns: number;
  totalEarned: number;
  /** Current win streak. */
  streak: number;
  bestStreak: number;
  daily: DailyState;
  missions: MissionState;
  /** Fun City tiles, in order. */
  custom: string[];
  /** Body build/shape of the cat character. */
  build: string;
  /** Body builds the player owns. */
  ownedBuilds: string[];
  /** Achievement progress. */
  achievements: AchievementItem[];
  /** Challenge rewards already claimed (by challenge id). */
  challenges: string[];
  /** Fun City tickets banked from custom-course wins (10 tickets = 1 gem). */
  tickets: number;
  /** Fun City gems, spent on decorations. */
  gems: number;
  /** Decor the player has bought for their Fun City. */
  decor: string[];
  /** Decor stages owned; each purchase grows the city. */
  cityLevel: number;
};

const KEY = "meow-save-v2";
const V1_KEY = "meow-save-v1";
/** Pre-rename save so progress carries over from the earlier build. */
const LEGACY_KEY = "dash-riot-save-v1";

export const SKINS = [
  { id: "violet", name: "Violet", color: "#7b5cff", price: 0 },
  { id: "coral", name: "Coral", color: "#ff4d6d", price: 0 },
  { id: "mint", name: "Mint", color: "#1fce93", price: 80 },
  { id: "gold", name: "Gold", color: "#ffb020", price: 160 },
  { id: "sky", name: "Sky", color: "#3db7ff", price: 240 },
  { id: "bubblegum", name: "Bubblegum", color: "#ff8fd0", price: 320 },
  { id: "tangerine", name: "Tangerine", color: "#ff7a59", price: 400 },
  { id: "lime", name: "Lime", color: "#a9e34b", price: 480 },
  { id: "grape", name: "Grape", color: "#b197fc", price: 560 },
  { id: "mintchip", name: "Mint Chip", color: "#63e6be", price: 640 },
  { id: "bubbleblue", name: "Deep Sea", color: "#4c6ef5", price: 760 },
  { id: "rose", name: "Rose", color: "#ffa8cc", price: 900 },
  { id: "amber", name: "Amber", color: "#ffbf00", price: 1000 },
  { id: "teal", name: "Teal", color: "#20c997", price: 1100 },
  { id: "indigo", name: "Indigo", color: "#5c7cfa", price: 1250 },
  { id: "salmon", name: "Salmon", color: "#fa5252", price: 1400 },
  { id: "lavender", name: "Lavender", color: "#da77f2", price: 1600 },
  { id: "peach", name: "Peach", color: "#ffc078", price: 1800 },
  { id: "aqua", name: "Aqua", color: "#3bc9db", price: 2000 },
  { id: "midnight", name: "Midnight", color: "#364fc7", price: 2500 },
] as const;

export type SkinId = (typeof SKINS)[number]["id"];

/** Exclusive characters earned only via the 5-day daily streak (never buyable). */
export const DAILY_SKINS = [
  { id: "royal", name: "Royal", color: "#3b5bff" },
  { id: "sunset", name: "Sunset", color: "#ff6b4d" },
  { id: "neon", name: "Neon", color: "#00ffc3" },
  { id: "shadow", name: "Shadow", color: "#2b2d42" },
  { id: "candy", name: "Candy", color: "#ff5fa2" },
] as const;

export type DailySkinId = (typeof DAILY_SKINS)[number]["id"];

/** World-Race style challenges: milestone races gated by level, with coin rewards. */
export type ChallengeDef = {
  id: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  /** Unlocked once the player's highest level reaches this. */
  unlockLevel: number;
  reward: number;
  label: string;
};

export const CHALLENGES: ChallengeDef[] = [
  { id: "ch1", difficulty: "Easy", unlockLevel: 1, reward: 120, label: "Win your first race" },
  { id: "ch2", difficulty: "Easy", unlockLevel: 2, reward: 180, label: "Reach track 2" },
  { id: "ch3", difficulty: "Medium", unlockLevel: 3, reward: 280, label: "Reach track 3" },
  { id: "ch4", difficulty: "Medium", unlockLevel: 5, reward: 400, label: "Reach track 5" },
  { id: "ch5", difficulty: "Hard", unlockLevel: 8, reward: 600, label: "Reach track 8" },
  { id: "ch6", difficulty: "Hard", unlockLevel: 12, reward: 850, label: "Reach track 12" },
  { id: "ch7", difficulty: "Expert", unlockLevel: 16, reward: 1200, label: "Reach track 16" },
  { id: "ch8", difficulty: "Expert", unlockLevel: 20, reward: 1800, label: "Reach track 20" },
];

export const CHALLENGE_DIFF_COLOR: Record<ChallengeDef["difficulty"], string> = {
  Easy: "#1fce93",
  Medium: "#ffb020",
  Hard: "#ff7a59",
  Expert: "#ff4d6d",
};

export type ChallengeStatus = "locked" | "available" | "claimed";

export function challengeStatus(save: Save, ch: ChallengeDef): ChallengeStatus {
  if (save.challenges.includes(ch.id)) return "claimed";
  return save.unlocked > ch.unlockLevel ? "available" : "locked";
}

/** Claim a challenge reward. `double` mirrors the original's "Get 2x" ad bonus. */
export function claimChallenge(save: Save, id: string, double = false) {
  const ch = CHALLENGES.find((c) => c.id === id);
  if (!ch || challengeStatus(save, ch) !== "available") return { save, amount: 0 };
  const amount = ch.reward * (double ? 2 : 1);
  return {
    save: {
      ...save,
      coins: save.coins + amount,
      totalEarned: save.totalEarned + amount,
      challenges: [...save.challenges, ch.id],
    },
    amount,
  };
}

/** Every skin the locker can show: purchasable + daily-exclusive. */
export const ALL_SKINS: { id: string; name: string; color: string; price: number; daily?: true }[] = [
  ...SKINS.map((s) => ({ id: s.id as string, name: s.name as string, color: s.color as string, price: s.price as number })),
  ...DAILY_SKINS.map((s) => ({ id: s.id as string, name: s.name as string, color: s.color as string, price: 0, daily: true as const })),
];

export const HATS = [
  { id: "none", name: "No hat", price: 0, color: "#fff4e0" },
  { id: "cap", name: "Racer cap", price: 120, color: "#ff4d6d" },
  { id: "crown", name: "Gold crown", price: 300, color: "#ffb020" },
  { id: "wizard", name: "Wizard hat", price: 450, color: "#7b5cff" },
  { id: "headphones", name: "Beat phones", price: 600, color: "#142033" },
  { id: "flower", name: "Daisy crown", price: 750, color: "#fff4e0" },
  { id: "halo", name: "Halo", price: 900, color: "#ffe066" },
  { id: "propeller", name: "Propeller", price: 1100, color: "#3db7ff" },
  { id: "bow", name: "Ribbon bow", price: 250, color: "#ff8fd0" },
  { id: "antenna", name: "Alien antenna", price: 400, color: "#a9e34b" },
  { id: "horns", name: "Devil horns", price: 600, color: "#fa5252" },
  { id: "tiara", name: "Princess tiara", price: 850, color: "#da77f2" },
  { id: "helmet", name: "Space helmet", price: 1200, color: "#3bc9db" },
  { id: "tophat", name: "Top hat", price: 1500, color: "#142033" },
] as const;

export type HatId = (typeof HATS)[number]["id"];

export const EMOTES = [
  { id: "bounce", name: "Happy hop", price: 0 },
  { id: "wave", name: "Crowd wave", price: 100 },
  { id: "floss", name: "The floss", price: 250 },
  { id: "spin", name: "Victory spin", price: 400 },
  { id: "backflip", name: "Backflip", price: 600 },
  { id: "cheer", name: "Big cheer", price: 150 },
  { id: "dab", name: "Dab", price: 300 },
  { id: "moonwalk", name: "Moonwalk", price: 500 },
  { id: "breakdance", name: "Breakdance", price: 750 },
  { id: "flex", name: "Flex", price: 1000 },
] as const;

export type EmoteId = (typeof EMOTES)[number]["id"];

export const BUILDS = [
  { id: "slim", name: "Slim", price: 0, desc: "Light and fast" },
  { id: "medium", name: "Medium", price: 0, desc: "Balanced" },
  { id: "chubby", name: "Chubby", price: 200, desc: "Heavy and sturdy" },
  { id: "superhero", name: "Superhero", price: 500, desc: "Bold and heroic" },
] as const;

export type BuildId = (typeof BUILDS)[number]["id"];

export const CUSTOM_TILES = [
  { id: "straight", name: "Straight", glyph: "▬" },
  { id: "left", name: "Left turn", glyph: "↰" },
  { id: "right", name: "Right turn", glyph: "↱" },
  { id: "gap", name: "Jump gap", glyph: "◡" },
  { id: "ramp", name: "Ramp", glyph: "◠" },
] as const;

export type CustomTileId = (typeof CUSTOM_TILES)[number]["id"];

/** Decor a player can buy once they start earning Fun City tickets. */
export const FUN_CITY_DECOR = [
  { id: "stage", name: "Meow Stage", glyph: "🎪", cost: 60 },
  { id: "umbrella", name: "Beach umbrella", glyph: "☂", cost: 90 },
  { id: "beach", name: "Beach", glyph: "🏖", cost: 120 },
  { id: "icecream", name: "Ice cream stand", glyph: "🍦", cost: 140 },
  { id: "lounge", name: "Sun lounge", glyph: "🛋", cost: 150 },
  { id: "drinks", name: "Juice bar", glyph: "🍹", cost: 180 },
] as const;

export type DecorId = (typeof FUN_CITY_DECOR)[number]["id"];

export const TICKETS_PER_GEM = 10;

export const DEFAULT_CUSTOM: CustomTileId[] = [
  "straight",
  "left",
  "gap",
  "right",
  "ramp",
  "straight",
  "left",
  "gap",
];

export const RANKS = [
  { at: 0, name: "Rookie", color: "#8ecff2" },
  { at: 3, name: "Racer", color: "#1fce93" },
  { at: 8, name: "Champion", color: "#ffb020" },
  { at: 16, name: "Legend", color: "#ff4d6d" },
] as const;

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousDayKey(d = new Date()) {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  return dayKey(prev);
}

const MISSION_POOL: Omit<MissionItem, "progress" | "claimed">[] = [
  { id: "coins", target: 30, reward: 90 },
  { id: "race", target: 3, reward: 100 },
  { id: "podium", target: 2, reward: 120 },
  { id: "clean", target: 1, reward: 110 },
  { id: "beat", target: 4, reward: 130 },
];

/** Stable per-day shuffle so everyone gets the same sensible trio. */
export function makeMissions(date = dayKey()): MissionState {
  let seed = 0;
  for (let i = 0; i < date.length; i++) seed = (seed * 31 + date.charCodeAt(i)) >>> 0;
  const pool = [...MISSION_POOL];
  const items: MissionItem[] = [];
  for (let i = 0; i < 3; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const pick = pool.splice(seed % pool.length, 1)[0];
    items.push({ ...pick, progress: 0, claimed: false });
  }
  return { date, items };
}

const ACHIEVEMENT_DEFS: { id: AchievementId; target: number; reward: number }[] = [
  { id: "first_win", target: 1, reward: 50 },
  { id: "five_wins", target: 5, reward: 150 },
  { id: "ten_wins", target: 10, reward: 300 },
  { id: "twenty_five_wins", target: 25, reward: 750 },
  { id: "first_podium", target: 1, reward: 30 },
  { id: "five_podiums", target: 5, reward: 120 },
  { id: "clean_run", target: 1, reward: 40 },
  { id: "five_clean", target: 5, reward: 150 },
  { id: "hundred_coins", target: 100, reward: 100 },
  { id: "five_hundred_coins", target: 500, reward: 300 },
  { id: "thousand_coins", target: 1000, reward: 600 },
  { id: "ten_races", target: 10, reward: 80 },
  { id: "twenty_five_races", target: 25, reward: 200 },
  { id: "fifty_races", target: 50, reward: 400 },
  { id: "first_elimination_win", target: 1, reward: 60 },
  { id: "three_elimination_wins", target: 3, reward: 180 },
  { id: "reach_racer", target: 3, reward: 50 },
  { id: "reach_champion", target: 8, reward: 150 },
  { id: "reach_legend", target: 16, reward: 400 },
  { id: "first_fun_city", target: 1, reward: 50 },
  { id: "fun_city_decor", target: 3, reward: 150 },
  { id: "claim_daily", target: 5, reward: 100 },
  { id: "claim_all_missions", target: 1, reward: 80 },
];

export function makeAchievements(): AchievementItem[] {
  return ACHIEVEMENT_DEFS.map((d) => ({
    id: d.id,
    progress: 0,
    target: d.target,
    reward: d.reward,
    claimed: false,
  }));
}

export function syncAchievements(save: Save): Save {
  const items = save.achievements.map((a) => {
    if (a.claimed) return a;
    let progress = a.progress;
    switch (a.id) {
      case "first_win":
      case "five_wins":
      case "ten_wins":
      case "twenty_five_wins":
        progress = save.wins;
        break;
      case "first_podium":
      case "five_podiums":
        progress = save.podiums;
        break;
      case "clean_run":
      case "five_clean":
        progress = save.cleanRuns;
        break;
      case "hundred_coins":
      case "five_hundred_coins":
      case "thousand_coins":
        progress = save.totalEarned;
        break;
      case "ten_races":
      case "twenty_five_races":
      case "fifty_races":
        progress = save.races;
        break;
      case "reach_racer":
      case "reach_champion":
      case "reach_legend":
        progress = save.wins;
        break;
      case "fun_city_decor":
        progress = save.decor.length;
        break;
      // first_elimination_win, three_elimination_wins, first_fun_city,
      // claim_daily, claim_all_missions are bumped manually
      default:
        break;
    }
    return { ...a, progress: Math.min(a.target, progress) };
  });
  return { ...save, achievements: items };
}

export function rankOf(wins: number) {
  let out: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) if (wins >= rank.at) out = rank;
  return out;
}

export function achievementLabel(id: AchievementId): string {
  switch (id) {
    case "first_win": return "Win your first race";
    case "five_wins": return "Win 5 races";
    case "ten_wins": return "Win 10 races";
    case "twenty_five_wins": return "Win 25 races";
    case "first_podium": return "Take a podium";
    case "five_podiums": return "Take 5 podiums";
    case "clean_run": return "Finish a race without wiping out";
    case "five_clean": return "Finish 5 clean races";
    case "hundred_coins": return "Earn 100 coins";
    case "five_hundred_coins": return "Earn 500 coins";
    case "thousand_coins": return "Earn 1,000 coins";
    case "ten_races": return "Finish 10 races";
    case "twenty_five_races": return "Finish 25 races";
    case "fifty_races": return "Finish 50 races";
    case "first_elimination_win": return "Win an elimination race";
    case "three_elimination_wins": return "Win 3 elimination races";
    case "reach_racer": return "Reach Racer rank (3 wins)";
    case "reach_champion": return "Reach Champion rank (8 wins)";
    case "reach_legend": return "Reach Legend rank (16 wins)";
    case "first_fun_city": return "Win a Fun City race";
    case "fun_city_decor": return "Buy 3 Fun City decorations";
    case "claim_daily": return "Claim 5 daily chests";
    case "claim_all_missions": return "Claim all 3 daily challenges";
    default: return "Achievement";
  }
}

export function bumpAchievement(save: Save, id: AchievementId, amount = 1): Save {
  const items = save.achievements.map((a) =>
    a.id === id && !a.claimed ? { ...a, progress: Math.min(a.target, a.progress + amount) } : a,
  );
  return { ...save, achievements: items };
}

export function claimAchievement(save: Save, id: AchievementId): { save: Save; amount: number } {
  const item = save.achievements.find((a) => a.id === id);
  if (!item || item.claimed || item.progress < item.target) return { save, amount: 0 };
  const items = save.achievements.map((a) =>
    a.id === id ? { ...a, claimed: true } : a,
  );
  const next = { ...save, achievements: items, coins: save.coins + item.reward };
  return { save: next, amount: item.reward };
}

export function defaultSave(): Save {
  const today = dayKey();
  return {
    version: 2,
    coins: 0,
    unlocked: 1,
    skin: "violet",
    owned: ["violet", "coral"],
    hat: "none",
    ownedHats: ["none"],
    emote: "bounce",
    ownedEmotes: ["bounce"],
    records: {},
    muted: false,
    races: 0,
    wins: 0,
    podiums: 0,
    cleanRuns: 0,
    totalEarned: 0,
    streak: 0,
    bestStreak: 0,
    daily: { date: "", streak: 0, claimed: false },
    missions: makeMissions(today),
    custom: [...DEFAULT_CUSTOM],
    build: "medium",
    ownedBuilds: ["slim", "medium"],
    achievements: makeAchievements(),
    challenges: [],
    tickets: 0,
    gems: 30,
    decor: [],
    cityLevel: 0,
  };
}

export function skinById(id: string) {
  return ALL_SKINS.find((s) => s.id === id) ?? ALL_SKINS[0];
}

export function hatById(id: string) {
  return HATS.find((h) => h.id === id) ?? HATS[0];
}

export function emoteById(id: string) {
  return EMOTES.find((e) => e.id === id) ?? EMOTES[0];
}

/** Coin rewards for daily-streak Days 1–4; Day 5 grants an exclusive character. */
export const DAILY_LADDER = [150, 250, 350, 500] as const;
export const DAILY_CYCLE = 5;

/** Which day of the 5-day cycle a given streak is on (1..5). */
export function dailyDay(streak: number) {
  return ((Math.max(0, streak) - 1 + DAILY_CYCLE) % DAILY_CYCLE) + 1;
}

/** True when claiming today lands on Day 5 — the character reward day. */
export function isCharacterDay(streak: number) {
  return dailyDay(streak) === DAILY_CYCLE;
}

/** The next exclusive character not yet owned (the Day-5 prize). */
export function nextDailySkin(save: { owned: string[] }) {
  return DAILY_SKINS.find((s) => !save.owned.includes(s.id)) ?? null;
}

export function dailyReward(streak: number) {
  const day = dailyDay(streak);
  return day <= 4 ? DAILY_LADDER[day - 1] : 250;
}

/** Tickets earned for a Fun City win: fewer coins lost, more tickets banked. */
export function funCityTicketReward(place: number, pickups: number) {
  return Math.max(10, Math.round(30 - (place - 1) * 12 + pickups * 2));
}

/** Spend gems on a Fun City decoration; the city grows with every purchase. */
export function buyFunCityDecor(save: Save, id: DecorId): Save {
  const def = FUN_CITY_DECOR.find((d) => d.id === id);
  if (!def || save.gems < def.cost) return save;
  return {
    ...save,
    gems: save.gems - def.cost,
    decor: [...save.decor, id],
    cityLevel: save.cityLevel + 1,
  };
}

/** Trade Fun City tickets back into gems. */
export function sellFunCityTickets(save: Save) {
  if (save.tickets < TICKETS_PER_GEM) return save;
  return { ...save, tickets: save.tickets - TICKETS_PER_GEM, gems: save.gems + 1 };
}

/** Returns the save with daily flags and mission slate rolled forward. */
export function refreshSave(save: Save): Save {
  const today = dayKey();
  let next = save;
  if (next.daily.claimed && next.daily.date !== today) {
    next = { ...next, daily: { ...next.daily, claimed: false } };
  }
  if (next.missions.date !== today) {
    next = { ...next, missions: makeMissions(today) };
  }
  if (!Array.isArray(next.custom) || next.custom.length === 0) {
    next = { ...next, custom: [...DEFAULT_CUSTOM] };
  }
  return next;
}

export function canClaimDaily(save: Save) {
  return save.daily.date !== dayKey();
}

export function claimDaily(save: Save) {
  if (!canClaimDaily(save)) return { save, amount: 0, skin: null as (typeof DAILY_SKINS)[number] | null };
  const today = dayKey();
  const continuing = save.daily.date === previousDayKey();
  const streak = continuing ? save.daily.streak + 1 : 1;
  const amount = dailyReward(streak);
  let next: Save = save;
  let skin: (typeof DAILY_SKINS)[number] | null = null;
  if (isCharacterDay(streak)) {
    const prize = nextDailySkin(save);
    if (prize) {
      skin = prize;
      next = { ...next, owned: [...next.owned, prize.id] };
    }
  }
  next = {
    ...next,
    coins: next.coins + amount,
    totalEarned: next.totalEarned + amount,
    daily: { date: today, streak, claimed: true },
  };
  return { save: next, amount, skin };
}

export function bumpMission(save: Save, id: MissionId, amount = 1): Save {
  let changed = false;
  const items = save.missions.items.map((item) => {
    if (item.id !== id || item.claimed || item.progress >= item.target) return item;
    changed = true;
    return { ...item, progress: Math.min(item.target, item.progress + amount) };
  });
  return changed ? { ...save, missions: { ...save.missions, items } } : save;
}

export function claimMission(save: Save, id: MissionId) {
  const item = save.missions.items.find((m) => m.id === id);
  if (!item || item.claimed || item.progress < item.target) return { save, amount: 0 };
  return {
    save: {
      ...save,
      coins: save.coins + item.reward,
      totalEarned: save.totalEarned + item.reward,
      missions: {
        ...save.missions,
        items: save.missions.items.map((m) => (m.id === id ? { ...m, claimed: true } : m)),
      },
    },
    amount: item.reward,
  };
}

export function loadSave(): Save {
  if (typeof window === "undefined") return defaultSave();
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) raw = localStorage.getItem(V1_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw) localStorage.setItem(KEY, raw);
    }
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<Omit<Save, "version">> & { version?: number };
    if (parsed.version !== 1 && parsed.version !== 2) return defaultSave();
    const base = defaultSave();
    const save: Save = {
      ...base,
      ...parsed,
      version: 2,
      owned: Array.isArray(parsed.owned) ? parsed.owned : base.owned,
      ownedHats: Array.isArray(parsed.ownedHats)
        ? Array.from(new Set(["none", ...parsed.ownedHats]))
        : base.ownedHats,
      ownedEmotes: Array.isArray(parsed.ownedEmotes)
        ? Array.from(new Set(["bounce", ...parsed.ownedEmotes]))
        : base.ownedEmotes,
      records: parsed.records && typeof parsed.records === "object" ? parsed.records : {},
      daily: parsed.daily && typeof parsed.daily === "object" ? { ...base.daily, ...parsed.daily } : base.daily,
      missions:
        parsed.missions && Array.isArray(parsed.missions.items) && parsed.missions.items.length === 3
          ? parsed.missions
          : base.missions,
      custom: Array.isArray(parsed.custom) && parsed.custom.length > 0 ? parsed.custom : base.custom,
      build: typeof parsed.build === "string" ? parsed.build : base.build,
      ownedBuilds: Array.isArray(parsed.ownedBuilds) ? parsed.ownedBuilds : base.ownedBuilds,
      achievements: Array.isArray(parsed.achievements) && parsed.achievements.length === ACHIEVEMENT_DEFS.length
        ? parsed.achievements
        : base.achievements,
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
    };
    return refreshSave(save);
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: Save) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(save));
}
