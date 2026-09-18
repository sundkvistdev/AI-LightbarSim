/**
 * Realistic Emergency Vehicle Siren Sound Physics & Synthesis Engine
 *
 * Models the acoustic physics of 100W/200W emergency vehicle siren systems:
 * - Exponential cast-aluminum re-entrant horn driver physics (380Hz horn cutoff, throat bell resonance)
 * - Compression driver transformer saturation and odd-harmonic dispersion
 * - Multiple amplifier generations & manufacturer styles:
 *   - Whelen 295 / Modern Electronic (Crisp, aggressive pulse with sharp chirp)
 *   - Federal Signal Unitrol 8000 (Warm swept analog dual-saw with deep throat body)
 *   - Code 3 Mastercom / V-Con (Gritty, raspy, heavy odd-harmonic bite)
 *   - Federal Q2B Mechanical (10-port/12-port bronze rotor with 5:6 minor third chord, wind-up torque, 8s coast & brake)
 *   - European Martinshorn / Touch (Authentic dual-tone compressor fanfare)
 * - Optional Rumbler / Howler Low-Frequency Interrupter sub-bass punch
 * - Quad-tone pneumatic Air Horn blast with air throat turbulence
 */

export type SirenStyle =
  | 'WHELEN_295'
  | 'FED_UNITROL'
  | 'CODE3_VCON'
  | 'MECH_Q2B'
  | 'EURO_MARTIN';

export type SirenMode =
  | 'OFF'
  | 'WAIL'
  | 'YELP'
  | 'PRIORITY'
  | 'HILO'
  | 'POWERCALL'
  | 'MANUAL';

export class SirenAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private hornHighpass: BiquadFilterNode | null = null;
  private hornLowpass: BiquadFilterNode | null = null;
  private throatResonance1: BiquadFilterNode | null = null;
  private throatResonance2: BiquadFilterNode | null = null;
  private waveShaper: WaveShaperNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Primary Siren Voice Oscillators & Gains
  private sirenOsc1: OscillatorNode | null = null;
  private sirenOsc2: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  // Rumbler / Howler Sub-Frequency Interrupter Voice
  private rumblerOsc: OscillatorNode | null = null;
  private rumblerFilter: BiquadFilterNode | null = null;
  private rumblerGain: GainNode | null = null;

  // Pneumatic Air Horn Oscillators & Gain
  private airHornOsc1: OscillatorNode | null = null;
  private airHornOsc2: OscillatorNode | null = null;
  private airHornOsc3: OscillatorNode | null = null;
  private airHornGain: GainNode | null = null;
  private airHornNoiseGain: GainNode | null = null;

  // Configuration State
  private currentStyle: SirenStyle = 'WHELEN_295';
  private currentMode: SirenMode = 'OFF';
  private isAirHornActive = false;
  private isManualActive = false;
  private isBrakeActive = false;
  private isRumblerActive = false;
  private volume = 0.55;
  private isMuted = false;
  private speakerWatts: 100 | 200 = 100;

  // Physics Simulation Variables
  private lastTimeSec = 0;
  private sweepPhase = 0;
  private subPhase = 0;
  private mechanicalRpm = 0; // 0.0 to 1.0
  private animFrameId: number | null = null;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.calcEffectiveVolume(), this.ctx.currentTime);

      // Real-time Audio Analyser for VU meter
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.75;

      // 1. Acoustic Re-entrant Horn Highpass (340Hz - prevents DC mud, preserves rich 450Hz growl)
      this.hornHighpass = this.ctx.createBiquadFilter();
      this.hornHighpass.type = 'highpass';
      this.hornHighpass.frequency.setValueAtTime(340, this.ctx.currentTime);
      this.hornHighpass.Q.setValueAtTime(0.7, this.ctx.currentTime);

      // 2. Horn Throat Bell Resonance 1 (~1150Hz cast metal flare)
      this.throatResonance1 = this.ctx.createBiquadFilter();
      this.throatResonance1.type = 'peaking';
      this.throatResonance1.frequency.setValueAtTime(1150, this.ctx.currentTime);
      this.throatResonance1.gain.setValueAtTime(5.5, this.ctx.currentTime);
      this.throatResonance1.Q.setValueAtTime(1.4, this.ctx.currentTime);

      // 3. Horn Throat Bell Resonance 2 (~2100Hz brassy projector)
      this.throatResonance2 = this.ctx.createBiquadFilter();
      this.throatResonance2.type = 'peaking';
      this.throatResonance2.frequency.setValueAtTime(2100, this.ctx.currentTime);
      this.throatResonance2.gain.setValueAtTime(3.8, this.ctx.currentTime);
      this.throatResonance2.Q.setValueAtTime(1.8, this.ctx.currentTime);

      // 4. Upper Driver Rolloff (3600Hz lowpass removes sterile digital buzzing)
      this.hornLowpass = this.ctx.createBiquadFilter();
      this.hornLowpass.type = 'lowpass';
      this.hornLowpass.frequency.setValueAtTime(3600, this.ctx.currentTime);
      this.hornLowpass.Q.setValueAtTime(0.9, this.ctx.currentTime);

      // 5. Compression Driver Transformer Saturation WaveShaper
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = this.createHornSaturationCurve(2.2);
      this.waveShaper.oversample = '2x';

      // Connect Horn Acoustic Channel:
      // Sources -> WaveShaper -> Highpass -> Throat1 -> Throat2 -> Lowpass -> Analyser -> MasterGain -> Destination
      this.waveShaper.connect(this.hornHighpass);
      this.hornHighpass.connect(this.throatResonance1);
      this.throatResonance1.connect(this.throatResonance2);
      this.throatResonance2.connect(this.hornLowpass);
      this.hornLowpass.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // --- 6. Primary Siren Voice (Dual Compound Oscillators) ---
      this.sirenOsc1 = this.ctx.createOscillator();
      this.sirenOsc2 = this.ctx.createOscillator();
      this.applyStyleOscillatorTypes();

      this.sirenOsc1.frequency.setValueAtTime(650, this.ctx.currentTime);
      this.sirenOsc2.frequency.setValueAtTime(650 * 1.006, this.ctx.currentTime);

      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.sirenOsc1.connect(this.sirenGain);
      this.sirenOsc2.connect(this.sirenGain);
      this.sirenGain.connect(this.waveShaper);

      this.sirenOsc1.start();
      this.sirenOsc2.start();

      // --- 7. Rumbler / Howler Low-Frequency Sub-Bass Voice ---
      this.rumblerOsc = this.ctx.createOscillator();
      this.rumblerOsc.type = 'sawtooth';
      this.rumblerOsc.frequency.setValueAtTime(250, this.ctx.currentTime);

      this.rumblerFilter = this.ctx.createBiquadFilter();
      this.rumblerFilter.type = 'lowpass';
      this.rumblerFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.rumblerFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.rumblerGain = this.ctx.createGain();
      this.rumblerGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.rumblerOsc.connect(this.rumblerFilter);
      this.rumblerFilter.connect(this.rumblerGain);
      this.rumblerGain.connect(this.analyser); // Sub-bass direct to master
      this.rumblerOsc.start();

      // --- 8. Heavy Pneumatic Multi-Chime Air Horn Voice ---
      this.airHornOsc1 = this.ctx.createOscillator(); // 175 Hz (Fundamental Chime)
      this.airHornOsc2 = this.ctx.createOscillator(); // 310 Hz (Minor Fifth harmonic)
      this.airHornOsc3 = this.ctx.createOscillator(); // 465 Hz (High Chime)

      this.airHornOsc1.type = 'sawtooth';
      this.airHornOsc2.type = 'square';
      this.airHornOsc3.type = 'sawtooth';

      this.airHornOsc1.frequency.setValueAtTime(175, this.ctx.currentTime);
      this.airHornOsc2.frequency.setValueAtTime(312, this.ctx.currentTime);
      this.airHornOsc3.frequency.setValueAtTime(466, this.ctx.currentTime);

      this.airHornGain = this.ctx.createGain();
      this.airHornGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.airHornOsc1.connect(this.airHornGain);
      this.airHornOsc2.connect(this.airHornGain);
      this.airHornOsc3.connect(this.airHornGain);

      // Create Air Hiss Noise Buffer for pneumatic valve rush
      const noiseBuffer = this.createAirHissBuffer();
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1800, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.airHornNoiseGain = this.ctx.createGain();
      this.airHornNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(this.airHornNoiseGain);
      this.airHornNoiseGain.connect(this.waveShaper);
      noiseSource.start();

      this.airHornGain.connect(this.waveShaper);

      this.airHornOsc1.start();
      this.airHornOsc2.start();
      this.airHornOsc3.start();

      this.lastTimeSec = performance.now() / 1000;
      this.startPhysicsLoop();
    } catch {
      // AudioContext handled gracefully in headless/silent contexts
    }
  }

  /**
   * Applies the physical oscillator waveform characteristics based on amplifier style
   */
  private applyStyleOscillatorTypes() {
    if (!this.sirenOsc1 || !this.sirenOsc2) return;
    switch (this.currentStyle) {
      case 'WHELEN_295':
        // Modified square pulse with secondary harmonic
        this.sirenOsc1.type = 'square';
        this.sirenOsc2.type = 'sawtooth';
        break;
      case 'FED_UNITROL':
        // Warm rich dual sawtooth with smooth analog detune
        this.sirenOsc1.type = 'sawtooth';
        this.sirenOsc2.type = 'sawtooth';
        break;
      case 'CODE3_VCON':
        // Heavy raspy square waves with biting edge
        this.sirenOsc1.type = 'square';
        this.sirenOsc2.type = 'square';
        break;
      case 'MECH_Q2B':
        // 10-port & 12-port mechanical rotor (5:6 interval chord)
        this.sirenOsc1.type = 'triangle';
        this.sirenOsc2.type = 'sawtooth';
        break;
      case 'EURO_MARTIN':
        // Dual pneumatic air tone
        this.sirenOsc1.type = 'square';
        this.sirenOsc2.type = 'triangle';
        break;
    }
  }

  /**
   * Creates compression driver saturation curve (models iron core transformer saturation)
   */
  private createHornSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = amount;
    const nSamples = 256;
    const buffer = new ArrayBuffer(nSamples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      // Hyperbolic tangent soft saturation with odd-harmonic warmth
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private createAirHissBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No context');
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filter approximation
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.12;
    }
    return buffer;
  }

  private calcEffectiveVolume(): number {
    if (this.isMuted) return 0;
    const wattMult = this.speakerWatts === 200 ? 1.35 : 1.0;
    return Math.max(0, Math.min(1.0, this.volume * 0.42 * wattMult));
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
    this.masterGain.gain.setTargetAtTime(this.calcEffectiveVolume(), this.ctx.currentTime, 0.03);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  public setSpeakerWatts(watts: 100 | 200) {
    this.speakerWatts = watts;
    this.setVolume(this.volume);
  }

  public setStyle(style: SirenStyle) {
    this.resume();
    this.currentStyle = style;
    this.applyStyleOscillatorTypes();
  }

  public getStyle(): SirenStyle {
    return this.currentStyle;
  }

  public setMode(mode: SirenMode) {
    this.resume();
    this.currentMode = mode;
    this.sweepPhase = 0;
    if (mode === 'OFF' && this.currentStyle !== 'MECH_Q2B') {
      this.mechanicalRpm = 0;
    }
  }

  public getMode(): SirenMode {
    return this.currentMode;
  }

  public setRumbler(active: boolean) {
    this.resume();
    this.isRumblerActive = active;
  }

  public getRumbler(): boolean {
    return this.isRumblerActive;
  }

  public setAirHorn(active: boolean) {
    this.resume();
    this.isAirHornActive = active;
    if (!this.ctx || !this.airHornGain || !this.airHornNoiseGain) return;
    const now = this.ctx.currentTime;
    if (active) {
      this.airHornGain.gain.cancelScheduledValues(now);
      this.airHornNoiseGain.gain.cancelScheduledValues(now);
      this.airHornGain.gain.setValueAtTime(0.55, now);
      this.airHornNoiseGain.gain.setValueAtTime(0.22, now);
      if (this.sirenGain) {
        this.sirenGain.gain.setTargetAtTime(0.06, now, 0.02);
      }
    } else {
      this.airHornGain.gain.cancelScheduledValues(now);
      this.airHornNoiseGain.gain.cancelScheduledValues(now);
      this.airHornGain.gain.setTargetAtTime(0.0, now, 0.04);
      this.airHornNoiseGain.gain.setTargetAtTime(0.0, now, 0.03);
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
   * Return real-time audio output amplitude for UI VU meter (0.0 to 1.0)
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

  private startPhysicsLoop() {
    const tick = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(0.08, now - this.lastTimeSec);
      this.lastTimeSec = now;

      if (this.ctx && this.sirenOsc1 && this.sirenGain) {
        this.updateAcoustics(dt);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Continuous acoustic simulation: updates siren frequency trajectories,
   * mechanical rotor inertia, and rumbler sub-harmonics.
   */
  private updateAcoustics(dt: number) {
    if (!this.ctx || !this.sirenOsc1 || !this.sirenOsc2 || !this.sirenGain) return;
    const now = this.ctx.currentTime;

    let targetFreq1 = 650;
    let targetFreq2 = 655;
    let targetGain = 0;
    let rumblerTargetGain = 0;

    // Handle Mechanical Q2B Rotor Physics
    if (this.currentStyle === 'MECH_Q2B') {
      const motorSpoolRate = 0.44; // ~2.3 seconds to maximum RPM
      const freeCoastDrag = 0.11;  // ~8.5 seconds coast down with inertia
      const brakeDrag = 0.85;      // Electric brake stops rotor in ~1.2s

      const isMotorOn = this.isManualActive || this.currentMode === 'WAIL' || this.currentMode === 'MANUAL';

      if (isMotorOn) {
        this.mechanicalRpm = Math.min(1.0, this.mechanicalRpm + dt * motorSpoolRate);
      } else if (this.isBrakeActive) {
        this.mechanicalRpm = Math.max(0.0, this.mechanicalRpm - dt * brakeDrag);
      } else {
        // Natural aerodynamic coast drag
        this.mechanicalRpm = Math.max(
          0.0,
          this.mechanicalRpm - dt * freeCoastDrag * (0.2 + this.mechanicalRpm * 0.8)
        );
      }

      // Q2B 10-port (rotor 1) & 12-port (rotor 2) acoustic chord (1.20 ratio = minor third)
      const fundamental = 80 + this.mechanicalRpm * 780; // 80Hz growl up to 860Hz scream
      targetFreq1 = fundamental;
      targetFreq2 = fundamental * 1.20; // 12-port overtone!

      targetGain = this.mechanicalRpm > 0.02 ? Math.min(0.52, 0.12 + this.mechanicalRpm * 0.4) : 0;
    } else {
      // Electronic Siren Tone Modes
      switch (this.currentMode) {
        case 'OFF':
          targetGain = 0;
          break;

        case 'WAIL': {
          // Slow undulating sweep (500 Hz to 1480 Hz over 4.0s period)
          const wailPeriod = this.currentStyle === 'FED_UNITROL' ? 4.4 : 3.9;
          this.sweepPhase = (this.sweepPhase + dt / wailPeriod) % 1.0;
          const tri = this.sweepPhase < 0.5 ? this.sweepPhase * 2 : (1.0 - this.sweepPhase) * 2;
          const smooth = Math.sin((tri - 0.5) * Math.PI) * 0.5 + 0.5;

          const baseLow = this.currentStyle === 'FED_UNITROL' ? 480 : 540;
          const baseHigh = this.currentStyle === 'CODE3_VCON' ? 1520 : 1440;
          targetFreq1 = baseLow + smooth * (baseHigh - baseLow);
          targetFreq2 = targetFreq1 * (this.currentStyle === 'FED_UNITROL' ? 1.004 : 1.007);
          targetGain = 0.46;
          break;
        }

        case 'YELP': {
          // Rapid sweep (600 Hz to 1550 Hz, 185 CPM, ~0.32s period)
          const yelpPeriod = this.currentStyle === 'CODE3_VCON' ? 0.28 : 0.33;
          this.sweepPhase = (this.sweepPhase + dt / yelpPeriod) % 1.0;
          const rise =
            this.sweepPhase < 0.82
              ? this.sweepPhase / 0.82
              : 1.0 - (this.sweepPhase - 0.82) / 0.18;

          targetFreq1 = 600 + rise * 920;
          targetFreq2 = targetFreq1 * 1.006;
          targetGain = 0.48;
          break;
        }

        case 'PRIORITY': {
          // Ultra-fast piercing intersection clear (12.5 Hz rate)
          const priorityPeriod = 0.08;
          this.sweepPhase = (this.sweepPhase + dt / priorityPeriod) % 1.0;
          targetFreq1 = 760 + this.sweepPhase * 880;
          targetFreq2 = targetFreq1 * 1.009;
          targetGain = 0.5;
          break;
        }

        case 'HILO': {
          // Dual-Tone European Cadence
          const hiloPeriod = 1.05;
          this.sweepPhase = (this.sweepPhase + dt / hiloPeriod) % 1.0;
          if (this.currentStyle === 'EURO_MARTIN') {
            // Authentic 4:3 Martinshorn (435 Hz / 580 Hz)
            targetFreq1 = this.sweepPhase < 0.5 ? 580 : 435;
          } else {
            // US Hi-Lo (960 Hz / 720 Hz)
            targetFreq1 = this.sweepPhase < 0.5 ? 960 : 720;
          }
          targetFreq2 = targetFreq1 * 1.004;
          targetGain = 0.46;
          break;
        }

        case 'POWERCALL': {
          // Aggressive modulated hyper-yelp with stepped sweep
          const powerPeriod = 0.42;
          this.sweepPhase = (this.sweepPhase + dt / powerPeriod) % 1.0;
          const sweep = Math.sin(this.sweepPhase * Math.PI * 2) * 0.5 + 0.5;
          const subWobble = Math.sin(this.sweepPhase * Math.PI * 16) * 45;
          targetFreq1 = 620 + sweep * 800 + subWobble;
          targetFreq2 = targetFreq1 * 1.012;
          targetGain = 0.49;
          break;
        }

        case 'MANUAL': {
          // Manual wind-up tone with inertia coast-down
          const riseRate = 0.9;
          const fallRate = 0.35;
          if (this.isManualActive) {
            this.mechanicalRpm = Math.min(1.0, this.mechanicalRpm + dt * riseRate);
          } else {
            this.mechanicalRpm = Math.max(0.0, this.mechanicalRpm - dt * fallRate);
          }
          targetFreq1 = 440 + this.mechanicalRpm * 860;
          targetFreq2 = targetFreq1 * 1.005;
          targetGain = this.mechanicalRpm > 0.02 ? Math.min(0.48, this.mechanicalRpm * 0.6) : 0;
          break;
        }
      }
    }

    // Rumbler / Howler Sub-Bass Interrupter Processing
    if (this.isRumblerActive && targetGain > 0.1 && !this.isAirHornActive) {
      // Modulated sub-octave tone (half frequency of main siren)
      const subFreq = Math.max(160, Math.min(420, targetFreq1 * 0.5));
      this.subPhase = (this.subPhase + dt * 14) % (Math.PI * 2);
      const tremolo = Math.sin(this.subPhase) * 0.25 + 0.75;

      if (this.rumblerOsc && this.rumblerGain) {
        this.rumblerOsc.frequency.setTargetAtTime(subFreq, now, 0.02);
        rumblerTargetGain = targetGain * 0.45 * tremolo;
      }
    }

    // Suppress electronic siren during air horn blast
    if (this.isAirHornActive) {
      targetGain = Math.min(targetGain, 0.05);
      rumblerTargetGain = 0;
    }

    this.sirenOsc1.frequency.setTargetAtTime(targetFreq1, now, 0.015);
    this.sirenOsc2.frequency.setTargetAtTime(targetFreq2, now, 0.015);
    this.sirenGain.gain.setTargetAtTime(targetGain, now, 0.025);

    if (this.rumblerGain) {
      this.rumblerGain.gain.setTargetAtTime(rumblerTargetGain, now, 0.03);
    }
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
