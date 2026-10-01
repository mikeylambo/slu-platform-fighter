/** Synth score and effects are presentation-only; authored stems can replace them. */
export class AudioPort {
  private buffers = new Map<string, AudioBuffer>();
  private stems = new Map<string, string[]>();
  private activeStage = '';
  private stemNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private context: AudioContext | null = null;
  private volume: GainNode | null = null;
  private music: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private duckUntil = 0;
  enabled = true;
  sfxVolume = 0.6;
  musicVolume = 0.25;
  voiceVolume = 0.8;
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.volume = this.context.createGain();
      this.music = this.context.createGain();
      this.volume.connect(this.context.destination);
      this.music.connect(this.context.destination);
      void this.loadManifest();
    }
    void this.context.resume();
  }
  async loadManifest() {
    try {
      const data = (await fetch(new URL('audio.manifest.json', document.baseURI)).then((r) => r.json())) as {
        sfx: Record<string, string>;
        voice: Record<string, string>;
        stems: Record<string, string[]>;
      };
      const entries = [...Object.entries(data.sfx), ...Object.entries(data.voice)];
      for (const [stage, urls] of Object.entries(data.stems)) {
        const keys = urls.map((_, i) => `stem:${stage}:${i}`);
        this.stems.set(stage, keys);
        urls.forEach((url, i) => entries.push([keys[i]!, url]));
      }
      await Promise.all(
        entries.map(async ([key, url]) => {
          if (!url) return;
          try {
            const response = await fetch(url);
            if (response.ok) this.buffers.set(key, await this.context!.decodeAudioData(await response.arrayBuffer()));
          } catch {
            /* Synth fallback remains available. */
          }
        }),
      );
    } catch {
      /* Empty manifests use the synthesized bank. */
    }
  }
  private tone(freq: number, duration: number, at: number, type: OscillatorType, gain: number, bus: GainNode) {
    const ctx = this.context!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    o.connect(g);
    g.connect(bus);
    o.start(at);
    o.stop(at + duration + 0.01);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  cue(kind: string) {
    if (!this.context || !this.volume || !this.enabled) return;
    const ctx = this.context;
    this.volume.gain.value = this.sfxVolume * 0.12;
    const freq: Record<string, number> = {
      hit: 110,
      jump: 420,
      stance: 260,
      menu: 660,
      clank: 1500,
      clash: 1200,
      parry: 1900,
      block: 180,
      'guard-break': 65,
      shatter: 42,
      fracture: 55,
      kindle: 220,
      throw: 140,
      'blade-hit': 760,
      recall: 520,
      'round-win': 330,
    };
    const hz = freq[kind] ?? 320;
    let t = ctx.currentTime;
    const sample = this.buffers.get(kind);
    if (sample) {
      const source = ctx.createBufferSource();
      source.buffer = sample;
      const gain = ctx.createGain();
      gain.gain.value = kind.startsWith('voice:') ? this.voiceVolume * 0.18 : this.sfxVolume * 0.12;
      gain.connect(ctx.destination);
      if (kind.startsWith('voice:reflection')) {
        source.playbackRate.value = 0.86;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2300;
        source.connect(filter);
        filter.connect(gain);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      } else {
        source.connect(gain);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
        };
      }
      source.start(t);
      if (kind === 'shatter') this.duckUntil = t + 0.5;
      return;
    }
    if (kind.startsWith('voice:')) return;
    if (kind === 'clash') t += Math.min(0.1, Math.max(0, this.nextBeat - t));
    this.tone(
      hz,
      kind === 'shatter' ? 0.5 : 0.2,
      t,
      ['hit', 'shatter', 'block', 'fracture'].includes(kind) ? 'sawtooth' : 'sine',
      0.65,
      this.volume,
    );
    if (kind === 'shatter' || kind === 'fracture') this.duckUntil = t + 0.5;
  }
  update(fractures: number, kindled: boolean, playing: boolean, stage = 0) {
    if (!this.context || !this.music) return;
    const t = this.context.currentTime;
    this.music.gain.setTargetAtTime(
      playing && this.enabled ? this.musicVolume * (t < this.duckUntil ? 0.63 : 1) * 0.1 : 0,
      t,
      0.05,
    );
    const stageId =
      [
        'mirror-sanctum',
        'eclipse',
        'fault-screen',
        'stillwater',
        'bell-foundry',
        'skyreach',
        'hollow-throne',
        'unsworn',
        'pilgrimage',
      ][stage] ?? 'mirror-sanctum';
    const keys = this.stems.get(stageId);
    if (keys?.every((key) => this.buffers.has(key))) {
      if (this.activeStage !== stageId) {
        this.stemNodes.forEach((n) => {
          n.source.stop();
          n.gain.disconnect();
        });
        this.stemNodes = keys.map((key) => {
          const source = this.context!.createBufferSource(),
            gain = this.context!.createGain();
          source.buffer = this.buffers.get(key)!;
          source.loop = true;
          source.connect(gain);
          gain.connect(this.music!);
          source.start(t);
          return { source, gain };
        });
        this.activeStage = stageId;
      }
      this.stemNodes.forEach((n, i) =>
        n.gain.gain.setTargetAtTime(
          playing && (i === 0 || i <= Math.min(2, fractures) || (i === 3 && kindled)) ? 1 : 0,
          t,
          0.15,
        ),
      );
      return;
    }
    if (this.stemNodes.length) {
      this.stemNodes.forEach((n) => {
        n.source.stop();
        n.gain.disconnect();
      });
      this.stemNodes = [];
      this.activeStage = '';
    }
    if (!playing || t < this.nextBeat) return;
    this.nextBeat = t + 0.4;
    this.beat++;
    const roots = [55, 49, 61.735, 65.406, 46.249, 73.416, 51.913, 55, 58.27];
    const root = roots[stage % roots.length]!,
      notes = [1, 1.5, 1.1892, 1.3348, 1, 1.7818, 1.5, 1.1892];
    if (this.beat % 4 === 0) {
      this.tone(root, 1.5, t, 'triangle', 0.3, this.music);
      this.tone(root * 1.5, 1.5, t, 'sine', 0.15, this.music);
    }
    if (fractures >= 1 && this.beat % 2 === 0) this.tone(75, 0.08, t, 'triangle', 0.35, this.music);
    if (fractures >= 2) this.tone(root * 4 * notes[this.beat % 8]!, 0.32, t, 'sine', 0.18, this.music);
    if (kindled || fractures >= 3)
      this.tone(root * 8 * notes[(this.beat + 3) % 8]!, 0.2, t, 'triangle', 0.09, this.music);
  }
}
