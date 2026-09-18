/**
 * Emergency Vehicle Siren Sound Physics & Synthesis Engine
 * Realistic electro-acoustic modeling of 100W emergency vehicle sirens:
 * - Wail: Low-frequency undulating sweep (500Hz - 1450Hz, 4.2s period)
 * - Yelp: Rapid sweep (600Hz - 1550Hz, 0.35s period / 170 cpm)
 * - Priority / Phaser / Pierce: High-frequency rapid chatter (750Hz - 1650Hz, 12Hz rate)
 * - Hi-Lo: Dual-tone European style (960Hz / 720Hz alternating)
 * - Manual: Momentary motor spin-up with realistic rotational inertia and coast-down drag
 * - Air Horn: Dual-tone resonant square/saw acoustic horn blast (185Hz / 370Hz / 555Hz)
 * - Mechanical Q2B: Heavy rotor rotational inertia with manual wind and electric brake
 *
 * Acoustic Horn Modeling:
 * - 100W Compression driver wave shaping (subtle horn saturation)
 * - Re-entrant horn acoustic bandpass resonance (600Hz - 3400Hz)
 * - Real-time audio output meter data for visual feedback
 */

export type SirenMode = 'OFF' | 'WAIL' | 'YELP' | 'PRIORITY' | 'HILO' | 'MANUAL' | 'MECH_Q';

export class SirenAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private hornFilter: BiquadFilterNode | null = null;
  private resonancePeak: BiquadFilterNode | null = null;
  private waveShaper: WaveShaperNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Electronic Siren Oscillator & Gain
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  // Air Horn Oscillators & Gain
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;

  // State
  private currentMode: SirenMode = 'OFF';
  private isAirHornActive = false;
  private isManualActive = false;
  private isBrakeActive = false;
  private volume = 0.5;
  private isMuted = false;
  private speakerWatts: 100 | 200 = 100;

  // Physics animation state
  private lastTimeSec = 0;
  private sweepPhase = 0;
  private mechanicalRpm = 0; // 0 to 1
  private animFrameId: number | null = null;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume * 0.35, this.ctx.currentTime);

      // Audio Analyser for UI visual meter
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      // Re-entrant horn speaker response (Bandpass)
      this.hornFilter = this.ctx.createBiquadFilter();
      this.hornFilter.type = 'bandpass';
      this.hornFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.hornFilter.Q.setValueAtTime(0.85, this.ctx.currentTime);

      // Acoustic horn resonance throat peak (~1.1 kHz)
      this.resonancePeak = this.ctx.createBiquadFilter();
      this.resonancePeak.type = 'peaking';
      this.resonancePeak.frequency.setValueAtTime(1150, this.ctx.currentTime);
      this.resonancePeak.gain.setValueAtTime(4.0, this.ctx.currentTime);
      this.resonancePeak.Q.setValueAtTime(1.8, this.ctx.currentTime);

      // Mild compression driver saturation / soft-clipping
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = this.createSaturationCurve(1.6);
      this.waveShaper.oversample = '2x';

      // Chain: Saturation -> Throat Peak -> Horn Filter -> Analyser -> Master Gain -> Destination
      this.waveShaper.connect(this.resonancePeak);
      this.resonancePeak.connect(this.hornFilter);
      this.hornFilter.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 1. Primary Siren Continuous Tone Generator
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; // Realistic metallic siren horn overtone
      this.sirenOsc.frequency.setValueAtTime(650, this.ctx.currentTime);

      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.waveShaper);
      this.sirenOsc.start();

      // 2. Air Horn Multi-Tone Generator
      this.hornOsc1 = this.ctx.createOscillator();
      this.hornOsc2 = this.ctx.createOscillator();
      this.hornOsc1.type = 'sawtooth';
      this.hornOsc2.type = 'square';
      this.hornOsc1.frequency.setValueAtTime(190, this.ctx.currentTime); // Low fundamental
      this.hornOsc2.frequency.setValueAtTime(380, this.ctx.currentTime); // High resonant octave

      this.hornGain = this.ctx.createGain();
      this.hornGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.hornOsc1.connect(this.hornGain);
      this.hornOsc2.connect(this.hornGain);
      this.hornGain.connect(this.waveShaper);

      this.hornOsc1.start();
      this.hornOsc2.start();

      this.lastTimeSec = performance.now() / 1000;
      this.startPhysicsLoop();
    } catch {
      // Handled gracefully
    }
  }

  private createSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = amount;
    const nSamples = 256;
    const buffer = new ArrayBuffer(nSamples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public resume() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (!this.masterGain || !this.ctx) return;
    const eff = this.isMuted ? 0 : this.volume * 0.35 * (this.speakerWatts === 200 ? 1.35 : 1.0);
    this.masterGain.gain.setTargetAtTime(eff, this.ctx.currentTime, 0.04);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  public setSpeakerWatts(watts: 100 | 200) {
    this.speakerWatts = watts;
    this.setVolume(this.volume);
  }

  public setMode(mode: SirenMode) {
    this.resume();
    this.currentMode = mode;
    this.sweepPhase = 0;
  }

  public getMode(): SirenMode {
    return this.currentMode;
  }

  public setAirHorn(active: boolean) {
    this.resume();
    this.isAirHornActive = active;
    if (!this.ctx || !this.hornGain) return;
    const now = this.ctx.currentTime;
    if (active) {
      this.hornGain.gain.cancelScheduledValues(now);
      this.hornGain.gain.setValueAtTime(0.55, now);
      // Suppress siren slightly during air horn blast
      if (this.sirenGain) {
        this.sirenGain.gain.setTargetAtTime(0.08, now, 0.02);
      }
    } else {
      this.hornGain.gain.cancelScheduledValues(now);
      this.hornGain.gain.setTargetAtTime(0.0, now, 0.04);
    }
  }

  public setManual(active: boolean) {
    this.resume();
    this.isManualActive = active;
  }

  public setBrake(active: boolean) {
    this.resume();
    this.isBrakeActive = active;
  }

  /**
   * Return real-time audio output amplitude for UI meter (0.0 to 1.0)
   */
  public getOutputLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > max) max = v;
    }
    return Math.min(1.0, max * 2.2);
  }

  /**
   * Continuous acoustic and rotational physics loop
   */
  private startPhysicsLoop() {
    const tick = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(0.08, now - this.lastTimeSec);
      this.lastTimeSec = now;

      if (this.ctx && this.sirenOsc && this.sirenGain) {
        this.updateSirenPhysics(dt);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private updateSirenPhysics(dt: number) {
    if (!this.ctx || !this.sirenOsc || !this.sirenGain) return;
    const audioTime = this.ctx.currentTime;

    let targetFreq = 700;
    let targetGain = 0;

    switch (this.currentMode) {
      case 'OFF':
        targetGain = 0;
        break;

      case 'WAIL': {
        // Slow undulating pitch sweep between 540 Hz and 1450 Hz (~4.2 sec cycle)
        const wailPeriod = 4.2;
        this.sweepPhase = (this.sweepPhase + dt / wailPeriod) % 1.0;
        // Triangular / sinusoidal smooth shape
        const triangle = this.sweepPhase < 0.5 ? this.sweepPhase * 2 : (1.0 - this.sweepPhase) * 2;
        const smooth = Math.sin((triangle - 0.5) * Math.PI) * 0.5 + 0.5;
        targetFreq = 520 + smooth * 920;
        targetGain = 0.45;
        break;
      }

      case 'YELP': {
        // Fast pitch sweep between 620 Hz and 1550 Hz (~0.35 sec cycle)
        const yelpPeriod = 0.35;
        this.sweepPhase = (this.sweepPhase + dt / yelpPeriod) % 1.0;
        // Sawtooth upward rise with quick drop
        const rise = this.sweepPhase < 0.85 ? this.sweepPhase / 0.85 : 1.0 - (this.sweepPhase - 0.85) / 0.15;
        targetFreq = 620 + rise * 930;
        targetGain = 0.46;
        break;
      }

      case 'PRIORITY': {
        // Rapid piercing sweep (~13 Hz rate, 760Hz - 1650Hz)
        const priorityPeriod = 0.078;
        this.sweepPhase = (this.sweepPhase + dt / priorityPeriod) % 1.0;
        const rise = this.sweepPhase;
        targetFreq = 760 + rise * 890;
        targetGain = 0.48;
        break;
      }

      case 'HILO': {
        // Alternating European two-tone (High: 960Hz, Low: 720Hz, ~56 cpm)
        const hiloPeriod = 1.05;
        this.sweepPhase = (this.sweepPhase + dt / hiloPeriod) % 1.0;
        targetFreq = this.sweepPhase < 0.5 ? 960 : 720;
        targetGain = 0.44;
        break;
      }

      case 'MANUAL': {
        // Manual rotor spool-up and coast-down with drag
        const accelRate = 0.85; // Spin up time ~1.2s
        const dragRate = 0.32; // Coast down time ~3.1s

        if (this.isManualActive) {
          this.mechanicalRpm = Math.min(1.0, this.mechanicalRpm + dt * accelRate);
        } else {
          this.mechanicalRpm = Math.max(0.0, this.mechanicalRpm - dt * dragRate * (0.35 + this.mechanicalRpm * 0.65));
        }

        targetFreq = 380 + this.mechanicalRpm * 880;
        targetGain = this.mechanicalRpm > 0.02 ? Math.min(0.46, this.mechanicalRpm * 0.65) : 0;
        break;
      }

      case 'MECH_Q': {
        // Authentic electro-mechanical Federal Q2B siren
        // Heavy rotor mass: slow acceleration, long inertia coast-down, electric brake
        const motorTorque = 0.45; // Spins up over ~2.2s
        const coastDrag = 0.11; // Long 9-second coast down!
        const brakeDrag = 0.85; // Rapid deceleration with brake

        if (this.isManualActive) {
          // Motor contactor energized
          this.mechanicalRpm = Math.min(1.0, this.mechanicalRpm + dt * motorTorque);
        } else if (this.isBrakeActive) {
          // Brake engaged
          this.mechanicalRpm = Math.max(0.0, this.mechanicalRpm - dt * brakeDrag);
        } else {
          // Free spinning coast
          this.mechanicalRpm = Math.max(0.0, this.mechanicalRpm - dt * coastDrag * (0.2 + this.mechanicalRpm * 0.8));
        }

        // Q-siren pitch range from 260Hz deep growl to 1100Hz piercing scream
        targetFreq = 260 + this.mechanicalRpm * 840;
        targetGain = this.mechanicalRpm > 0.015 ? Math.min(0.48, 0.12 + this.mechanicalRpm * 0.4) : 0;
        break;
      }
    }

    // Do not sound siren tone if air horn is overriding unless running background
    if (this.isAirHornActive) {
      targetGain = Math.min(targetGain, 0.06);
    }

    this.sirenOsc.frequency.setTargetAtTime(targetFreq, audioTime, 0.02);
    this.sirenGain.gain.setTargetAtTime(targetGain, audioTime, 0.03);
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const sirenAudio = new SirenAudioEngine();
