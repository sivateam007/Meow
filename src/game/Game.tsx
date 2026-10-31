import { CUSTOM_LEVEL_ID, ENDLESS_LEVEL_ID, LEVELS, makeCustomLevel, makeEndlessLevel, type Level } from "@/game/levels";
import { mountGame, type GameApi, type PreviewOptions } from "@/game/mount";
import type { FinishPayload, HudPayload, RaceMode } from "@/game/sim";
import {
  CUSTOM_TILES,
  EMOTES,
  HATS,
  RANKS,
  SKINS,
  BUILDS,
  achievementLabel,
  bumpAchievement,
  bumpMission,
  claimAchievement,
  syncAchievements,
  buyFunCityDecor,
  canClaimDaily,
  claimChallenge,
  claimDaily,
  challengeStatus,
  claimMission,
  CHALLENGES,
  CHALLENGE_DIFF_COLOR,
  dailyDay,
  defaultSave,
  DAILY_LADDER,
  DAILY_SKINS,
  emoteById,
  funCityTicketReward,
  FUN_CITY_DECOR,
  hatById,
  loadSave,
  nextDailySkin,
  rankOf,
  refreshSave,
  sellFunCityTickets,
  skinById,
  writeSave,
  ALL_SKINS,
  type AchievementId,
  type BuildId,
  type CustomTileId,
  type DecorId,
  type Save,
} from "@/game/save";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Crown,
  Flag,
  Gift,
  Home as HomeIcon,
  Lock,
  Map,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Screen = "home" | "levels" | "locker" | "daily" | "challenges" | "records" | "achievements" | "city" | "race" | "paused" | "results";
type LockerTab = "skins" | "hats" | "emotes" | "builds";

function formatTime(t: number) {
  if (!Number.isFinite(t) || t <= 0) return "—";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function ordinal(n: number) {
  const suffix = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

function bonusFor(place: number, tumbles: number) {
  const placeBonus = [0, 50, 28, 16, 8][place] ?? 8;
  return placeBonus + (place === 1 ? 25 : 0) + (tumbles === 0 ? 15 : 0);
}

const emptyHud: HudPayload = {
  place: 1,
  total: 4,
  s: 0,
  length: 1,
  time: 0,
  countdown: 3,
  speed: 0,
  maxSpeed: 14.2,
  hint: "Hold to run",
  name: LEVELS[0].name,
  levelId: 0,
  pickups: 0,
  mode: "classic",
  gate: null,
  alive: 4,
  lastCut: null,
  rivals: [],
};

/** Fixed screen-space streaks used for the full-throttle rush effect. */
const STREAKS = [
  { x: 4, h: 16, d: 0.55, delay: 0 },
  { x: 13, h: 11, d: 0.48, delay: 0.2 },
  { x: 24, h: 14, d: 0.62, delay: 0.35 },
  { x: 76, h: 13, d: 0.5, delay: 0.1 },
  { x: 87, h: 17, d: 0.58, delay: 0.28 },
  { x: 95, h: 12, d: 0.45, delay: 0.42 },
  { x: 34, h: 9, d: 0.52, delay: 0.5 },
  { x: 66, h: 10, d: 0.46, delay: 0.16 },
];

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [screen, setScreen] = useState<Screen>("home");
  const [levelId, setLevelId] = useState(0);
  const [mode, setMode] = useState<RaceMode>("classic");
  const [lockerTab, setLockerTab] = useState<LockerTab>("skins");
  const [hud, setHud] = useState<HudPayload>(emptyHud);
  const [result, setResult] = useState<FinishPayload | null>(null);
  const [earned, setEarned] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordTab, setRecordTab] = useState<"stats" | "times">("stats");
  const saveRef = useRef(save);
  const levelRef = useRef(0);
  const modeRef = useRef<RaceMode>("classic");
  const screenRef = useRef<Screen>("home");
  const noticeTimer = useRef<number | null>(null);
  saveRef.current = save;
  levelRef.current = levelId;
  modeRef.current = mode;
  screenRef.current = screen;

  const customLevel = useMemo(() => makeCustomLevel(save.custom), [save.custom]);
  const endlessLevel = useMemo(() => makeEndlessLevel(), []);

  const levelFor = (id: number): Level =>
    id === CUSTOM_LEVEL_ID ? customLevel : id === ENDLESS_LEVEL_ID ? endlessLevel : LEVELS[id] ?? LEVELS[0];

  const flash = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const previewOptions = (loaded: Save, custom: Level = customLevel): PreviewOptions => ({
    color: skinById(loaded.skin).color,
    emote: loaded.emote,
    hat: loaded.hat,
  });

  const preview = (id: number, source = saveRef.current) => {
    const level = id === CUSTOM_LEVEL_ID ? customLevel : id === ENDLESS_LEVEL_ID ? endlessLevel : LEVELS[id] ?? LEVELS[0];
    apiRef.current?.preview(level, previewOptions(source));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const loaded = refreshSave(loadSave());
    writeSave(loaded);
    setSave(loaded);
    const startLevel = Math.max(0, Math.min(LEVELS.length - 1, loaded.unlocked - 1));
    setLevelId(startLevel);
    levelRef.current = startLevel;
    const api = mountGame(canvas, {
      onHud: (next) => {
        if (screenRef.current === "race" || screenRef.current === "paused") setHud(next);
      },
      onCoin: () => {
        setSave((current) => {
          const next = { ...current, coins: current.coins + 1 };
          writeSave(next);
          return next;
        });
      },
      onHit: () => undefined,
      onFinish: (payload) => {
        const won = payload.place === 1 && !payload.eliminated;
        const bonus = payload.eliminated
          ? Math.max(4, Math.round(payload.pickups * 0.5))
          : bonusFor(payload.place, payload.tumbles);
        setEarned(payload.pickups + bonus);
        setResult(payload);
        setScreen("results");
        screenRef.current = "results";
        setSave((current) => {
          const key = String(payload.levelId);
          const prev = current.records[key];
          const records = payload.eliminated
            ? current.records
            : {
                ...current.records,
                [key]: {
                  time: prev ? Math.min(prev.time, payload.time) : payload.time,
                  place: prev ? Math.min(prev.place, payload.place) : payload.place,
                },
              };
          let unlocked = current.unlocked;
          if (
            won &&
            payload.levelId < LEVELS.length &&
            payload.levelId !== CUSTOM_LEVEL_ID &&
            payload.levelId !== ENDLESS_LEVEL_ID
          ) {
            unlocked = Math.max(unlocked, Math.min(LEVELS.length, payload.levelId + 2));
          }
          let next: Save = {
            ...current,
            coins: current.coins + bonus,
            totalEarned: current.totalEarned + payload.pickups + bonus,
            records,
            unlocked,
            races: current.races + 1,
            wins: current.wins + (won ? 1 : 0),
            podiums: current.podiums + (payload.place <= 3 && !payload.eliminated ? 1 : 0),
            cleanRuns: current.cleanRuns + (payload.tumbles === 0 && !payload.eliminated ? 1 : 0),
            streak: won ? current.streak + 1 : 0,
            bestStreak: won ? Math.max(current.bestStreak, current.streak + 1) : current.bestStreak,
          };
          if (won && payload.levelId === CUSTOM_LEVEL_ID) {
            next = { ...next, tickets: next.tickets + funCityTicketReward(payload.place, payload.pickups) };
          }
          next = bumpMission(next, "race", 1);
          next = bumpMission(next, "coins", payload.pickups);
          if (payload.place <= 3 && !payload.eliminated) next = bumpMission(next, "podium", 1);
          if (payload.tumbles === 0 && !payload.eliminated) next = bumpMission(next, "clean", 1);
          const beaten = payload.standings.length - payload.place;
          if (beaten > 0) next = bumpMission(next, "beat", beaten);
          next = syncAchievements(next);
          if (won && payload.mode === "elimination") {
            next = bumpAchievement(next, "first_elimination_win", 1);
            next = bumpAchievement(next, "three_elimination_wins", 1);
          }
          if (won && payload.levelId === CUSTOM_LEVEL_ID) {
            next = bumpAchievement(next, "first_fun_city", 1);
          }
          writeSave(next);
          return next;
        });
        if (won && currentWinStreak() > 0) {
          flash(won && saveRef.current.streak > 0 ? "Win streak extended!" : "Victory!");
        }
      },
    });
    apiRef.current = api;
    api.setMuted(loaded.muted);
    api.preview(startLevel, previewOptions(loaded));
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // Mount once: the game instance owns the canvas for the whole session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentWinStreak = () => saveRef.current.streak;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && screenRef.current === "race") {
        apiRef.current?.setPaused(true);
        setScreen("paused");
        screenRef.current = "paused";
      } else if (e.code === "Escape" && screenRef.current === "paused") {
        apiRef.current?.setPaused(false);
        setScreen("race");
        screenRef.current = "race";
      } else if (e.code === "KeyM") {
        setSave((current) => {
          const next = { ...current, muted: !current.muted };
          writeSave(next);
          apiRef.current?.setMuted(next.muted);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (next: Screen) => {
    setScreen(next);
    screenRef.current = next;
  };

  const goHome = () => {
    apiRef.current?.setPaused(false);
    preview(levelRef.current);
    go("home");
  };

  const openLevels = () => {
    preview(levelRef.current);
    go("levels");
  };

  const start = (id = levelRef.current, raceMode: RaceMode = modeRef.current) => {
    const source = saveRef.current;
    const level = id === CUSTOM_LEVEL_ID ? customLevel : id === ENDLESS_LEVEL_ID ? endlessLevel : LEVELS[id] ?? LEVELS[0];
    setLevelId(id);
    levelRef.current = id;
    setMode(raceMode);
    modeRef.current = raceMode;
    setResult(null);
    setHud({
      ...emptyHud,
      name: level.name,
      levelId: id,
      length: level.track.length,
      countdown: 3,
      mode: raceMode,
      total: 4,
      alive: 4,
    });
    apiRef.current?.setPaused(false);
    apiRef.current?.start(level, {
      color: skinById(source.skin).color,
      mode: raceMode,
      emote: source.emote,
      hat: source.hat,
    });
    go("race");
  };

  const pickLevel = (id: number) => {
    setLevelId(id);
    levelRef.current = id;
    if (screenRef.current !== "race" && screenRef.current !== "paused") preview(id);
  };

  const buySkin = (id: string) => {
    const item = skinById(id);
    setSave((current) => {
      if (!current.owned.includes(id)) {
        if (current.coins < item.price) {
          flash("Not enough coins — win races and claim challenges.");
          return current;
        }
        const next = {
          ...current,
          coins: current.coins - item.price,
          owned: [...current.owned, id],
          skin: id,
        };
        writeSave(next);
        apiRef.current?.setColor(item.color);
        return next;
      }
      const next = { ...current, skin: id };
      writeSave(next);
      apiRef.current?.setColor(item.color);
      return next;
    });
  };

  const buyHat = (id: string) => {
    const item = hatById(id);
    setSave((current) => {
      if (!current.ownedHats.includes(id)) {
        if (current.coins < item.price) {
          flash("Not enough coins for that hat yet.");
          return current;
        }
        const next = {
          ...current,
          coins: current.coins - item.price,
          ownedHats: [...current.ownedHats, id],
          hat: id,
        };
        writeSave(next);
        apiRef.current?.setHat(id);
        return next;
      }
      const next = { ...current, hat: id };
      writeSave(next);
      apiRef.current?.setHat(id);
      return next;
    });
  };

  const buyEmote = (id: string) => {
    const item = emoteById(id);
    setSave((current) => {
      if (!current.ownedEmotes.includes(id)) {
        if (current.coins < item.price) {
          flash("Not enough coins for that dance yet.");
          return current;
        }
        const next = {
          ...current,
          coins: current.coins - item.price,
          ownedEmotes: [...current.ownedEmotes, id],
          emote: id,
        };
        writeSave(next);
        apiRef.current?.setEmote(id);
        return next;
      }
      const next = { ...current, emote: id };
      writeSave(next);
      apiRef.current?.setEmote(id);
      return next;
    });
  };

  const buyBuild = (id: string) => {
    const item = BUILDS.find((b) => b.id === id);
    if (!item) return;
    setSave((current) => {
      const owned = current.ownedBuilds?.includes(id) ?? (id === "slim" || id === "medium");
      if (!owned) {
        if (current.coins < item.price) {
          flash("Not enough coins for that build yet.");
          return current;
        }
        const next = {
          ...current,
          coins: current.coins - item.price,
          ownedBuilds: [...(current.ownedBuilds ?? ["slim", "medium"]), id],
          build: id,
        };
        writeSave(next);
        apiRef.current?.setBuild(id);
        return next;
      }
      const next = { ...current, build: id };
      writeSave(next);
      apiRef.current?.setBuild(id);
      return next;
    });
  };

  const collectDaily = () => {
    const { save: next, amount, skin } = claimDaily(saveRef.current);
    if (amount <= 0) return;
    let updated = bumpAchievement(next, "claim_daily", 1);
    if (skin) updated = { ...updated, skin: skin.id };
    updated = syncAchievements(updated);
    setSave(updated);
    writeSave(updated);
    if (skin) {
      apiRef.current?.setColor(skin.color);
      flash(`Day 5! Unlocked character "${skin.name}" +${amount} coins!`);
    } else {
      flash(`Daily chest: +${amount} coins!`);
    }
  };

  const collectChallenge = (id: string, double: boolean) => {
    const { save: next, amount } = claimChallenge(saveRef.current, id, double);
    if (amount <= 0) return;
    const updated = syncAchievements(next);
    setSave(updated);
    writeSave(updated);
    flash(`Challenge complete: +${amount} coins!`);
  };

  const collectMission = (id: Save["missions"]["items"][number]["id"]) => {
    const { save: next, amount } = claimMission(saveRef.current, id);
    if (amount <= 0) return;
    let updated = next;
    if (next.missions.items.every((m) => m.claimed)) {
      updated = bumpAchievement(updated, "claim_all_missions", 1);
    }
    updated = syncAchievements(updated);
    setSave(updated);
    writeSave(updated);
    flash(`Challenge complete: +${amount} coins!`);
  };

  const openDaily = () => {
    const next = refreshSave(saveRef.current);
    if (next !== saveRef.current) {
      setSave(next);
      writeSave(next);
    }
    go("daily");
  };

  const editCustom = (tiles: string[]) => {
    setSave((current) => {
      const next = { ...current, custom: tiles };
      writeSave(next);
      return next;
    });
  };

  const addTile = (id: CustomTileId) => {
    if (saveRef.current.custom.length >= 12) {
      flash("Fun City tops out at 12 tiles.");
      return;
    }
    editCustom([...saveRef.current.custom, id]);
  };

  const removeTile = (index: number) => {
    editCustom(saveRef.current.custom.filter((_, i) => i !== index));
  };

  const moveTile = (index: number, dir: -1 | 1) => {
    const next = [...saveRef.current.custom];
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    editCustom(next);
  };

  const buyDecor = (id: string) => {
    const next = buyFunCityDecor(saveRef.current, id as DecorId);
    if (next === saveRef.current) {
      flash("Not enough gems for that decoration.");
      return;
    }
    setSave(next);
    writeSave(next);
    flash(`Fun City grew: ${FUN_CITY_DECOR.find((d) => d.id === id)?.name ?? "decor"}!`);
  };

  const sellTickets = () => {
    const next = sellFunCityTickets(saveRef.current);
    if (next === saveRef.current) {
      flash("No tickets to trade yet.");
      return;
    }
    setSave(next);
    writeSave(next);
    flash("Tickets traded for gems!");
  };

  const toggleMute = () => {
    setSave((current) => {
      const next = { ...current, muted: !current.muted };
      writeSave(next);
      apiRef.current?.setMuted(next.muted);
      return next;
    });
  };

  const rank = rankOf(save.wins);
  const level = levelFor(levelId);

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-sky text-cream">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <TopBar coins={save.coins} streak={save.streak} muted={save.muted} onMute={toggleMute} />

        {screen === "home" ? (
          <Home
            level={level}
            save={save}
            rankName={rank.name}
            rankColor={rank.color}
            onStart={() => start(levelId, "classic")}
            onElimination={() => start(levelId, "elimination")}
            onLevels={openLevels}
            onLocker={() => go("locker")}
            onDaily={openDaily}
            onRecords={() => go("records")}
            onCity={() => go("city")}
            onAchievements={() => go("achievements")}
            onChallenges={() => go("challenges")}
            onEndless={() => start(ENDLESS_LEVEL_ID, "endless")}
          />
        ) : null}

        {screen === "levels" ? (
          <LevelSheet
            save={save}
            selected={levelId}
            mode={mode}
            onMode={(next) => {
              setMode(next);
              modeRef.current = next;
            }}
            onSelect={pickLevel}
            onPlay={() => start(levelId, mode)}
            onClose={goHome}
          />
        ) : null}

        {screen === "locker" ? (
          <LockerSheet
            save={save}
            tab={lockerTab}
            onTab={setLockerTab}
            onSkin={buySkin}
            onHat={buyHat}
            onEmote={buyEmote}
            onBuild={buyBuild}
            onClose={goHome}
          />
        ) : null}

        {screen === "daily" ? (
          <DailySheet
            save={save}
            onClaimDaily={collectDaily}
            onClaimMission={collectMission}
            onClose={goHome}
          />
        ) : null}

        {screen === "challenges" ? (
          <ChallengesSheet
            save={save}
            onClaim={(id, double) => collectChallenge(id, double)}
            onClose={goHome}
          />
        ) : null}

        {screen === "records" ? (
          <RecordsSheet
            save={save}
            tab={recordTab}
            onTab={setRecordTab}
            onClose={goHome}
          />
        ) : null}

        {screen === "achievements" ? (
          <AchievementsSheet
            save={save}
            onClaim={(id) => {
              const { save: next, amount } = claimAchievement(saveRef.current, id as AchievementId);
              if (amount <= 0) return;
              setSave(next);
              writeSave(next);
              flash(`Achievement unlocked: +${amount} coins!`);
            }}
            onClose={goHome}
          />
        ) : null}

        {screen === "city" ? (
          <CitySheet
            save={save}
            onAdd={addTile}
            onRemove={removeTile}
            onMove={moveTile}
            onPlay={() => start(CUSTOM_LEVEL_ID, "classic")}
            onBuyDecor={buyDecor}
            onSellTickets={sellTickets}
            onClose={goHome}
          />
        ) : null}

        {screen === "race" || screen === "paused" ? (
          <Hud
            hud={hud}
            paused={screen === "paused"}
            onPause={() => {
              apiRef.current?.setPaused(true);
              setScreen("paused");
              screenRef.current = "paused";
            }}
          />
        ) : null}

        {screen === "paused" ? (
          <PauseCard
            mode={hud.mode}
            onResume={() => {
              apiRef.current?.setPaused(false);
              setScreen("race");
              screenRef.current = "race";
            }}
            onRetry={() => start(levelId, modeRef.current)}
            onQuit={goHome}
          />
        ) : null}

        {screen === "results" && result ? (
          <Results
            result={result}
            earned={earned}
            unlocked={save.unlocked}
            onRetry={() => start(result.levelId, result.mode)}
            onNext={() => start(Math.min(LEVELS.length - 1, result.levelId + 1), result.mode)}
            onLevels={() => {
              preview(result.levelId);
              go("levels");
            }}
            onHome={goHome}
          />
        ) : null}

        {screen === "race" ? (
          <div className="pointer-events-none mt-auto flex items-end justify-between p-4 md:hidden">
            <SteerButton dir={1} label="Slide left" />
            <SteerButton dir={-1} label="Slide right" />
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <p className="rounded-full bg-ink/92 px-5 py-3 text-center font-display text-base text-gold shadow-lg">
            {notice}
          </p>
        </div>
      ) : null}
    </main>
  );
}

/** The Meow cat mark — same artwork as public/favicon.svg. */
function MeowMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Meow logo">
      <path d="M12 27 L15.5 7 L30.5 18.5 Z" fill="#ffb020" />
      <path d="M52 27 L48.5 7 L33.5 18.5 Z" fill="#ffb020" />
      <path d="M16 24.5 L18.4 12.8 L27.2 19.4 Z" fill="#ff4d6d" />
      <path d="M48 24.5 L45.6 12.8 L36.8 19.4 Z" fill="#ff4d6d" />
      <circle cx="32" cy="37" r="20" fill="#ffb020" />
      <path
        d="M14 34 H5.5 M14.5 39 L7 42.5 M49.5 34 H58.5 M49.5 39 L57 42.5"
        stroke="#fff4e0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="25" cy="35" rx="3.1" ry="4.3" fill="#142033" />
      <ellipse cx="39" cy="35" rx="3.1" ry="4.3" fill="#142033" />
      <circle cx="26.1" cy="33.4" r="1.1" fill="#fff4e0" />
      <circle cx="40.1" cy="33.4" r="1.1" fill="#fff4e0" />
      <path d="M32 41.5 L28.4 38.2 H35.6 Z" fill="#ff4d6d" />
      <path
        d="M32 41.5 q-3.6 4.6 -7.4 1.4 M32 41.5 q3.6 4.6 7.4 1.4"
        fill="none"
        stroke="#142033"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TopBar({
  coins,
  streak,
  muted,
  onMute,
}: {
  coins: number;
  streak: number;
  muted: boolean;
  onMute: () => void;
}) {
  return (
    <div className="pointer-events-none flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-ink/80 px-4 py-2 font-display text-lg text-gold">
          <Coins className="size-4" />
          {coins}
        </div>
        {streak > 0 ? (
          <div className="flex items-center gap-1 rounded-full bg-coral/90 px-3 py-2 font-display text-sm text-cream">
            <Zap className="size-4" />
            {streak} win{streak === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        data-ui
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={onMute}
        className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-ink/80 text-cream"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  );
}

function Home({
  level,
  save,
  rankName,
  rankColor,
  onStart,
  onElimination,
  onLevels,
  onLocker,
  onDaily,
  onRecords,
  onCity,
  onAchievements,
  onChallenges,
  onEndless,
}: {
  level: Level;
  save: Save;
  rankName: string;
  rankColor: string;
  onStart: () => void;
  onElimination: () => void;
  onLevels: () => void;
  onLocker: () => void;
  onDaily: () => void;
  onRecords: () => void;
  onCity: () => void;
  onAchievements: () => void;
  onChallenges: () => void;
  onEndless: () => void;
}) {
  const dailyReady = canClaimDaily(save);
  const missionReady = save.missions.items.some((m) => !m.claimed && m.progress >= m.target);
  const challengeReady = CHALLENGES.some((c) => challengeStatus(save, c) === "available");
  const hat = hatById(save.hat);
  const emote = emoteById(save.emote);
  return (
    <div className="flex flex-1 items-end justify-center p-4 pb-6 sm:items-center">
      <section className="pointer-events-auto max-h-full w-full max-w-md sm:max-w-lg overflow-y-auto rounded-xl bg-ink/85 p-5 text-cream shadow-lg backdrop-blur-sm sm:p-6">
        <div className="flex items-center gap-3">
          <MeowMark className="size-14 shrink-0 sm:size-16" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-xs tracking-wide text-gold">
                Track {level.id === CUSTOM_LEVEL_ID ? "Fun City" : level.id + 1}
              </p>
              <span
                className="rounded-full px-2 py-0.5 font-display text-[10px] uppercase tracking-wide text-ink"
                style={{ background: rankColor }}
              >
                {rankName}
              </span>
            </div>
            <h1 className="font-display text-5xl leading-none text-cream sm:text-6xl">
              Me<span className="text-gold">ow</span>
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-snug text-cream/90">
          Hold to sprint. Release to stop. Slide past saws, dodge hammers and take the flag before
          the pack.
        </p>

        <div className="mt-4 rounded-lg bg-cream/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-sm text-gold">{level.name}</p>
            <p className="shrink-0 text-[11px] text-cream/60">{level.tags.slice(0, 2).join(" · ")}</p>
          </div>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-cream/60">
            <span>{hat.name}</span>
            <span>·</span>
            <span>{emote.name}</span>
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            data-ui
            onClick={onStart}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 font-display text-xl text-ink"
          >
            <Play className="size-5" />
            Start Race
          </button>
          <button
            type="button"
            data-ui
            onClick={onElimination}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 py-3 font-display text-lg text-cream"
          >
            <Zap className="size-5" />
            Elimination Race
            <span className="text-xs text-cream/80">last cat standing</span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MenuButton icon={<Flag className="size-5" />} label="Tracks" onClick={onLevels} />
            <MenuButton icon={<Crown className="size-5" />} label="Locker" onClick={onLocker} />
            <MenuButton
              icon={<Gift className="size-5" />}
              label="Daily"
              onClick={onDaily}
              badge={dailyReady || missionReady}
            />
            <MenuButton icon={<Trophy className="size-5" />} label="Records" onClick={onRecords} />
            <MenuButton icon={<Map className="size-5" />} label="Fun City" onClick={onCity} />
            <MenuButton
              icon={<Sparkles className="size-5" />}
              label="Challenges"
              onClick={onChallenges}
              badge={challengeReady}
            />
            <MenuButton
              icon={<Trophy className="size-5" />}
              label="Achievements"
              onClick={onAchievements}
              badge={save.achievements.some((a) => !a.claimed && a.progress >= a.target)}
            />
            <MenuButton
              icon={<Zap className="size-5" />}
              label="Endless"
              onClick={onEndless}
            />
          </div>
        </div>
        <p className="mt-4 text-center font-display text-xs tracking-[0.2em] text-cream/60">
          Developed by <span className="text-gold">Siva</span>
        </p>
      </section>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  badge,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      data-ui
      onClick={onClick}
      className="relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-cream/10 px-1 py-2 font-display text-xs text-cream"
    >
      <span className="text-gold">{icon}</span>
      {label}
      {badge ? <span className="absolute right-2 top-2 size-2 rounded-full bg-coral" /> : null}
    </button>
  );
}

function SheetShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex flex-1 items-end justify-center p-4 pb-6 sm:items-center">
      <section
        className={`pointer-events-auto max-h-full w-full overflow-auto rounded-xl bg-ink/92 p-5 text-cream ${
          wide ? "max-w-3xl" : "max-w-md sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl leading-none">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-cream/60">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            data-ui
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream/10 text-cream"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ModeToggle({ mode, onMode }: { mode: RaceMode; onMode: (m: RaceMode) => void }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 rounded-full bg-cream/10 p-1">
      <button
        type="button"
        data-ui
        onClick={() => onMode("classic")}
        className={`min-h-9 rounded-full px-3 font-display text-sm ${
          mode === "classic" ? "bg-gold text-ink" : "text-cream/70"
        }`}
      >
        Classic
      </button>
      <button
        type="button"
        data-ui
        onClick={() => onMode("elimination")}
        className={`min-h-9 rounded-full px-3 font-display text-sm ${
          mode === "elimination" ? "bg-coral text-cream" : "text-cream/70"
        }`}
      >
        Elimination
      </button>
    </div>
  );
}

function LevelSheet({
  save,
  selected,
  mode,
  onMode,
  onSelect,
  onPlay,
  onClose,
}: {
  save: Save;
  selected: number;
  mode: RaceMode;
  onMode: (m: RaceMode) => void;
  onSelect: (id: number) => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const current = LEVELS[selected] ?? LEVELS[0];
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(Math.floor(selected / PAGE_SIZE));
  }, [selected]);
  const totalPages = Math.ceil(LEVELS.length / PAGE_SIZE);
  const visibleLevels = LEVELS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  return (
    <SheetShell title="Tracks" subtitle={`${save.unlocked} of ${LEVELS.length} unlocked`} onClose={onClose} wide>
      <ModeToggle mode={mode} onMode={onMode} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:grid-cols-4">
        {visibleLevels.map((level) => {
          const locked = level.id >= save.unlocked;
          const rec = save.records[String(level.id)];
          const active = level.id === selected;
          return (
            <button
              key={level.id}
              type="button"
              data-ui
              disabled={locked}
              onClick={() => onSelect(level.id)}
              className={`min-h-24 rounded-xl border p-3 text-left ${
                active ? "border-gold bg-gold/15" : "border-cream/15 bg-cream/5"
              } disabled:opacity-40`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-gold">{level.id + 1}</span>
                {locked ? (
                  <Lock className="size-4" />
                ) : rec?.place === 1 ? (
                  <Trophy className="size-4 text-gold" />
                ) : null}
              </div>
              <p className="mt-2 font-display text-base leading-tight">{level.name}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-cream/60">
                {level.tags.slice(0, 2).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-cream/70">
                {locked ? "Win the previous race" : rec ? formatTime(rec.time) : "No time yet"}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          data-ui
          disabled={page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="min-h-9 rounded-full bg-cream/10 px-4 font-display text-sm text-cream disabled:opacity-40"
        >
          Prev
        </button>
        <span className="font-display text-xs text-cream/60">
          Page {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          data-ui
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          className="min-h-9 rounded-full bg-cream/10 px-4 font-display text-sm text-cream disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <p className="mt-4 text-sm text-cream/80">{current.blurb}</p>
      <button
        type="button"
        data-ui
        disabled={selected >= save.unlocked}
        onClick={onPlay}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold font-display text-xl text-ink disabled:opacity-40"
      >
        <Flag className="size-5" />
        {mode === "elimination" ? "Enter elimination" : `Race ${current.name}`}
      </button>
      {mode === "elimination" ? (
        <p className="mt-2 text-center text-xs text-cream/60">
          Two gates. The last runner through each gate is cut.
        </p>
      ) : null}
    </SheetShell>
  );
}

function LockerSheet({
  save,
  tab,
  onTab,
  onSkin,
  onHat,
  onEmote,
  onBuild,
  onClose,
}: {
  save: Save;
  tab: LockerTab;
  onTab: (t: LockerTab) => void;
  onSkin: (id: string) => void;
  onHat: (id: string) => void;
  onEmote: (id: string) => void;
  onBuild: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetShell title="Locker" subtitle={`${save.coins} coins to spend`} onClose={onClose}>
      <div className="mt-4 grid grid-cols-4 gap-2 rounded-full bg-cream/10 p-1">
        {(["skins", "hats", "emotes", "builds"] as const).map((id) => (
          <button
            key={id}
            type="button"
            data-ui
            onClick={() => onTab(id)}
            className={`min-h-9 rounded-full px-2 font-display text-xs capitalize ${
              tab === id ? "bg-gold text-ink" : "text-cream/70"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === "skins" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_SKINS.map((item) => {
            const owned = save.owned.includes(item.id);
            const selected = save.skin === item.id;
            const lockedDaily = item.daily && !owned;
            return (
              <button
                key={item.id}
                type="button"
                data-ui
                disabled={lockedDaily}
                onClick={() => onSkin(item.id)}
                className={`relative min-h-24 rounded-xl border p-3 text-left ${
                  selected ? "border-gold bg-gold/10" : "border-cream/15 bg-cream/5"
                } ${lockedDaily ? "opacity-70" : ""}`}
              >
                {item.daily ? (
                  <span className="absolute right-2 top-2 rounded-full bg-coral px-1.5 py-0.5 font-display text-[9px] uppercase tracking-wide text-cream">
                    Day 5
                  </span>
                ) : null}
                <span className="block size-8 rounded-full ring-2 ring-cream/30" style={{ background: item.color }} />
                <span className="mt-2 block font-display text-lg">{item.name}</span>
                <span className="text-xs text-cream/70">
                  {owned
                    ? selected
                      ? "Racing"
                      : "Owned"
                    : lockedDaily
                      ? "Reach Day 5"
                      : `${item.price} coins`}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === "hats" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {HATS.map((item) => {
            const owned = save.ownedHats.includes(item.id);
            const selected = save.hat === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-ui
                onClick={() => onHat(item.id)}
                className={`min-h-24 rounded-xl border p-3 text-left ${
                  selected ? "border-gold bg-gold/10" : "border-cream/15 bg-cream/5"
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-full" style={{ background: item.color }}>
                  <Crown className="size-4 text-ink/70" />
                </span>
                <span className="mt-2 block font-display text-lg">{item.name}</span>
                <span className="text-xs text-cream/70">
                  {owned ? (selected ? "Wearing" : "Owned") : `${item.price} coins`}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === "builds" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {BUILDS.map((item) => {
            const owned = (save.ownedBuilds ?? ["slim", "medium"]).includes(item.id);
            const selected = save.build === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-ui
                onClick={() => onBuild(item.id)}
                className={`min-h-24 rounded-xl border p-3 text-left ${
                  selected ? "border-gold bg-gold/10" : "border-cream/15 bg-cream/5"
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-cream/15">
                  <Sparkles className="size-4 text-gold" />
                </span>
                <span className="mt-2 block font-display text-lg">{item.name}</span>
                <span className="text-xs text-cream/70">
                  {owned ? (selected ? "Equipped" : "Owned") : `${item.price} coins`}
                </span>
                <span className="block text-[10px] text-cream/50">{item.desc}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === "emotes" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {EMOTES.map((item) => {
            const owned = save.ownedEmotes.includes(item.id);
            const selected = save.emote === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-ui
                onClick={() => onEmote(item.id)}
                className={`min-h-24 rounded-xl border p-3 text-left ${
                  selected ? "border-gold bg-gold/10" : "border-cream/15 bg-cream/5"
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-cream/15">
                  <Sparkles className="size-4 text-gold" />
                </span>
                <span className="mt-2 block font-display text-lg">{item.name}</span>
                <span className="text-xs text-cream/70">
                  {owned ? (selected ? "Equipped" : "Owned") : `${item.price} coins`}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="mt-4 text-center text-xs text-cream/55">
        Emotes play on the finish line after a win.
      </p>
    </SheetShell>
  );
}

function DailySheet({
  save,
  onClaimDaily,
  onClaimMission,
  onClose,
}: {
  save: Save;
  onClaimDaily: () => void;
  onClaimMission: (id: Save["missions"]["items"][number]["id"]) => void;
  onClose: () => void;
}) {
  const ready = canClaimDaily(save);
  const todayDay = dailyDay(save.daily.streak + (ready ? 1 : 0));
  const nextPrize = nextDailySkin(save);
  return (
    <SheetShell title="Daily" subtitle="Come back daily — Day 5 unlocks a free character" onClose={onClose}>
      <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-gold text-ink">
            <Gift className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl">Daily reward</p>
            <p className="text-xs text-cream/65">Day {save.daily.streak} streak · next is Day {todayDay}</p>
          </div>
          <button
            type="button"
            data-ui
            disabled={!ready}
            onClick={onClaimDaily}
            className="min-h-10 shrink-0 rounded-full bg-gold px-4 font-display text-sm text-ink disabled:opacity-40"
          >
            {ready ? "Claim" : "Claimed"}
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {DAILY_LADDER.map((coins, i) => {
            const day = i + 1;
            const claimed = save.daily.streak >= day && save.daily.claimed;
            const isNext = ready && todayDay === day;
            return (
              <div
                key={day}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  isNext ? "bg-gold/25 ring-1 ring-gold/60" : claimed ? "bg-mint/15" : "bg-cream/5"
                }`}
              >
                <span className="w-14 font-display text-sm text-cream/80">Day {day}</span>
                <span className="flex-1 font-display text-lg text-gold">+{coins} coins</span>
                {claimed ? <Check className="size-4 text-mint" /> : null}
              </div>
            );
          })}
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              ready && todayDay === 5 ? "bg-gold/25 ring-1 ring-gold/60" : "bg-cream/5"
            }`}
          >
            <span className="w-14 font-display text-sm text-cream/80">Day 5</span>
            <span
              className="size-6 shrink-0 rounded-full ring-2 ring-cream/40"
              style={{ background: nextPrize?.color ?? DAILY_SKINS[0].color }}
            />
            <span className="flex-1 font-display text-lg text-cream">
              {nextPrize ? `${nextPrize.name} character` : "All characters earned"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-5 font-display text-lg text-gold">Today&apos;s challenges</p>
      <div className="mt-2 space-y-2">
        {save.missions.items.map((item) => {
          const done = item.progress >= item.target;
          const readyToClaim = done && !item.claimed;
          return (
            <div key={item.id} className="rounded-lg bg-cream/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-sm">{missionLabel(item.id)}</p>
                  <p className="text-[11px] text-cream/60">
                    {Math.min(item.progress, item.target)} / {item.target} · +{item.reward} coins
                  </p>
                </div>
                <button
                  type="button"
                  data-ui
                  disabled={!readyToClaim}
                  onClick={() => onClaimMission(item.id)}
                  className={`min-h-9 shrink-0 rounded-full px-3 font-display text-xs ${
                    readyToClaim ? "bg-gold text-ink" : "bg-cream/10 text-cream/50"
                  }`}
                >
                  {item.claimed ? "Done" : readyToClaim ? "Claim" : `${Math.round((item.progress / item.target) * 100)}%`}
                </button>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/60">
                <div
                  className="h-full rounded-full bg-mint"
                  style={{ width: `${Math.min(100, (item.progress / item.target) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-cream/55">Challenges reset at midnight.</p>
    </SheetShell>
  );
}

function ChallengesSheet({
  save,
  onClaim,
  onClose,
}: {
  save: Save;
  onClaim: (id: string, double: boolean) => void;
  onClose: () => void;
}) {
  const claimedCount = CHALLENGES.filter((c) => challengeStatus(save, c) === "claimed").length;
  return (
    <SheetShell
      title="Challenges"
      subtitle="World-Race milestones — clear a track to unlock, then cash in"
      onClose={onClose}
      wide
    >
      <p className="mt-3 text-xs text-cream/60">
        {claimedCount} / {CHALLENGES.length} claimed
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {CHALLENGES.map((ch) => {
          const status = challengeStatus(save, ch);
          const color = CHALLENGE_DIFF_COLOR[ch.difficulty];
          return (
            <div
              key={ch.id}
              className={`rounded-xl border p-4 ${
                status === "claimed"
                  ? "border-mint/40 bg-mint/10"
                  : status === "available"
                    ? "border-gold/50 bg-gold/10"
                    : "border-cream/15 bg-cream/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-2 py-0.5 font-display text-[10px] uppercase tracking-wide text-ink"
                  style={{ background: color }}
                >
                  {ch.difficulty}
                </span>
                {status === "claimed" ? (
                  <span className="flex items-center gap-1 font-display text-xs text-mint">
                    <Check className="size-4" /> Claimed
                  </span>
                ) : status === "locked" ? (
                  <span className="flex items-center gap-1 font-display text-xs text-cream/50">
                    <Lock className="size-4" /> Track {ch.unlockLevel + 1}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 font-display text-lg">{ch.label}</p>
              <p className="text-xs text-cream/60">
                Reward <span className="text-gold">+{ch.reward} coins</span>
              </p>
              {status === "available" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    data-ui
                    onClick={() => onClaim(ch.id, false)}
                    className="min-h-10 flex-1 rounded-full bg-gold font-display text-sm text-ink"
                  >
                    Claim {ch.reward}
                  </button>
                  <button
                    type="button"
                    data-ui
                    onClick={() => onClaim(ch.id, true)}
                    className="min-h-10 flex-1 rounded-full bg-coral font-display text-sm text-cream"
                  >
                    Get 2× {ch.reward * 2}
                  </button>
                </div>
              ) : status === "locked" ? (
                <div className="mt-3 flex items-center gap-2 rounded-full bg-cream/5 px-3 py-2 text-xs text-cream/50">
                  <Lock className="size-4" /> Unlock at track {ch.unlockLevel + 1}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SheetShell>
  );
}

function missionLabel(id: string) {
  switch (id) {
    case "coins":
      return "Collect 30 coins";
    case "race":
      return "Finish 3 races";
    case "podium":
      return "Take 2 podiums";
    case "clean":
      return "Finish a race without wiping out";
    case "beat":
      return "Beat 4 rivals";
    default:
      return "Daily challenge";
  }
}

function RecordsSheet({
  save,
  tab,
  onTab,
  onClose,
}: {
  save: Save;
  tab: "stats" | "times";
  onTab: (t: "stats" | "times") => void;
  onClose: () => void;
}) {
  const rank = rankOf(save.wins);
  const next = RANKS.find((r) => r.at > save.wins);
  const entries = Object.entries(save.records)
    .map(([key, rec]) => ({ id: Number(key), rec }))
    .filter((e) => Number.isFinite(e.id))
    .sort((a, b) => a.rec.place - b.rec.place || a.rec.time - b.rec.time)
    .slice(0, 12);
  return (
    <SheetShell title="Records" subtitle="Local tour leaderboard — just you and the clock" onClose={onClose}>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-cream/10 p-1">
        {(["stats", "times"] as const).map((id) => (
          <button
            key={id}
            type="button"
            data-ui
            onClick={() => onTab(id)}
            className={`min-h-9 rounded-full px-3 font-display text-sm capitalize ${
              tab === id ? "bg-gold text-ink" : "text-cream/70"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === "stats" ? (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-cream/5 p-4">
            <span
              className="flex size-12 items-center justify-center rounded-full text-ink"
              style={{ background: rank.color }}
            >
              <Crown className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl">{rank.name}</p>
              <p className="text-xs text-cream/60">
                {next ? `${next.at - save.wins} wins to ${next.name}` : "Top rank reached"}
              </p>
            </div>
            <p className="font-display text-2xl text-gold">{save.wins}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Races" value={save.races} />
            <Stat label="Wins" value={save.wins} />
            <Stat label="Podiums" value={save.podiums} />
            <Stat label="Clean runs" value={save.cleanRuns} />
            <Stat label="Best streak" value={save.bestStreak} />
            <Stat label="Coins earned" value={save.totalEarned} />
          </div>
          <p className="mt-4 rounded-lg bg-cream/5 p-3 text-xs leading-relaxed text-cream/60">
            Win a race to unlock the next track. Every win adds to your streak and pushes you toward
            Champion and Legend.
          </p>
        </>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.length === 0 ? (
            <p className="rounded-lg bg-cream/5 p-4 text-sm text-cream/65">
              No finishes yet. Your best times appear here after your first race.
            </p>
          ) : (
            entries.map((entry, index) => {
              const name = entry.id === CUSTOM_LEVEL_ID ? "Fun City" : LEVELS[entry.id]?.name ?? "Unknown";
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg bg-cream/5 p-3">
                  <span className="w-6 shrink-0 font-display text-gold">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm">{name}</p>
                    <p className="text-[11px] text-cream/55">
                      {entry.rec.place === 1 ? "Won" : `${ordinal(entry.rec.place)} place`}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm tabular-nums text-cream/80">
                    {formatTime(entry.rec.time)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </SheetShell>
  );
}

function AchievementsSheet({
  save,
  onClaim,
  onClose,
}: {
  save: Save;
  onClaim: (id: string) => void;
  onClose: () => void;
}) {
  const claimed = save.achievements.filter((a) => a.claimed).length;
  const total = save.achievements.length;
  return (
    <SheetShell title="Achievements" subtitle={`${claimed} / ${total} unlocked`} onClose={onClose} wide>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {save.achievements.map((a) => {
          const done = a.progress >= a.target;
          const ready = done && !a.claimed;
          return (
            <div
              key={a.id}
              className={`rounded-xl border p-3 ${
                a.claimed ? "border-gold/40 bg-gold/10" : "border-cream/15 bg-cream/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-sm text-cream">{achievementLabel(a.id as AchievementId)}</p>
                  <p className="text-[11px] text-cream/60">
                    {Math.min(a.progress, a.target)} / {a.target} · +{a.reward} coins
                  </p>
                </div>
                <button
                  type="button"
                  data-ui
                  disabled={!ready}
                  onClick={() => onClaim(a.id)}
                  className={`min-h-8 shrink-0 rounded-full px-3 font-display text-xs ${
                    ready ? "bg-gold text-ink" : a.claimed ? "bg-cream/10 text-gold" : "bg-cream/10 text-cream/50"
                  }`}
                >
                  {a.claimed ? "Claimed" : ready ? "Claim" : `${Math.round((a.progress / a.target) * 100)}%`}
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/60">
                <div
                  className="h-full rounded-full bg-mint"
                  style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SheetShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-cream/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-cream/55">{label}</p>
      <p className="font-display text-xl text-gold">{value}</p>
    </div>
  );
}

function CitySheet({
  save,
  onAdd,
  onRemove,
  onMove,
  onPlay,
  onBuyDecor,
  onSellTickets,
  onClose,
}: {
  save: Save;
  onAdd: (id: CustomTileId) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onPlay: () => void;
  onBuyDecor: (id: DecorId) => void;
  onSellTickets: () => void;
  onClose: () => void;
}) {
  return (
    <SheetShell title="Fun City" subtitle="Build a course, then race it as often as you like" onClose={onClose}>
      <div className="mt-4 rounded-xl bg-cream/5 p-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm text-gold">Your course</p>
          <span className="text-[11px] text-cream/55">{save.custom.length} / 12 tiles</span>
        </div>
        {save.custom.length === 0 ? (
          <p className="mt-2 text-sm text-cream/60">Add a tile below to start building.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {save.custom.map((tile, index) => {
              const def = CUSTOM_TILES.find((t) => t.id === tile) ?? CUSTOM_TILES[0];
              return (
                <li key={`${tile}-${index}`} className="flex items-center gap-2 rounded-lg bg-ink/50 px-2 py-1.5">
                  <span className="w-5 text-center text-lg text-gold">{def.glyph}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-sm">{def.name}</span>
                  <button
                    type="button"
                    data-ui
                    aria-label={`Move ${def.name} earlier`}
                    onClick={() => onMove(index, -1)}
                    className="flex size-8 items-center justify-center rounded-full bg-cream/10"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    data-ui
                    aria-label={`Move ${def.name} later`}
                    onClick={() => onMove(index, 1)}
                    className="flex size-8 items-center justify-center rounded-full bg-cream/10"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    data-ui
                    aria-label={`Remove ${def.name}`}
                    onClick={() => onRemove(index)}
                    className="flex size-8 items-center justify-center rounded-full bg-coral/80"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-cream/5 p-3">
        <p className="font-display text-sm text-gold">Fun City bank</p>
        <p className="mt-1 text-xs text-cream/65">
          Win a Fun City race and bank tickets. Trade 10 tickets for 1 gem.
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-display text-lg text-cream">{save.tickets} tickets</span>
          <button
            type="button"
            data-ui
            onClick={onSellTickets}
            disabled={save.tickets < 10}
            className="rounded-full bg-gold px-3 py-2 font-display text-sm text-ink disabled:opacity-40"
          >
            Sell for gems
          </button>
        </div>
      </div>

      <p className="mt-6 font-display text-sm text-gold">Decorate the city</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FUN_CITY_DECOR.map((d) => {
          const owned = save.decor.includes(d.id);
          const afford = save.gems >= d.cost;
          return (
            <button
              key={d.id}
              type="button"
              data-ui
              disabled={owned || !afford}
              onClick={() => onBuyDecor(d.id)}
              className={`flex min-h-12 items-center gap-2 rounded-lg px-3 font-display text-sm ${
                owned ? "bg-cream/10 opacity-50" : "bg-cream/10"
              } disabled:opacity-40`}
            >
              <span className="text-lg">{d.glyph}</span>
              {d.name}
              <span className="ml-auto text-xs text-cream/60">{d.cost}g</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-cream/55">
        City level {save.cityLevel} · {save.gems} gems
      </p>

      <p className="mt-4 font-display text-sm text-gold">Add a tile</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CUSTOM_TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            data-ui
            onClick={() => onAdd(tile.id)}
            className="flex min-h-12 items-center gap-2 rounded-lg bg-cream/10 px-3 font-display text-sm"
          >
            <span className="text-lg text-gold">{tile.glyph}</span>
            {tile.name}
            <Plus className="ml-auto size-4 text-cream/50" />
          </button>
        ))}
      </div>

      <button
        type="button"
        data-ui
        onClick={onPlay}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold font-display text-xl text-ink"
      >
        <Play className="size-5" />
        Race Fun City
      </button>
      <p className="mt-2 text-center text-xs text-cream/55">
        Bots scale with course length. Hazards are placed automatically.
      </p>
    </SheetShell>
  );
}

function Hud({ hud, paused, onPause }: { hud: HudPayload; paused: boolean; onPause: () => void }) {
  const pct = Math.max(0, Math.min(100, (hud.s / hud.length) * 100));
  const [go, setGo] = useState(false);
  const prevCount = useRef(hud.countdown);

  useEffect(() => {
    if (prevCount.current > 0 && hud.countdown <= 0) {
      setGo(true);
      const t = window.setTimeout(() => setGo(false), 850);
      prevCount.current = hud.countdown;
      return () => window.clearTimeout(t);
    }
    prevCount.current = hud.countdown;
  }, [hud.countdown]);

  const counting = hud.countdown > 0 || go;
  const lastCutFresh = hud.lastCut != null && hud.time - hud.lastCut.t < 2.4;
  const shownPlace = hud.place;

  return (
    <>
      {counting ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            key={go ? "go" : Math.ceil(hud.countdown)}
            className={`countdown-pop font-display text-[6.5rem] leading-none drop-shadow-[0_6px_0_rgba(20,32,51,0.5)] sm:text-[9rem] ${
              go ? "text-gold" : "text-cream"
            }`}
          >
            {go ? "GO!" : Math.ceil(hud.countdown)}
          </span>
        </div>
      ) : null}

      <SpeedLines power={hud.speed / Math.max(1, hud.maxSpeed)} />

      <div className="flex items-start justify-between px-4">
        <div className="rounded-2xl bg-ink/70 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <p className="max-w-40 truncate font-display text-sm tracking-wide text-gold">{hud.name}</p>
            {hud.mode === "elimination" ? (
              <span className="rounded-full bg-coral px-2 py-0.5 font-display text-[10px] uppercase tracking-wide">
                Cut
              </span>
            ) : null}
          </div>
          <p className="font-display text-4xl leading-none text-cream drop-shadow-sm">
            {ordinal(shownPlace)}{" "}
            <span className="text-base text-cream/70">of {hud.alive}</span>
          </p>
          {hud.mode === "elimination" ? (
            <p className="mt-0.5 text-[11px] text-cream/65">{hud.alive} still running</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <p className="rounded-full bg-ink/75 px-3 py-2 font-display text-lg tabular-nums">
            {formatTime(hud.time)}
          </p>
          {paused ? null : (
            <button
              type="button"
              data-ui
              aria-label="Pause"
              onClick={onPause}
              className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-ink/80"
            >
              <Pause className="size-5" />
            </button>
          )}
        </div>
      </div>

      {lastCutFresh && hud.lastCut ? (
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-coral px-4 py-2 font-display text-sm text-cream shadow-lg">
          {hud.lastCut.me ? "You were cut!" : `${hud.lastCut.name} was cut!`}
        </div>
      ) : null}

      <div className="mt-auto px-4 pb-4 md:pb-8">
        {hud.hint ? (
          <p className="hint-pulse mb-3 text-center font-display text-2xl text-cream drop-shadow-sm">{hud.hint}</p>
        ) : (
          <p className="mb-3 text-center font-display text-sm text-cream/80">
            Release to wait · slide to dodge
          </p>
        )}
        <div className="relative mx-auto h-3 max-w-xl rounded-full bg-ink/50">
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          {hud.mode === "elimination" && hud.gate != null ? (
            <span
              className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-coral ring-2 ring-cream/70"
              style={{ left: `${Math.max(0, Math.min(100, (hud.gate / hud.length) * 100))}%` }}
              title="Elimination gate"
            />
          ) : null}
          {hud.rivals.map((r) => (
            <span
              key={r.name}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                r.me ? "size-4 ring-2 ring-cream" : "size-3"
              } ${r.eliminated ? "opacity-30" : ""}`}
              style={{
                left: `${Math.max(0, Math.min(100, (r.s / hud.length) * 100))}%`,
                background: r.color,
              }}
            />
          ))}
        </div>
        <div className="mx-auto mt-1 flex max-w-xl items-center justify-between text-xs font-display text-cream/80">
          <span>Start</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
          <span>Finish</span>
        </div>
      </div>
    </>
  );
}

function SpeedLines({ power }: { power: number }) {
  if (power < 0.55) return null;
  const opacity = Math.min(0.75, (power - 0.55) * 1.9);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity }} aria-hidden>
      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="streak"
          style={{
            left: `${s.x}%`,
            height: `${s.h}vh`,
            animationDuration: `${s.d}s`,
            animationDelay: `-${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function PauseCard({
  mode,
  onResume,
  onRetry,
  onQuit,
}: {
  mode: RaceMode;
  onResume: () => void;
  onRetry: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <section className="pointer-events-auto w-full max-w-sm sm:max-w-md rounded-xl bg-ink/92 p-6 text-center">
        <h2 className="font-display text-4xl">Paused</h2>
        <p className="mt-1 text-xs uppercase tracking-wide text-cream/55">
          {mode === "elimination" ? "Elimination race" : "Classic race"}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            data-ui
            onClick={onResume}
            className="min-h-12 rounded-full bg-gold font-display text-xl text-ink"
          >
            Resume
          </button>
          <button
            type="button"
            data-ui
            onClick={onRetry}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-display text-lg text-ink"
          >
            <RotateCcw className="size-4" />
            Retry
          </button>
          <button type="button" data-ui onClick={onQuit} className="min-h-12 rounded-full font-display text-lg text-cream">
            Home
          </button>
        </div>
      </section>
    </div>
  );
}

function Results({
  result,
  earned,
  unlocked,
  onRetry,
  onNext,
  onLevels,
  onHome,
}: {
  result: FinishPayload;
  earned: number;
  unlocked: number;
  onRetry: () => void;
  onNext: () => void;
  onLevels: () => void;
  onHome: () => void;
}) {
  const won = result.place === 1 && !result.eliminated;
  const hasNext =
    won && !result.eliminated && result.levelId < LEVELS.length - 1 && unlocked > result.levelId + 1 && result.levelId !== ENDLESS_LEVEL_ID;
  const length = result.levelId === CUSTOM_LEVEL_ID ? 1 : LEVELS[result.levelId]?.track.length ?? 1;
  const name = result.levelId === CUSTOM_LEVEL_ID ? "Fun City" : LEVELS[result.levelId]?.name ?? "Race";
  const title = result.eliminated ? "Eliminated" : won ? (result.mode === "elimination" ? "Last cat standing" : result.mode === "endless" ? "Endless complete!" : "Flag taken") : `${ordinal(result.place)} place`;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <section className="pointer-events-auto max-h-full w-full max-w-md sm:max-w-lg overflow-y-auto rounded-xl bg-ink/92 p-6">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-14 shrink-0 items-center justify-center rounded-full font-display text-2xl ${
              won ? "bg-gold text-ink" : result.eliminated ? "bg-coral text-cream" : "bg-cream/15 text-cream"
            }`}
          >
            {won ? <Trophy className="size-7" /> : result.eliminated ? <Zap className="size-7" /> : ordinal(result.place)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm text-gold">
              {name}
              {result.mode === "elimination" ? " · elimination" : ""}
            </p>
            <h2 className="font-display text-3xl leading-none sm:text-4xl">{title}</h2>
          </div>
        </div>
        <p className="mt-3 text-cream/80">
          {formatTime(result.time)}
          {result.tumbles === 0 ? " · clean run" : ` · ${result.tumbles} wipe${result.tumbles === 1 ? "" : "s"}`}
        </p>
        <ol className="mt-4 space-y-2">
          {result.standings.map((row) => (
            <li
              key={row.name}
              className={`flex items-center justify-between gap-3 text-sm ${
                row.eliminated ? "opacity-55" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: row.color }} />
                <span className={`truncate ${row.me ? "font-display text-gold" : ""}`}>
                  {row.eliminated ? <s>{row.name}</s> : row.name}
                </span>
                {row.eliminated ? (
                  <span className="shrink-0 rounded-full bg-coral px-1.5 py-0.5 font-display text-[9px] uppercase">
                    cut
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums text-cream/70">
                {row.eliminated
                  ? "out"
                  : row.done
                    ? formatTime(row.time)
                    : `${Math.round(Math.min(99, (row.s / length) * 100))}%`}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 font-display text-xl text-gold">+{earned} coins</p>
        {!won && !result.eliminated ? (
          <p className="mt-1 text-sm text-cream/75">Win the race to open the next track.</p>
        ) : null}
        {result.eliminated ? (
          <p className="mt-1 text-sm text-cream/75">Beat the gate next time — the last runner through gets cut.</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3">
          {hasNext ? (
            <button
              type="button"
              data-ui
              onClick={onNext}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold font-display text-xl text-ink"
            >
              Next track
              <ChevronRight className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            data-ui
            onClick={onRetry}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-display text-lg text-ink"
          >
            <RotateCcw className="size-4" />
            Run it again
          </button>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button
              type="button"
              data-ui
              onClick={onLevels}
              className="min-h-11 rounded-full bg-cream/10 font-display text-base text-gold"
            >
              All tracks
            </button>
            <button
              type="button"
              data-ui
              onClick={onHome}
              className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-cream/10 font-display text-base text-cream"
            >
              <HomeIcon className="size-4" />
              Home
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SteerButton({ dir, label }: { dir: 1 | -1; label: string }) {
  return (
    <button
      type="button"
      data-steer={dir}
      aria-label={label}
      className="pointer-events-auto flex size-16 items-center justify-center rounded-full bg-ink/75 text-cream"
    >
      {dir > 0 ? <ChevronLeft className="size-8" /> : <ChevronRight className="size-8" />}
    </button>
  );
}
