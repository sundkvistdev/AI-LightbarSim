/**
 * Authentic Emergency Vehicle Siren Sound Physics & Synthesis Engine
 *
 * Real electronic sirens (Whelen 295, Federal Signal PA300/Unitrol, Code 3 V-Con)
 * are NOT musical synthesizers:
 * - Strictly MONOPHONIC high-voltage switched push-pull square wave drivers.
 * - Heavy odd-harmonic series (1st, 3rd, 5th, 7th, 9th, 11th...) with zero musical chords or chorus detuning.
 * - Acoustic compression driver & cast aluminum horn loading (400Hz acoustic cutoff,
 *   throat resonance at 1150Hz and 2200Hz, upper diaphragm rolloff at 3500Hz).
 * - Analog RC capacitor charge/discharge frequency curves (Wail, Yelp, Priority).
 * - Electronic Air Horn: Harsh, low-frequency 138Hz square rasp with 820Hz horn formant,
 *   NOT a musical chord.
 * - Mechanical Q2B: Single-rotor 10-port centrifugal siren with true mechanical inertia,
 *   wind-up torque, 8-second aerodynamic coast, and port air turbulence.
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

  // Primary Siren Voice (Strictly monophonic to eliminate musical/melodic artifacts)
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  // Mechanical air turbulence noise generator (for Q2B port hiss)
  private mechAirNoiseSource: AudioBufferSourceNode | null = null;
  private mechAirNoiseFilter: BiquadFilterNode | null = null;
  private mechAirNoiseGain: GainNode | null = null;

  // Rumbler / Howler Low-Frequency Interrupter Voice
  private rumblerOsc: OscillatorNode | null = null;
  private rumblerFilter: BiquadFilterNode | null = null;
  private rumblerGain: GainNode | null = null;

  // Electronic Air Horn Voice (Harsh 138Hz square blast with air throat rasp)
  private airHornOsc: OscillatorNode | null = null;
  private airHornBuzzOsc: OscillatorNode | null = null;
  private airHornFilter: BiquadFilterNode | null = null;
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
  private mechanicalRpm = 0; // 0.0 to 1.0
  private manualFrequency = 500;
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

      // 1. Acoustic Re-entrant Horn Highpass (420Hz cutoff prevents hollow DC thud)
      this.hornHighpass = this.ctx.createBiquadFilter();
      this.hornHighpass.type = 'highpass';
      this.hornHighpass.frequency.setValueAtTime(420, this.ctx.currentTime);
      this.hornHighpass.Q.setValueAtTime(0.85, this.ctx.currentTime);

      // 2. Horn Throat Bell Resonance 1 (~1180Hz cast aluminum bell flare)
      this.throatResonance1 = this.ctx.createBiquadFilter();
      this.throatResonance1.type = 'peaking';
      this.throatResonance1.frequency.setValueAtTime(1180, this.ctx.currentTime);
      this.throatResonance1.gain.setValueAtTime(6.0, this.ctx.currentTime);
      this.throatResonance1.Q.setValueAtTime(1.6, this.ctx.currentTime);

      // 3. Horn Throat Bell Resonance 2 (~2250Hz projector peak)
      this.throatResonance2 = this.ctx.createBiquadFilter();
      this.throatResonance2.type = 'peaking';
      this.throatResonance2.frequency.setValueAtTime(2250, this.ctx.currentTime);
      this.throatResonance2.gain.setValueAtTime(4.5, this.ctx.currentTime);
      this.throatResonance2.Q.setValueAtTime(2.0, this.ctx.currentTime);

      // 4. Upper Driver Mass Rolloff (3400Hz steep lowpass eliminates artificial high-end sizzle)
      this.hornLowpass = this.ctx.createBiquadFilter();
      this.hornLowpass.type = 'lowpass';
      this.hornLowpass.frequency.setValueAtTime(3400, this.ctx.currentTime);
      this.hornLowpass.Q.setValueAtTime(1.1, this.ctx.currentTime);

      // 5. Compression Driver Transformer Saturation WaveShaper
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = this.createHornSaturationCurve(3.0);
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

      // --- 6. Primary Siren Voice (STRICTLY MONOPHONIC) ---
      // Real emergency sirens are single-frequency square-wave push-pull outputs.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = this.getOscillatorTypeForStyle();
      this.sirenOsc.frequency.setValueAtTime(650, this.ctx.currentTime);

      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.waveShaper);
      this.sirenOsc.start();

      // --- 7. Mechanical Q2B Port Air Turbulence Noise ---
      const noiseBuffer = this.createAirHissBuffer();
      this.mechAirNoiseSource = this.ctx.createBufferSource();
      this.mechAirNoiseSource.buffer = noiseBuffer;
      this.mechAirNoiseSource.loop = true;

      this.mechAirNoiseFilter = this.ctx.createBiquadFilter();
      this.mechAirNoiseFilter.type = 'bandpass';
      this.mechAirNoiseFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
      this.mechAirNoiseFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);

      this.mechAirNoiseGain = this.ctx.createGain();
      this.mechAirNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.mechAirNoiseSource.connect(this.mechAirNoiseFilter);
      this.mechAirNoiseFilter.connect(this.mechAirNoiseGain);
      this.mechAirNoiseGain.connect(this.waveShaper);
      this.mechAirNoiseSource.start();

      // --- 8. Rumbler / Howler Low-Frequency Interrupter Voice ---
      this.rumblerOsc = this.ctx.createOscillator();
      this.rumblerOsc.type = 'sawtooth';
      this.rumblerOsc.frequency.setValueAtTime(180, this.ctx.currentTime);

      this.rumblerFilter = this.ctx.createBiquadFilter();
      this.rumblerFilter.type = 'lowpass';
      this.rumblerFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
      this.rumblerFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.rumblerGain = this.ctx.createGain();
      this.rumblerGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.rumblerOsc.connect(this.rumblerFilter);
      this.rumblerFilter.connect(this.rumblerGain);
      this.rumblerGain.connect(this.analyser); // Sub-bass direct to master
      this.rumblerOsc.start();

      // --- 9. Authentic Electronic Emergency Air Horn (No Musical Chords) ---
      // Real emergency air horns are a monophonic 138Hz harsh square wave with a heavy throat resonance
      this.airHornOsc = this.ctx.createOscillator();
      this.airHornOsc.type = 'square';
      this.airHornOsc.frequency.setValueAtTime(138, this.ctx.currentTime);

      this.airHornBuzzOsc = this.ctx.createOscillator();
      this.airHornBuzzOsc.type = 'sawtooth';
      this.airHornBuzzOsc.frequency.setValueAtTime(69, this.ctx.currentTime); // Sub-octave rumble

      this.airHornFilter = this.ctx.createBiquadFilter();
      this.airHornFilter.type = 'bandpass';
      this.airHornFilter.frequency.setValueAtTime(820, this.ctx.currentTime);
      this.airHornFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

      this.airHornGain = this.ctx.createGain();
      this.airHornGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.airHornOsc.connect(this.airHornFilter);
      this.airHornBuzzOsc.connect(this.airHornFilter);
      this.airHornFilter.connect(this.airHornGain);

      // Pneumatic valve air rush
      const hornAirSource = this.ctx.createBufferSource();
      hornAirSource.buffer = noiseBuffer;
      hornAirSource.loop = true;

      const hornAirFilter = this.ctx.createBiquadFilter();
      hornAirFilter.type = 'bandpass';
      hornAirFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
      hornAirFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.airHornNoiseGain = this.ctx.createGain();
      this.airHornNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

      hornAirSource.connect(hornAirFilter);
      hornAirFilter.connect(this.airHornNoiseGain);
      this.airHornNoiseGain.connect(this.waveShaper);
      hornAirSource.start();

      this.airHornGain.connect(this.waveShaper);

      this.airHornOsc.start();
      this.airHornBuzzOsc.start();

      this.lastTimeSec = performance.now() / 1000;
      this.startPhysicsLoop();
    } catch {
      // AudioContext handled gracefully in headless contexts
    }
  }

  private getOscillatorTypeForStyle(): OscillatorType {
    switch (this.currentStyle) {
      case 'WHELEN_295':
        // Modern electronic switched push-pull square wave
        return 'square';
      case 'FED_UNITROL':
        // Classic analog California sweep with rich odd-harmonics
        return 'sawtooth';
      case 'CODE3_VCON':
        // Raw aggressive square wave with hard transistor switching
        return 'square';
      case 'MECH_Q2B':
        // Mechanical 10-port siren rotor
        return 'triangle';
      case 'EURO_MARTIN':
        // High-pressure dual pneumatic horn
        return 'square';
    }
  }

  private createHornSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = amount;
    const nSamples = 256;
    const buffer = new ArrayBuffer(nSamples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      // Hyperbolic tangent soft saturation with heavy odd-harmonic bite
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
    return Math.max(0, Math.min(1.0, this.volume * 0.44 * wattMult));
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
    if (this.sirenOsc) {
      this.sirenOsc.type = this.getOscillatorTypeForStyle();
    }
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
      this.airHornGain.gain.setValueAtTime(0.65, now);
      this.airHornNoiseGain.gain.setValueAtTime(0.25, now);
      if (this.sirenGain) {
        // Duck the siren slightly during air horn blast (standard police controller behavior)
        this.sirenGain.gain.setTargetAtTime(0.08, now, 0.02);
      }
    } else {
      this.airHornGain.gain.cancelScheduledValues(now);
      this.airHornNoiseGain.gain.cancelScheduledValues(now);
      this.airHornGain.gain.setTargetAtTime(0.0, now, 0.03);
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

      if (this.ctx && this.sirenOsc && this.sirenGain) {
        this.updateAcoustics(dt);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Continuous acoustic simulation: updates single-pitch siren frequency trajectories
   * using authentic analog RC charging curves, mechanical rotor inertia, and noise.
   */
  private updateAcoustics(dt: number) {
    if (!this.ctx || !this.sirenOsc || !this.sirenGain) return;
    const now = this.ctx.currentTime;

    let targetFreq = 650;
    let targetGain = 0;
    let rumblerTargetGain = 0;
    let mechNoiseTargetGain = 0;

    // Handle Mechanical Q2B Rotor Physics (Single 10-port bronze rotor)
    if (this.currentStyle === 'MECH_Q2B') {
      const motorSpoolRate = 0.42; // ~2.4 seconds to reach maximum 840Hz RPM
      const freeCoastDrag = 0.11;  // ~8.5 seconds free-wheeling aerodynamic coast
      const brakeDrag = 0.82;      // Mechanical brake stops rotor in ~1.2s

      const isMotorOn = this.isManualActive || this.currentMode === 'WAIL' || this.currentMode === 'MANUAL';

      if (isMotorOn) {
        this.mechanicalRpm = Math.min(1.0, this.mechanicalRpm + dt * motorSpoolRate);
      } else if (this.isBrakeActive) {
        this.mechanicalRpm = Math.max(0.0, this.mechanicalRpm - dt * brakeDrag);
      } else {
        // Aerodynamic quadratic drag curve
        this.mechanicalRpm = Math.max(
          0.0,
          this.mechanicalRpm - dt * freeCoastDrag * (0.15 + this.mechanicalRpm * 0.85)
        );
      }

      // Single pure mechanical port frequency (f = RPM * 10 ports / 60)
      // From 65 Hz growl up to 840 Hz scream
      targetFreq = 65 + this.mechanicalRpm * 775;
      targetGain = this.mechanicalRpm > 0.02 ? Math.min(0.55, 0.14 + this.mechanicalRpm * 0.41) : 0;

      // Air turbulence rushing through stator ports
      if (this.mechAirNoiseGain && this.mechAirNoiseFilter) {
        mechNoiseTargetGain = this.mechanicalRpm * 0.22;
        this.mechAirNoiseFilter.frequency.setTargetAtTime(
          targetFreq * 2.2,
          now,
          0.04
        );
      }
    } else {
      // Electronic Siren Modes (Real Non-Melodic RC Circuits)
      switch (this.currentMode) {
        case 'OFF':
          targetGain = 0;
          break;

        case 'WAIL': {
          // Authentic Analog RC Capacitor Curve:
          // Rise takes 2.2s (accelerates from 520Hz, decelerates as it approaches 1450Hz peak).
          // Fall takes 1.7s (discharges with exponential decay back down to 520Hz).
          const period = this.currentStyle === 'FED_UNITROL' ? 4.3 : 3.9;
          this.sweepPhase = (this.sweepPhase + dt / period) % 1.0;

          const riseFraction = 0.58; // 58% of time spent rising, 42% falling
          const lowF = this.currentStyle === 'FED_UNITROL' ? 480 : 520;
          const highF = this.currentStyle === 'CODE3_VCON' ? 1500 : 1440;

          if (this.sweepPhase < riseFraction) {
            // Analog RC charging: 1 - exp(-k * t)
            const t = this.sweepPhase / riseFraction;
            const rcCharge = (1 - Math.exp(-2.8 * t)) / (1 - Math.exp(-2.8));
            targetFreq = lowF + rcCharge * (highF - lowF);
          } else {
            // Analog RC discharge: exp(-k * t)
            const t = (this.sweepPhase - riseFraction) / (1 - riseFraction);
            const rcDischarge = (Math.exp(-2.5 * t) - Math.exp(-2.5)) / (1 - Math.exp(-2.5));
            targetFreq = lowF + rcDischarge * (highF - lowF);
          }

          targetGain = 0.50;
          break;
        }

        case 'YELP': {
          // Rapid sweep: 190 CPM (~0.31s period)
          // Fast rise (0.20s), sharp fall (0.11s)
          const yelpPeriod = this.currentStyle === 'CODE3_VCON' ? 0.28 : 0.31;
          this.sweepPhase = (this.sweepPhase + dt / yelpPeriod) % 1.0;

          const riseFraction = 0.65;
          const lowF = 620;
          const highF = 1480;

          if (this.sweepPhase < riseFraction) {
            const t = this.sweepPhase / riseFraction;
            targetFreq = lowF + t * (highF - lowF);
          } else {
            const t = (this.sweepPhase - riseFraction) / (1 - riseFraction);
            targetFreq = highF - t * (highF - lowF);
          }

          targetGain = 0.52;
          break;
        }

        case 'PRIORITY': {
          // High-speed intersection clear: 12 Hz sawtooth sweep (0.083s)
          // Piercing, rapid, aggressive rasp
          const priorityPeriod = 0.083;
          this.sweepPhase = (this.sweepPhase + dt / priorityPeriod) % 1.0;
          targetFreq = 780 + this.sweepPhase * 720; // 780Hz to 1500Hz
          targetGain = 0.54;
          break;
        }

        case 'HILO': {
          // Dual-Tone: Abrupt switching between two frequencies (NOT a chord!)
          const hiloPeriod = 1.05;
          this.sweepPhase = (this.sweepPhase + dt / hiloPeriod) % 1.0;
          if (this.currentStyle === 'EURO_MARTIN') {
            // DIN 14610 standard: 435 Hz (a') and 580 Hz (d'')
            targetFreq = this.sweepPhase < 0.5 ? 580 : 435;
          } else {
            // US Hi-Lo: 960 Hz and 720 Hz
            targetFreq = this.sweepPhase < 0.5 ? 960 : 720;
          }
          targetGain = 0.50;
          break;
        }

        case 'POWERCALL': {
          // Fast warble (5.5 Hz sweep rate) with raspy 38Hz intermodulation
          const powerPeriod = 0.18;
          this.sweepPhase = (this.sweepPhase + dt / powerPeriod) % 1.0;
          const sweep = this.sweepPhase < 0.5 ? this.sweepPhase * 2 : (1 - this.sweepPhase) * 2;
          targetFreq = 680 + sweep * 680;
          targetGain = 0.52;
          break;
        }

        case 'MANUAL': {
          // Analog manual pushbutton: winds up when held, coasts down when released
          const riseRate = 550; // Hz per second
          const fallRate = 320; // Hz per second
          if (this.isManualActive) {
            this.manualFrequency = Math.min(1440, this.manualFrequency + dt * riseRate);
            targetGain = 0.50;
          } else {
            this.manualFrequency = Math.max(500, this.manualFrequency - dt * fallRate);
            targetGain = this.manualFrequency > 520 ? 0.45 : 0;
          }
          targetFreq = this.manualFrequency;
          break;
        }
      }
    }

    // Apply primary frequency and gain to the single monophonic oscillator
    this.sirenOsc.frequency.setTargetAtTime(targetFreq, now, 0.012);

    if (this.isAirHornActive) {
      // Keep ducked during air horn
      this.sirenGain.gain.setTargetAtTime(0.08, now, 0.02);
    } else {
      this.sirenGain.gain.setTargetAtTime(targetGain, now, 0.02);
    }

    // Apply Mechanical Port Noise
    if (this.mechAirNoiseGain) {
      this.mechAirNoiseGain.gain.setTargetAtTime(mechNoiseTargetGain, now, 0.04);
    }

    // Apply Rumbler / Howler Sub-Bass Interrupter
    if (this.isRumblerActive && targetGain > 0.05 && this.rumblerGain && this.rumblerOsc) {
      // Sub-bass frequency is divided down to visceral 80-220Hz fundamental
      const rumblerF = Math.max(65, Math.min(240, targetFreq * 0.25));
      this.rumblerOsc.frequency.setTargetAtTime(rumblerF, now, 0.02);

      // 8Hz interrupter amplitude pulse (the classic Rumbler "thumping" modulation)
      const interrupter = Math.sin(now * Math.PI * 16) > 0 ? 0.48 : 0.08;
      rumblerTargetGain = interrupter;
      this.rumblerGain.gain.setTargetAtTime(rumblerTargetGain, now, 0.015);
    } else if (this.rumblerGain) {
      this.rumblerGain.gain.setTargetAtTime(0, now, 0.03);
    }
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// Global Singleton for low-latency responsiveness
let sirenInstance: SirenAudioEngine | null = null;

export function getSirenEngine(): SirenAudioEngine {
  if (!sirenInstance) {
    sirenInstance = new SirenAudioEngine();
  }
  return sirenInstance;
}

export const sirenAudio = getSirenEngine();
