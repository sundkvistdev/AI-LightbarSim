/**
 * Emergency Lightbar Audio Synthesis Engine (Web Audio API)
 * Simulates mechanical rotator motors, electromechanical flasher relays,
 * and high-voltage xenon strobe capacitor discharges.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private motorOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;
  private isInitialized = false;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Continuous motor hum setup
      this.motorOsc = this.ctx.createOscillator();
      this.motorOsc.type = 'triangle';
      this.motorOsc.frequency.setValueAtTime(75, this.ctx.currentTime);

      this.motorFilter = this.ctx.createBiquadFilter();
      this.motorFilter.type = 'lowpass';
      this.motorFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.motorOsc.connect(this.motorFilter);
      this.motorFilter.connect(this.motorGain);
      this.motorGain.connect(this.masterGain);

      this.motorOsc.start();
      this.isInitialized = true;
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  public resume() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMasterVolume(volume: number, enabled: boolean) {
    this.resume();
    if (!this.masterGain || !this.ctx) return;
    const target = enabled ? Math.max(0, Math.min(1, volume)) * 0.4 : 0;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  public updateMotor(activeRotatorCount: number, avgRpm: number, enabled: boolean) {
    if (!this.ctx || !this.motorGain || !this.motorOsc) return;
    if (!enabled || activeRotatorCount === 0) {
      this.motorGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
      return;
    }

    // Motor pitch scales with RPM (approx 60 - 160 Hz)
    const targetFreq = Math.max(45, Math.min(180, avgRpm * 0.9));
    const targetGain = Math.min(0.25, 0.08 + activeRotatorCount * 0.03);

    this.motorOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    this.motorGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
  }

  /**
   * Electromechanical flasher relay click (metal contact closure)
   */
  public playRelayClick() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.012);

    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(clickGain);
    clickGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.02);
  }

  /**
   * High-voltage Xenon flash discharge "pop" / capacitor snap
   */
  public playStrobePop(joules: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Fast noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.025);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200 + (joules * 50), now);
    filter.Q.setValueAtTime(3.0, now);

    const gain = this.ctx.createGain();
    const volume = Math.min(0.25, 0.06 + (joules / 30) * 0.12);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
  }
}

export const lightbarAudio = new AudioEngine();
