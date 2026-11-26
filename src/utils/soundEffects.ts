type SoundKey = "step" | "fanfare";

const SOUND_FILES: Record<SoundKey, string> = {
  step: "sounds/step.mp3",
  fanfare: "sounds/fanfare.wav",
};

// Synthesized Audio Haptics for UI pops/snaps/wake + Acoustic Marimba for steps & fanfare
class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private buffers = new Map<SoundKey, AudioBuffer>();
  private loading = new Map<SoundKey, Promise<AudioBuffer | null>>();

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private getContext(): AudioContext | null {
    if (this.isMuted || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private async loadBuffer(key: SoundKey, ctx: AudioContext): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return cached;

    const inflight = this.loading.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      try {
        const res = await fetch(SOUND_FILES[key]);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(key, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.loading.delete(key);
      }
    })();

    this.loading.set(key, promise);
    return promise;
  }

  private playBuffer(key: SoundKey, volume = 0.45, playbackRate = 1): void {
    const ctx = this.getContext();
    if (!ctx) return;

    void this.loadBuffer(key, ctx).then((buffer) => {
      if (!buffer || this.isMuted) return;
      try {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      } catch {
        // Ignore playback errors
      }
    });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.playPop(520);
    }
    return this.isMuted;
  }

  // Soft organic wooden / bubble pop (original)
  public playPop(freq: number = 480) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // AudioContext error safeguard
    }
  }

  // Crisp mechanical puzzle snap / interlocking click (original)
  public playPuzzleSnap() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(540, now);
      osc1.frequency.exponentialRampToValueAtTime(860, now + 0.03);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.045);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(720, now + 0.025);
      gain2.gain.setValueAtTime(0.18, now + 0.025);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.025);
      osc2.stop(now + 0.09);
    } catch {
      // Ignore playback errors
    }
  }

  // Acoustic marimba major scale: Do, Re, Mi, Fa, Sol, La, Ti, Do
  public playMarimba(noteIndex: number = 0) {
    const semitones = [0, 2, 4, 5, 7, 9, 11, 12];
    const step = semitones[noteIndex % semitones.length];
    const rate = Math.pow(2, step / 12);
    this.playBuffer("step", 0.45, rate);
  }

  // Wake chime (original friendly two-tone whistle)
  public playWakeChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.0, now + 0.1);
      gain2.gain.setValueAtTime(0.18, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.29);
    } catch {
      // Ignore playback errors
    }
  }

  // Custom G-major marimba fanfare (la sol la si do, fa mi re do do)
  public playFanfare() {
    this.playBuffer("fanfare", 0.55);
  }
}

export const sound = new SoundEngine();
