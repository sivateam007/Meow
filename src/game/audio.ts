export type AudioBus = ReturnType<typeof createAudio>;

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let muted = false;
  let musicOn = false;
  let nextNote = 0;
  let step = 0;
  let timer = 0;
  let noise: AudioBuffer | null = null;

  const scale = [262, 294, 330, 392, 440, 392, 330, 294];

  function ensure() {
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain();
      sfx = ctx.createGain();
      music = ctx.createGain();
      sfx.gain.value = 0.9;
      music.gain.value = 0.16;
      master.gain.value = muted ? 0 : 1;
      sfx.connect(master);
      music.connect(master);
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    when = 0,
    bus: "sfx" | "music" = "sfx",
  ) {
    const c = ensure();
    if (!c || !master) return;
    const dest = bus === "music" ? music : sfx;
    if (!dest) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + when);
    const t0 = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  function burst(gain: number, dur: number) {
    const c = ensure();
    if (!c || !noise || !sfx) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const g = c.createGain();
    const t0 = c.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfx);
    src.start(t0);
    src.stop(t0 + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  function schedule() {
    const c = ctx;
    if (!c || !musicOn) return;
    while (nextNote < c.currentTime + 0.25) {
      const freq = scale[step % scale.length];
      tone(freq, 0.18, step % 4 === 0 ? "triangle" : "sine", 0.08, nextNote - c.currentTime, "music");
      nextNote += 0.24;
      step++;
    }
    timer = window.setTimeout(schedule, 80);
  }

  return {
    unlock() {
      ensure();
    },
    resume() {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    setMuted(v: boolean) {
      muted = v;
      const c = ensure();
      if (c && master) master.gain.setTargetAtTime(v ? 0 : 1, c.currentTime, 0.03);
    },
    startMusic() {
      const c = ensure();
      if (!c || musicOn) return;
      musicOn = true;
      nextNote = c.currentTime + 0.05;
      schedule();
    },
    stopMusic() {
      musicOn = false;
      if (timer) window.clearTimeout(timer);
      timer = 0;
    },
    beep() {
      tone(620, 0.1, "square", 0.09);
    },
    go() {
      tone(523, 0.1, "square", 0.1);
      tone(784, 0.16, "square", 0.1, 0.08);
      tone(1046, 0.2, "square", 0.09, 0.16);
    },
    coin() {
      tone(880 + Math.random() * 40, 0.07, "square", 0.08);
      tone(1320, 0.09, "square", 0.06, 0.05);
    },
    hit() {
      burst(0.35, 0.18);
      tone(110, 0.2, "sawtooth", 0.08);
    },
    foot() {
      burst(0.05, 0.05);
    },
    win() {
      tone(523, 0.12, "square", 0.1);
      tone(659, 0.12, "square", 0.1, 0.1);
      tone(784, 0.12, "square", 0.1, 0.2);
      tone(1046, 0.28, "square", 0.12, 0.3);
    },
    place() {
      tone(392, 0.14, "triangle", 0.1);
      tone(330, 0.22, "triangle", 0.08, 0.12);
    },
  };
}
