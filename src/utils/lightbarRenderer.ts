/**
 * Optical Lightbar Simulator - 2D Rasterized Optical Engine
 * Features physical filament thermal simulation, xenon strobe discharge curves,
 * fluted glass refraction, frosted cloudiness dispersion, and multi-pass coronas.
 */

import { FlutingStyle, LightbarConfig, LightElement, RenderSettings, SequencerState } from '../types';
import { blendGlassColor, hexToRgb, kelvinToRgb } from './colorUtils';

export interface SimulationState {
  timeSec: number;
  dt: number;
  rotatorAngles: Map<string, number>; // elementId -> radians
  filamentThermal: Map<string, number>; // elementId -> 0..1
  strobeEnergy: Map<string, number>; // elementId -> 0..1
  strobeLastTrigger: Map<string, number>;
  strobeBurstIndex: Map<string, number>;
  lastStepIndex: number;
}

export interface ActiveFlare {
  x: number;
  y: number;
  intensity: number; // direct forward beam intensity (creates halos)
  internalIntensity: number; // internal radiation power into dome volume
  sweepOffset: number; // lateral shift of internal beam projection for rotators
  coreColor: string;
  glowColor: string;
  element: LightElement;
  domeCloudiness: number;
  domeScratches: number;
  domeDirtHaze: number;
  flutingDensity: number;
  domeColor: string;
  flutingStyle?: FlutingStyle;
  rotationAngle?: number;
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function createDeterministicRng(seed: number): () => number {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createInitialSimulationState(): SimulationState {
  return {
    timeSec: 0,
    dt: 0.016,
    rotatorAngles: new Map(),
    filamentThermal: new Map(),
    strobeEnergy: new Map(),
    strobeLastTrigger: new Map(),
    strobeBurstIndex: new Map(),
    lastStepIndex: -1,
  };
}

export class LightbarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D context not available');
    this.ctx = context;
  }

  /**
   * Helper to calculate pixel bounding box for any lightbar or beacon structure type
   */
  public static getStructureBounds(
    config: LightbarConfig,
    canvasW: number,
    canvasH: number
  ): { barX: number; barY: number; barW: number; barH: number } {
    const sType = config.structure.type;
    const isBeacon = sType === 'cylindrical_beacon' || sType === 'teardrop_beacon';
    const isMiniBar = sType === 'mini_bar';

    let barW: number;
    let barH: number;

    if (isBeacon) {
      // Beacon: scale proportional to canvas height to preserve iconic tall vertical silhouette
      barH = Math.min(canvasH * 0.52, 275);
      barW = barH * (config.structure.widthMm / Math.max(1, config.structure.heightMm));
    } else if (isMiniBar) {
      // Mini-bar: compact mid-width footprint
      barW = Math.min(canvasW * 0.48, 500);
      barH = barW * (config.structure.heightMm / Math.max(1, config.structure.widthMm));
    } else {
      // Full lightbars, V-bars, and Bridges
      barW = Math.min(canvasW * 0.88, 1000);
      barH = Math.min(canvasH * 0.48, barW * (config.structure.heightMm / Math.max(1, config.structure.widthMm)));
    }

    const barX = (canvasW - barW) / 2;
    const barY = canvasH * 0.43 - barH / 2;
    return { barX, barY, barW, barH };
  }

  /**
   * Calculate precise 2D screen coordinate for an element, accounting for V-bar forward-swept chevron offsets
   */
  public static getElementPosition(
    elem: LightElement,
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barH: number
  ): { x: number; y: number; vYOffset: number } {
    const isVBar = config.structure.type === 'v_bar';
    const vAngleFactor = (config.structure.vAngleDeg || 24) / 24;
    // For V-bars, center pod is swept forward (offset downwards in standard front view projection)
    const vYOffset = isVBar ? (1 - 2 * Math.abs(elem.xNorm - 0.5)) * barH * 0.32 * vAngleFactor : 0;
    const x = barX + elem.xNorm * barW;
    const y = barY + barH * 0.5 + elem.yNorm * barH * 0.5 + vYOffset;
    return { x, y, vYOffset };
  }

  /**
   * Main simulation step and render pass
   */
  public render(
    config: LightbarConfig,
    settings: RenderSettings,
    sequencer: SequencerState,
    state: SimulationState,
    onAudioTrigger?: {
      onRelay?: () => void;
      onStrobe?: (joules: number) => void;
    }
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Calculate Sequencer Active Steps
    const secondsPerBeat = 60 / Math.max(20, sequencer.bpm);
    const stepCount = 16;
    const stepDuration = secondsPerBeat / 4; // 16th notes
    const currentStepIndex = Math.floor((state.timeSec / stepDuration) % stepCount);

    const isStepTransition = currentStepIndex !== state.lastStepIndex;
    if (isStepTransition) {
      state.lastStepIndex = currentStepIndex;
      if (settings.audioEnabled && onAudioTrigger?.onRelay) {
        onAudioTrigger.onRelay();
      }
    }

    const stepA = sequencer.customStepsA[currentStepIndex % sequencer.customStepsA.length] ?? false;
    const stepB = sequencer.customStepsB[currentStepIndex % sequencer.customStepsB.length] ?? false;
    const stepC = sequencer.customStepsC[currentStepIndex % sequencer.customStepsC.length] ?? false;

    // 2. Clear canvas with atmosphere background
    this.renderAtmosphereBackground(settings, width, height, state.timeSec);

    // 3. Layout geometry with dynamic structure type bounds
    const { barX, barY, barW, barH } = LightbarRenderer.getStructureBounds(config, width, height);

    // 4. Render Vehicle Roof & Mountings
    this.renderVehicleMountings(config, settings, barX, barY, barW, barH);

    // 5. Render Housing Backplane & Frame
    this.renderHousingFrame(config, barX, barY, barW, barH);

    // 6. Update and render Elements (Internal lamps, rotators, strobes)
    const activeFlares: Array<ActiveFlare> = [];

    // Pre-calculate element active states & update physics
    config.elements.forEach((elem) => {
      if (!elem.enabled) return;

      const { x: elemX, y: elemY } = LightbarRenderer.getElementPosition(
        elem,
        config,
        barX,
        barY,
        barW,
        barH
      );

      // Dynamic element size based on structure type
      const isBeacon = config.structure.type === 'cylindrical_beacon' || config.structure.type === 'teardrop_beacon';
      const elemRenderSize = isBeacon
        ? (config.elements.length > 2 ? barH * 0.44 : barH * 0.68)
        : barH * 0.7;

      // Find overlapping dome section for glass color and optics
      const matchingDome = config.domes.find(
        (d) => elem.xNorm >= d.startX && elem.xNorm <= d.endX
      ) || config.domes[0];

      const domeColor = matchingDome ? matchingDome.color : '#ffffff';
      const domeOpacity = matchingDome ? matchingDome.opacity : 0.8;
      const domeCloud = matchingDome ? matchingDome.cloudiness : 0.2;
      const domeScratches = matchingDome ? matchingDome.wear.scratches : 0;
      const domeDirtHaze = matchingDome ? matchingDome.wear.dirtHaze : 0;
      const flutingDensity = matchingDome?.fluting.density || 20;
      const flutingStyle = matchingDome?.fluting.style || 'smooth_optic';

      // Element Type Simulation
      if (elem.type === 'rotating_halogen' && elem.rotator) {
        // Rotator angle physics
        let currentAngle = state.rotatorAngles.get(elem.id) || (elem.rotator.phaseOffsetDeg * Math.PI) / 180;
        const rpm = elem.rotator.rpm * sequencer.rotatorSpeedMultiplier;
        const radPerSec = (rpm * 2 * Math.PI) / 60 * elem.rotator.rotationDirection;
        currentAngle += radPerSec * state.dt;
        state.rotatorAngles.set(elem.id, currentAngle);

        // Calculate beam intensity towards camera (Z-axis is viewing angle)
        let viewOffsetAngle = 0;
        if (settings.viewAngle === 'angled_iso') viewOffsetAngle = 0.45;
        if (settings.viewAngle === 'top_down') viewOffsetAngle = 1.57;

        const effectiveAngle = currentAngle - viewOffsetAngle;
        const cosAngle = Math.cos(effectiveAngle);
        const isDual = elem.rotator.reflectorType === 'dual_sided_mirror';
        const beamAlignment = isDual ? Math.abs(cosAngle) : Math.max(0, cosAngle);

        // Exponential beam spread cutoff for direct camera flash
        const exponent = Math.max(6, 120 / (elem.rotator.beamSpreadDeg || 24));
        const directionalGlow = Math.pow(beamAlignment, exponent);

        // Bulb filament warmth
        const filamentRgb = kelvinToRgb(elem.rotator.filamentWarmth || 3000);
        const blended = blendGlassColor(
          filamentRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        // Draw internal reflector mechanism
        this.renderRotatorReflector(ctx, elem, elemX, elemY, elemRenderSize, effectiveAngle, blended);

        // Active flash intensity
        const flashIntensity = directionalGlow * elem.brightness * (1 - elem.wear.fadeWear * 0.3);

        // Internal beam sweep & continuous filament radiation into the dome glass
        const sweepOffset = Math.sin(effectiveAngle) * (elemRenderSize * 1.35);
        const internalBeamProximity = Math.max(0, 0.4 + 0.6 * Math.cos(effectiveAngle));
        const continuousFilamentGlow = 0.32 * elem.brightness;
        const internalIntensity = (continuousFilamentGlow + internalBeamProximity * 1.5 * elem.brightness) * (1 - elem.wear.fadeWear * 0.2);

        if (flashIntensity > 0.04 || internalIntensity > 0.06) {
          activeFlares.push({
            x: elemX,
            y: elemY,
            intensity: flashIntensity,
            internalIntensity: internalIntensity,
            sweepOffset: sweepOffset,
            coreColor: blended.coreRgb,
            glowColor: blended.glowRgb,
            element: elem,
            domeCloudiness: domeCloud,
            domeScratches: domeScratches,
            domeDirtHaze: domeDirtHaze,
            flutingDensity: flutingDensity,
            domeColor: domeColor,
            flutingStyle: flutingStyle,
            rotationAngle: effectiveAngle,
          });
        }
      } else if (elem.type === 'static_halogen' && elem.halogen) {
        // Halogen thermal inertia simulation
        let isActive = false;
        if (elem.syncGroup === 'STEADY') isActive = true;
        else if (elem.syncGroup === 'A') isActive = stepA;
        else if (elem.syncGroup === 'B') isActive = stepB;
        else if (elem.syncGroup === 'C') isActive = stepC;

        let thermal = state.filamentThermal.get(elem.id) || 0;
        const riseTimeSec = (elem.halogen.filamentThermalRiseMs || 70) / 1000;
        const fallTimeSec = (elem.halogen.filamentThermalFallMs || 140) / 1000;

        if (isActive) {
          thermal = Math.min(1.0, thermal + state.dt / riseTimeSec);
        } else {
          thermal = Math.max(0.0, thermal - state.dt / fallTimeSec);
        }
        state.filamentThermal.set(elem.id, thermal);

        // Kelvin shifts with thermal state (cool ember orange 1800K to bright 3200K)
        const currentKelvin = 1800 + thermal * 1400;
        const filamentRgb = kelvinToRgb(currentKelvin);
        const blended = blendGlassColor(
          filamentRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        // Draw static halogen bulb envelope and reflector
        this.renderStaticHalogenBulb(ctx, elem, elemX, elemY, elemRenderSize * 0.92, thermal, blended);

        const internalIntensity = thermal * elem.brightness * 1.5;
        if (thermal > 0.03) {
          activeFlares.push({
            x: elemX,
            y: elemY,
            intensity: thermal * elem.brightness * (1 - elem.wear.fadeWear * 0.25),
            internalIntensity: internalIntensity,
            sweepOffset: 0,
            coreColor: blended.coreRgb,
            glowColor: blended.glowRgb,
            element: elem,
            domeCloudiness: domeCloud,
            domeScratches: domeScratches,
            domeDirtHaze: domeDirtHaze,
            flutingDensity: flutingDensity,
            domeColor: domeColor,
            flutingStyle: flutingStyle,
          });
        }
      } else if (elem.type === 'xenon_strobe' && elem.strobe) {
        // Xenon strobe ionization burst simulation
        let shouldTrigger = false;
        if (elem.syncGroup === 'A' && isStepTransition && stepA) shouldTrigger = true;
        else if (elem.syncGroup === 'B' && isStepTransition && stepB) shouldTrigger = true;
        else if (elem.syncGroup === 'C' && isStepTransition && stepC) shouldTrigger = true;

        let energy = state.strobeEnergy.get(elem.id) || 0;

        if (shouldTrigger) {
          energy = 1.0;
          state.strobeEnergy.set(elem.id, energy);
          state.strobeLastTrigger.set(elem.id, state.timeSec);
          if (settings.audioEnabled && onAudioTrigger?.onStrobe) {
            onAudioTrigger.onStrobe(elem.strobe.joules);
          }
        } else {
          // Strobe decays extremely fast (5-15ms)
          const decayRate = 1.0 / ((elem.strobe.flashDurationMs || 8) / 1000);
          energy = Math.max(0, energy - state.dt * decayRate * 1.5);
          state.strobeEnergy.set(elem.id, energy);
        }

        // Xenon ionized gas color
        const xenonGasRgb = hexToRgb(elem.strobe.gasTint || '#e0f2fe');
        const blended = blendGlassColor(
          xenonGasRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        this.renderXenonStrobeTube(ctx, elem, elemX, elemY, elemRenderSize * 0.85, energy, blended);

        const internalIntensity = energy * elem.brightness * 2.8;
        if (energy > 0.03) {
          activeFlares.push({
            x: elemX,
            y: elemY,
            intensity: energy * elem.brightness * 1.8,
            internalIntensity: internalIntensity,
            sweepOffset: 0,
            coreColor: blended.coreRgb,
            glowColor: blended.glowRgb,
            element: elem,
            domeCloudiness: domeCloud,
            domeScratches: domeScratches,
            domeDirtHaze: domeDirtHaze,
            flutingDensity: flutingDensity,
            domeColor: domeColor,
            flutingStyle: flutingStyle,
          });
        }
      } else {
        // Modern LED or other
        let isActive = elem.syncGroup === 'A' ? stepA : elem.syncGroup === 'B' ? stepB : stepC;
        if (elem.syncGroup === 'STEADY') isActive = true;
        const intensity = isActive ? elem.brightness : 0;
        const blended = blendGlassColor(
          { r: 255, g: 255, b: 255 },
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );
        this.renderLedModule(ctx, elem, elemX, elemY, elemRenderSize * 0.72, isActive, blended);
        const internalIntensity = intensity * 1.4;
        if (intensity > 0) {
          activeFlares.push({
            x: elemX,
            y: elemY,
            intensity: intensity,
            internalIntensity: internalIntensity,
            sweepOffset: 0,
            coreColor: blended.coreRgb,
            glowColor: blended.glowRgb,
            element: elem,
            domeCloudiness: domeCloud,
            domeScratches: domeScratches,
            domeDirtHaze: domeDirtHaze,
            flutingDensity: flutingDensity,
            domeColor: domeColor,
            flutingStyle: flutingStyle,
          });
        }
      }
    });

    // 7. Render Special Glass / Domes Covering
    // The glass sits physically over all internal elements
    this.renderGlassCovering(ctx, config, barX, barY, barW, barH, activeFlares, settings, state);

    // 8. Render Halos & Coronas (Integrated Atmospheric Dome Optics)
    if (settings.enableHalos !== false && settings.coronaIntensity > 0) {
      this.renderHalosAndCoronas(ctx, config, activeFlares, settings, barX, barY, barW, barH, width, height);
    }

    // 9. Render Volumetric Beams in Air (Upward shine - opt-in lens flare effect)
    if (settings.enableLensFlares && settings.showBeamsInAir) {
      this.renderVolumetricBeams(ctx, activeFlares, barX, barY, barW, barH, height);
    }

    // 10. Render Dynamic Roof Reflection Pool (Underlight - opt-in lens flare effect)
    if (settings.enableLensFlares && settings.roofReflection) {
      this.renderRoofLightPool(ctx, activeFlares, barX, barY + barH, barW, barH);
    }

    // 11. Subtle lens dust and optical frame border (Opt-in)
    if (settings.enableLensFlares && settings.lensDirt) {
      this.renderLensDirt(ctx, width, height, activeFlares);
    }
  }

  private renderAtmosphereBackground(
    settings: RenderSettings,
    width: number,
    height: number,
    timeSec: number
  ) {
    const ctx = this.ctx;
    ctx.save();

    if (settings.atmosphere === 'blackout_lab') {
      ctx.fillStyle = '#060709';
      ctx.fillRect(0, 0, width, height);
    } else if (settings.atmosphere === 'inspection_studio') {
      // Dark neutral studio with technical reflection grid
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#13151b');
      grad.addColorStop(0.65, '#0b0c0f');
      grad.addColorStop(1, '#050608');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Studio grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (settings.atmosphere === 'foggy_atmosphere') {
      // Deep misty blue/night fog
      const grad = ctx.createRadialGradient(
        width / 2,
        height * 0.4,
        80,
        width / 2,
        height * 0.5,
        width * 0.7
      );
      grad.addColorStop(0, '#10141e');
      grad.addColorStop(0.5, '#0a0d14');
      grad.addColorStop(1, '#040508');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Procedural fog noise layer
      ctx.fillStyle = 'rgba(180, 200, 230, 0.025)';
      for (let i = 0; i < 4; i++) {
        const cx = (width * 0.2 * i + Math.sin(timeSec * 0.4 + i) * 60 + width) % width;
        const cy = height * 0.35 + Math.cos(timeSec * 0.3 + i) * 30;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 180, 70, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Night street default
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0a0c10');
      grad.addColorStop(0.55, '#0e1118');
      grad.addColorStop(0.56, '#060709'); // Horizon / asphalt separator
      grad.addColorStop(1, '#020304');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Distant street ambient bokeh
      ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
      ctx.beginPath();
      ctx.arc(width * 0.15, height * 0.45, 12, 0, Math.PI * 2);
      ctx.arc(width * 0.85, height * 0.47, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderVehicleMountings(
    config: LightbarConfig,
    settings: RenderSettings,
    barX: number,
    barY: number,
    barW: number,
    barH: number
  ) {
    const ctx = this.ctx;
    ctx.save();

    const isBeacon = config.structure.type === 'cylindrical_beacon' || config.structure.type === 'teardrop_beacon';
    const isMiniBar = config.structure.type === 'mini_bar';
    const isBridge = config.structure.type === 'dual_beacon_bridge';

    const roofOffset = isBeacon
      ? (config.structure.mountingFeet === 'pedestal_skirt' ? 18 : 22)
      : isBridge
      ? 34
      : 28;
    const roofY = barY + barH + roofOffset;
    const roofCurveH = isBeacon ? 26 : 45;

    // Vehicle roof curvature
    const roofSpan = isBeacon ? Math.max(barW * 2.6, 380) : barW + 160;
    const roofStartX = isBeacon ? barX + barW / 2 - roofSpan / 2 : barX - 80;
    const roofEndX = isBeacon ? barX + barW / 2 + roofSpan / 2 : barX + barW + 80;

    const roofGrad = ctx.createLinearGradient(0, roofY, 0, roofY + 120);
    roofGrad.addColorStop(0, '#1c1f26');
    roofGrad.addColorStop(0.2, '#111317');
    roofGrad.addColorStop(1, '#08090b');

    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(roofStartX, roofY + roofCurveH);
    ctx.quadraticCurveTo(barX + barW / 2, roofY - (isBeacon ? 4 : 8), roofEndX, roofY + roofCurveH);
    ctx.lineTo(roofEndX + 40, roofY + 200);
    ctx.lineTo(roofStartX - 40, roofY + 200);
    ctx.closePath();
    ctx.fill();

    // Chrome roof gutters / drip rail
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Mounting Feet / Brackets
    const footStyle = config.structure.mountingFeet;

    if (isBeacon) {
      // Single center mounting under beacon
      const cx = barX + barW / 2;
      if (footStyle === 'pedestal_skirt') {
        // Classic spun chrome flared conical skirt
        const skirtTopW = barW * 0.94;
        const skirtBtmW = barW * 1.22;
        const skirtH = roofY - (barY + barH) + 4;

        const chromeGrad = ctx.createLinearGradient(cx - skirtBtmW / 2, 0, cx + skirtBtmW / 2, 0);
        chromeGrad.addColorStop(0, '#374151');
        chromeGrad.addColorStop(0.2, '#9ca3af');
        chromeGrad.addColorStop(0.45, '#ffffff');
        chromeGrad.addColorStop(0.65, '#e5e7eb');
        chromeGrad.addColorStop(0.85, '#6b7280');
        chromeGrad.addColorStop(1, '#1f2937');

        ctx.fillStyle = chromeGrad;
        ctx.beginPath();
        ctx.moveTo(cx - skirtTopW / 2, barY + barH);
        ctx.lineTo(cx + skirtTopW / 2, barY + barH);
        ctx.quadraticCurveTo(cx + skirtBtmW / 2, roofY - 2, cx + skirtBtmW / 2, roofY);
        ctx.lineTo(cx - skirtBtmW / 2, roofY);
        ctx.quadraticCurveTo(cx - skirtBtmW / 2, roofY - 2, cx - skirtTopW / 2, barY + barH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Thick rubber weather gasket ring at roof contact
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.roundRect(cx - skirtBtmW / 2 - 3, roofY - 2, skirtBtmW + 6, 7, 2);
        ctx.fill();

        // Chrome fastening studs around base rim
        ctx.fillStyle = '#f3f4f6';
        [-0.38, -0.15, 0.15, 0.38].forEach((frac) => {
          ctx.beginPath();
          ctx.arc(cx + skirtBtmW * frac, roofY - 2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (footStyle === 'magnetic_mount') {
        // Heavy-duty magnetic suction pad
        const padW = barW * 0.88;
        const padH = 14;
        ctx.fillStyle = '#111317';
        ctx.beginPath();
        ctx.roundRect(cx - padW / 2, roofY - 6, padW, padH, 3);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#27272a';
        ctx.fillRect(cx - padW / 2 + 4, roofY - 5, padW - 8, 3);
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(cx, roofY - 1, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Pedestal riser bracket
        ctx.fillStyle = '#374151';
        ctx.fillRect(cx - 18, barY + barH, 36, roofY - (barY + barH));
        ctx.fillStyle = '#09090b';
        ctx.fillRect(cx - 30, roofY - 2, 60, 8);
      }
    } else {
      // Lightbars, Bridges, and Mini-bars
      const footPositions = isMiniBar
        ? [barX + barW * 0.18, barX + barW * 0.82]
        : isBridge
        ? [barX - 10, barX + barW + 10]
        : [barX + barW * 0.12, barX + barW * 0.88];

      footPositions.forEach((fx) => {
        ctx.save();
        const footW = isBridge ? 36 : 44;
        const footH = roofY - (barY + barH) + 6;

        if (footStyle === 'chrome_gutter' || isBridge) {
          const chromeGrad = ctx.createLinearGradient(fx - footW / 2, 0, fx + footW / 2, 0);
          chromeGrad.addColorStop(0, '#4b5563');
          chromeGrad.addColorStop(0.3, '#f3f4f6');
          chromeGrad.addColorStop(0.5, '#e5e7eb');
          chromeGrad.addColorStop(0.8, '#9ca3af');
          chromeGrad.addColorStop(1, '#374151');
          ctx.fillStyle = chromeGrad;
        } else if (footStyle === 'magnetic_mount') {
          ctx.fillStyle = '#18181b';
        } else {
          ctx.fillStyle = '#1e232d';
        }

        // Vertical support pylon / bridge stanchion
        ctx.beginPath();
        ctx.roundRect(fx - 14, barY + barH, 28, footH, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rubber pad clamping base
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(fx - footW / 2, roofY - 2, footW, 10);

        // Clamping bolts
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(fx - 8, barY + barH + 12, 2.5, 0, Math.PI * 2);
        ctx.arc(fx + 8, barY + barH + 12, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    }

    ctx.restore();
  }

  private renderHousingFrame(
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barH: number
  ) {
    const ctx = this.ctx;
    ctx.save();

    const finish = config.structure.frameFinish;
    const sType = config.structure.type;

    // Helper metallic linear gradient
    const createMetalGrad = (x0: number, y0: number, x1: number, y1: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      if (finish === 'chrome' || finish === 'stainless_tubular') {
        g.addColorStop(0, '#4b5563');
        g.addColorStop(0.2, '#f3f4f6');
        g.addColorStop(0.5, '#e5e7eb');
        g.addColorStop(0.8, '#9ca3af');
        g.addColorStop(1, '#374151');
      } else if (finish === 'brushed_aluminum') {
        g.addColorStop(0, '#6b7280');
        g.addColorStop(0.3, '#9ca3af');
        g.addColorStop(0.7, '#4b5563');
        g.addColorStop(1, '#374151');
      } else {
        // Black powder-coat
        g.addColorStop(0, '#27272a');
        g.addColorStop(0.5, '#18181b');
        g.addColorStop(1, '#09090b');
      }
      return g;
    };

    if (sType === 'cylindrical_beacon') {
      // Cylindrical Beacon: Chrome tension split-clamp ring around base of dome & central motor gearbox hub
      const trayH = 18;
      const trayY = barY + barH - 4;
      const cx = barX + barW / 2;

      // Chrome split-ring dome retaining band
      const bandGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      bandGrad.addColorStop(0, '#4b5563');
      bandGrad.addColorStop(0.2, '#f3f4f6');
      bandGrad.addColorStop(0.5, '#ffffff');
      bandGrad.addColorStop(0.7, '#d1d5db');
      bandGrad.addColorStop(1, '#374151');

      ctx.fillStyle = bandGrad;
      ctx.beginPath();
      ctx.roundRect(barX - 4, trayY, barW + 8, trayH, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Split-ring tension tightening latch & bolt on right side
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(barX + barW - 6, trayY + 2, 8, trayH - 4);
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.arc(barX + barW - 2, trayY + trayH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner motor gearbox turntable & center vertical spindle shaft
      ctx.fillStyle = '#111317';
      ctx.beginPath();
      ctx.roundRect(barX + 6, barY + barH * 0.76, barW - 12, barH * 0.22, 4);
      ctx.fill();

      // Brass drive gear teeth & chrome drive spindle
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cx - 18, barY + barH * 0.82, 36, 6);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(cx - 6, barY + barH * 0.38, 12, barH * 0.46);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(cx - 6, barY + barH * 0.38, 12, barH * 0.46);

    } else if (sType === 'teardrop_beacon') {
      // Aerodynamic Teardrop Base Tray & Reflector Cavity
      const trayH = 16;
      const trayY = barY + barH - 2;
      const cx = barX + barW / 2;

      ctx.fillStyle = createMetalGrad(barX, trayY, barX + barW, trayY + trayH);
      ctx.beginPath();
      ctx.roundRect(barX - 4, trayY, barW + 8, trayH, [3, 8, 8, 3]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.stroke();

      // Inner drive motor
      ctx.fillStyle = '#111317';
      ctx.fillRect(cx - 16, barY + barH * 0.74, 32, barH * 0.22);
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(cx - 4, barY + barH * 0.45, 8, barH * 0.32);

    } else if (sType === 'v_bar') {
      // Forward-Swept 7-Pod Chevron Truss Frame
      const podCount = config.structure.podCount || 7;
      const podW = barW / podCount;
      const vAngleFactor = (config.structure.vAngleDeg || 24) / 24;

      // Heavy-duty chevron wiring raceway spine spanning behind pods
      ctx.fillStyle = '#111317';
      ctx.beginPath();
      for (let i = 0; i < podCount; i++) {
        const podNormX = (i + 0.5) / podCount;
        const vY = (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor;
        const px = barX + i * podW;
        if (i === 0) ctx.moveTo(px, barY + barH * 0.85 + vY);
        else ctx.lineTo(px + podW / 2, barY + barH * 0.85 + vY);
      }
      ctx.lineTo(barX + barW, barY + barH * 0.95);
      ctx.lineTo(barX + barW, barY + barH + 16);
      ctx.lineTo(barX, barY + barH + 16);
      ctx.closePath();
      ctx.fill();

      // Pod base trays with forward-swept chevron angles
      for (let i = 0; i < podCount; i++) {
        const podNormX = (i + 0.5) / podCount;
        const vY = (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor;
        const px = barX + i * podW;

        // Pod tray
        ctx.fillStyle = createMetalGrad(px, barY + barH + vY, px + podW, barY + barH + 14 + vY);
        ctx.beginPath();
        ctx.roundRect(px + 1, barY + barH + vY - 2, podW - 2, 14, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner back wall of each pod
        ctx.fillStyle = '#18181b';
        ctx.fillRect(px + 2, barY + vY + 2, podW - 4, barH - 4);
      }

    } else if (sType === 'dual_beacon_bridge') {
      // Twin Polished Stainless Steel Tubular Rails & Center Federal Q2B Mechanical Siren
      const railH = 11;
      const topRailY = barY + barH * 0.78;
      const btmRailY = barY + barH + 10;

      // Twin Stainless Tubular Crossbars
      [topRailY, btmRailY].forEach((ry) => {
        const railGrad = ctx.createLinearGradient(0, ry, 0, ry + railH);
        railGrad.addColorStop(0, '#374151');
        railGrad.addColorStop(0.25, '#f3f4f6');
        railGrad.addColorStop(0.5, '#ffffff');
        railGrad.addColorStop(0.75, '#9ca3af');
        railGrad.addColorStop(1, '#1f2937');

        ctx.fillStyle = railGrad;
        ctx.beginPath();
        ctx.roundRect(barX - 16, ry, barW + 32, railH, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tube chrome endcaps with dome nuts
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(barX - 16, ry + railH / 2, 4, 0, Math.PI * 2);
        ctx.arc(barX + barW + 16, ry + railH / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Elevated chrome beacon turret bases positioned dynamically under each dome
      config.domes.forEach((dome) => {
        const domeX = barX + dome.startX * barW;
        const domeW = (dome.endX - dome.startX) * barW;
        const tx = domeX + domeW / 2;
        const turretW = Math.max(domeW * 1.06, 50);

        const tGrad = ctx.createLinearGradient(tx - turretW / 2, 0, tx + turretW / 2, 0);
        tGrad.addColorStop(0, '#4b5563');
        tGrad.addColorStop(0.3, '#ffffff');
        tGrad.addColorStop(0.7, '#d1d5db');
        tGrad.addColorStop(1, '#374151');

        // Circular stepped turret platform
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.roundRect(tx - turretW / 2, barY + barH - 4, turretW, 16, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Inner turret turntable
        ctx.fillStyle = '#111317';
        ctx.fillRect(tx - turretW / 2 + 4, barY + barH * 0.78, turretW - 8, barH * 0.2);
      });

      // Center Iconic Federal Q2B Mechanical Siren!
      if (config.structure.speakerCenter === 'mechanical_siren') {
        const sirenCx = barX + barW / 2;
        const sirenCy = barY + barH * 0.58;
        const sirenRadius = Math.min(46, barH * 0.44);

        // Heavy-duty chrome cradle bracket clamping to both tubular rails
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(sirenCx - 14, topRailY - 4, 28, btmRailY - topRailY + railH + 6);
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(sirenCx - 14, topRailY - 4, 28, btmRailY - topRailY + railH + 6);

        // Flared chrome siren acoustic horn bell housing
        const bellGrad = ctx.createRadialGradient(
          sirenCx - sirenRadius * 0.3,
          sirenCy - sirenRadius * 0.3,
          4,
          sirenCx,
          sirenCy,
          sirenRadius
        );
        bellGrad.addColorStop(0, '#ffffff');
        bellGrad.addColorStop(0.4, '#e5e7eb');
        bellGrad.addColorStop(0.75, '#9ca3af');
        bellGrad.addColorStop(1, '#374151');

        ctx.fillStyle = bellGrad;
        ctx.beginPath();
        ctx.arc(sirenCx, sirenCy, sirenRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Flared outer chrome rim lip
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sirenCx, sirenCy, sirenRadius - 2, 0, Math.PI * 2);
        ctx.stroke();

        // Dark siren intake throat chamber
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(sirenCx, sirenCy, sirenRadius * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Spinning mechanical siren rotor blades / stator ports
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          ctx.beginPath();
          ctx.moveTo(sirenCx + Math.cos(a) * (sirenRadius * 0.32), sirenCy + Math.sin(a) * (sirenRadius * 0.32));
          ctx.lineTo(sirenCx + Math.cos(a) * (sirenRadius * 0.70), sirenCy + Math.sin(a) * (sirenRadius * 0.70));
          ctx.stroke();
        }

        // Center aerodynamic chrome bullet nose cone
        const coneRadius = sirenRadius * 0.34;
        const coneGrad = ctx.createRadialGradient(
          sirenCx - coneRadius * 0.3,
          sirenCy - coneRadius * 0.3,
          2,
          sirenCx,
          sirenCy,
          coneRadius
        );
        coneGrad.addColorStop(0, '#ffffff');
        coneGrad.addColorStop(0.45, '#d1d5db');
        coneGrad.addColorStop(0.85, '#6b7280');
        coneGrad.addColorStop(1, '#1f2937');

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.arc(sirenCx, sirenCy, coneRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Specular chrome glint on nose
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(sirenCx - coneRadius * 0.35, sirenCy - coneRadius * 0.35, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (sType === 'mini_bar') {
      // Compact Mini-Bar Extrusion Frame with Center Diamond Mirror
      const trayH = 15;
      const trayY = barY + barH;

      ctx.fillStyle = createMetalGrad(barX, trayY, barX + barW, trayY + trayH);
      ctx.fillRect(barX - 4, trayY, barW + 8, trayH);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 4, trayY, barW + 8, trayH);

      // Inner backplane
      ctx.fillStyle = '#18181b';
      ctx.fillRect(barX, barY, barW, barH);

      // Center dual-sided 45° diamond mirror reflector to bounce lateral light
      const mirW = barW * 0.12;
      const mirX = barX + (barW - mirW) / 2;
      const mirGrad = ctx.createLinearGradient(mirX, 0, mirX + mirW, 0);
      mirGrad.addColorStop(0, '#374151');
      mirGrad.addColorStop(0.3, '#f3f4f6');
      mirGrad.addColorStop(0.5, '#ffffff');
      mirGrad.addColorStop(0.7, '#d1d5db');
      mirGrad.addColorStop(1, '#4b5563');

      ctx.fillStyle = mirGrad;
      ctx.beginPath();
      ctx.moveTo(mirX + mirW / 2, barY + 4);
      ctx.lineTo(mirX + mirW, barY + barH - 4);
      ctx.lineTo(mirX, barY + barH - 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.2;
      ctx.stroke();

    } else {
      // Standard Lightbar Base Extrusion (Rotary Domes, Rigid Bar, Aero Modular)
      const trayH = 16;
      const trayY = barY + barH;

      ctx.fillStyle = createMetalGrad(0, trayY, 0, trayY + trayH);
      ctx.fillRect(barX - 6, trayY, barW + 12, trayH);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 6, trayY, barW + 12, trayH);

      // Inner back wall of housing behind domes (mirrored or matte)
      const backGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
      backGrad.addColorStop(0, '#111317');
      backGrad.addColorStop(0.5, '#1c1f26');
      backGrad.addColorStop(1, '#0d0f12');
      ctx.fillStyle = backGrad;
      ctx.fillRect(barX, barY, barW, barH);

      // Center speaker grille if configured
      if (config.structure.speakerCenter !== 'none') {
        const centerDome = config.domes.find(
          (d) => d.id.includes('speaker') || d.id.includes('center') || d.id.includes('mid') || (d.startX <= 0.45 && d.endX >= 0.55)
        );
        if (centerDome) {
          const spkX = barX + centerDome.startX * barW;
          const spkW = (centerDome.endX - centerDome.startX) * barW;

          ctx.fillStyle = '#1e232b';
          ctx.fillRect(spkX, barY + 2, spkW, barH - 4);

          if (config.structure.speakerCenter === 'vintage_mesh') {
            // Perforated stainless steel speaker mesh
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(spkX + 4, barY + 4, spkW - 8, barH - 8);

            ctx.fillStyle = '#111827';
            const dotSpacing = 7;
            for (let px = spkX + 8; px < spkX + spkW - 8; px += dotSpacing) {
              for (let py = barY + 8; py < barY + barH - 8; py += dotSpacing) {
                ctx.beginPath();
                ctx.arc(px, py, 1.4, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          } else if (config.structure.speakerCenter === 'slit_plate') {
            // Slotted horizontal louvers
            ctx.fillStyle = '#374151';
            const slotH = 4;
            const slotGap = 6;
            for (let py = barY + 8; py < barY + barH - 8; py += slotH + slotGap) {
              ctx.fillRect(spkX + 8, py, spkW - 16, slotH);
            }
          }
        }
      }
    }

    ctx.restore();
  }

  private renderRotatorReflector(
    ctx: CanvasRenderingContext2D,
    elem: LightElement,
    x: number,
    y: number,
    size: number,
    angle: number,
    blended: { coreRgb: string; glowRgb: string; r: number; g: number; b: number }
  ) {
    ctx.save();
    const rot = elem.rotator!;
    const dishRadius = size * 0.44;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Reflector dish width projected by rotation angle
    const projW = Math.max(8, dishRadius * Math.abs(cosA));

    // Motor spindle / base plate
    ctx.fillStyle = '#27272a';
    ctx.fillRect(x - 14, y + dishRadius * 0.65, 28, 12);

    if (cosA < 0) {
      // Facing away / rear side of reflector
      ctx.fillStyle = rot.reflectorFinish === 'chrome' ? '#374151' : '#1f2937';
      ctx.beginPath();
      ctx.ellipse(x, y, projW, dishRadius, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rear cooling ribs / stamped casing lines
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Small central socket hub
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Facing camera / reflective concave mirror dish
      const mirrorGrad = ctx.createRadialGradient(
        x - projW * 0.2,
        y - dishRadius * 0.2,
        4,
        x,
        y,
        dishRadius
      );
      if (rot.reflectorFinish === 'chrome') {
        mirrorGrad.addColorStop(0, '#ffffff');
        mirrorGrad.addColorStop(0.3, '#e5e7eb');
        mirrorGrad.addColorStop(0.7, '#9ca3af');
        mirrorGrad.addColorStop(1, '#4b5563');
      } else {
        mirrorGrad.addColorStop(0, '#f3f4f6');
        mirrorGrad.addColorStop(0.5, '#cbd5e1');
        mirrorGrad.addColorStop(1, '#64748b');
      }

      ctx.fillStyle = mirrorGrad;
      ctx.beginPath();
      ctx.ellipse(x, y, projW, dishRadius, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer bezel ring
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center halogen bulb capsule
      const bulbW = 6;
      const bulbH = 14;
      ctx.fillStyle = blended.coreRgb;
      ctx.shadowColor = blended.glowRgb;
      ctx.shadowBlur = 10;
      ctx.fillRect(x - bulbW / 2, y - bulbH / 2, bulbW, bulbH);
      ctx.shadowBlur = 0;

      // Sealed beam fluting lines if sealed beam PAR36
      if (rot.reflectorType === 'sealed_beam_par36') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let lx = -projW * 0.7; lx <= projW * 0.7; lx += projW * 0.35) {
          ctx.beginPath();
          ctx.moveTo(x + lx, y - dishRadius * 0.7);
          ctx.lineTo(x + lx, y + dishRadius * 0.7);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  private renderStaticHalogenBulb(
    ctx: CanvasRenderingContext2D,
    elem: LightElement,
    x: number,
    y: number,
    size: number,
    thermal: number,
    blended: { coreRgb: string; glowRgb: string }
  ) {
    ctx.save();
    const dishRadius = size * 0.42;

    // Fixed reflector housing
    const refGrad = ctx.createRadialGradient(x, y, 4, x, y, dishRadius);
    refGrad.addColorStop(0, '#e5e7eb');
    refGrad.addColorStop(0.4, '#9ca3af');
    refGrad.addColorStop(1, '#374151');
    ctx.fillStyle = refGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, dishRadius * 0.9, dishRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bulb envelope
    const bulbW = 8;
    const bulbH = 16;
    if (elem.subglassColor) {
      ctx.fillStyle = elem.subglassColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x - bulbW / 2 - 2, y - bulbH / 2 - 2, bulbW + 4, bulbH + 4);
      ctx.globalAlpha = 1.0;
    }

    // Incandescent filament glow based on thermal value
    if (thermal > 0.02) {
      ctx.fillStyle = blended.coreRgb;
      ctx.shadowColor = blended.glowRgb;
      ctx.shadowBlur = 8 + thermal * 16;
      ctx.beginPath();
      ctx.arc(x, y, 3 + thermal * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Cold tungsten coil
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 4);
      ctx.lineTo(x + 3, y - 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderXenonStrobeTube(
    ctx: CanvasRenderingContext2D,
    elem: LightElement,
    x: number,
    y: number,
    size: number,
    energy: number,
    blended: { coreRgb: string; glowRgb: string }
  ) {
    ctx.save();
    const reflectorW = size * 0.8;
    const reflectorH = size * 0.9;

    // Mirror backplate
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - reflectorW / 2, y - reflectorH / 2, reflectorW, reflectorH);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(x - reflectorW / 2, y - reflectorH / 2, reflectorW, reflectorH);

    // U-shaped quartz strobe tube
    ctx.strokeStyle = energy > 0.1 ? blended.coreRgb : 'rgba(224, 242, 254, 0.4)';
    ctx.lineWidth = 4;
    if (energy > 0.1) {
      ctx.shadowColor = blended.glowRgb;
      ctx.shadowBlur = 24 * energy;
    }

    ctx.beginPath();
    ctx.moveTo(x - 10, y + 14);
    ctx.lineTo(x - 10, y - 8);
    ctx.arcTo(x - 10, y - 14, x, y - 14, 8);
    ctx.arcTo(x + 10, y - 14, x + 10, y - 8, 8);
    ctx.lineTo(x + 10, y + 14);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Metal electrode triggers
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x - 12, y + 12, 5, 6);
    ctx.fillRect(x + 7, y + 12, 5, 6);

    ctx.restore();
  }

  private renderLedModule(
    ctx: CanvasRenderingContext2D,
    elem: LightElement,
    x: number,
    y: number,
    size: number,
    isActive: boolean,
    blended: { coreRgb: string; glowRgb: string }
  ) {
    ctx.save();
    const diodes = elem.led?.diodeCount || 4;
    const modW = size * 0.9;
    const modH = size * 0.55;

    ctx.fillStyle = '#111827';
    ctx.fillRect(x - modW / 2, y - modH / 2, modW, modH);

    const diodeSpacing = modW / (diodes + 1);
    for (let i = 1; i <= diodes; i++) {
      const dx = x - modW / 2 + i * diodeSpacing;
      // TIR optic cup
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.arc(dx, y, 6, 0, Math.PI * 2);
      ctx.fill();

      if (isActive) {
        ctx.fillStyle = blended.coreRgb;
        ctx.shadowColor = blended.glowRgb;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(dx, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  /**
   * Render the Outer Glass / Polycarbonate Covering:
   * Volumetric subsurface light transfer, internal caustic wave ribbons,
   * light-activated glowing scratches, asymmetrical fluting dispersion, and TIR edge lighting.
   */
  private renderGlassCovering(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    flares: Array<ActiveFlare>,
    settings: RenderSettings,
    state: SimulationState
  ) {
    ctx.save();

    const sType = config.structure.type;
    const vAngleFactor = (config.structure.vAngleDeg || 24) / 24;

    config.domes.forEach((dome) => {
      const domeX = barX + dome.startX * barW;
      const domeW = (dome.endX - dome.startX) * barW;
      if (domeW <= 0) return;

      const podNormX = (dome.startX + dome.endX) / 2;
      const vY = sType === 'v_bar' ? (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor : 0;
      const domeY = barY + vY;

      const rgb = hexToRgb(dome.color);
      const isLeftEnd = dome.startX < 0.05;
      const isRightEnd = dome.endX > 0.95;

      let radii: [number, number, number, number];
      if (sType === 'cylindrical_beacon') {
        const topRadius = domeW * 0.46;
        radii = [topRadius, topRadius, 4, 4];
      } else if (sType === 'teardrop_beacon') {
        radii = [domeW * 0.46, domeW * 0.36, 4, 4];
      } else if (sType === 'dual_beacon_bridge') {
        const topRadius = domeW * 0.44;
        radii = [topRadius, topRadius, 3, 3];
      } else if (sType === 'mini_bar') {
        const cr = 10;
        radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
      } else if (sType === 'rotary_domes') {
        const cr = 14;
        radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
      } else if (sType === 'aero_modular') {
        const cr = 22;
        radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
      } else {
        const cr = 6;
        radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
      }

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        domeX,
        domeY,
        domeW,
        barH,
        radii
      );
      ctx.clip();

      // 1. Base glass substrate gradient
      const domeGrad = ctx.createLinearGradient(0, domeY, 0, domeY + barH);
      domeGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.9, dome.opacity * 0.7)})`);
      domeGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.9, dome.opacity * 0.5)})`);
      domeGrad.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.7)}, ${Math.floor(rgb.g * 0.7)}, ${Math.floor(rgb.b * 0.7)}, ${Math.min(0.95, dome.opacity * 0.85)})`);
      ctx.fillStyle = domeGrad;
      ctx.fillRect(domeX, domeY, domeW, barH);

      // Light Interaction within this dome section
      const domeFlares = flares.filter((f) => f.x >= domeX - 40 && f.x <= domeX + domeW + 40);
      const totalDirectGlow = domeFlares.reduce((sum, f) => sum + f.intensity, 0);
      const totalInternalGlow = domeFlares.reduce((sum, f) => sum + f.internalIntensity, 0);
      const cloud = dome.cloudiness;
      const scratches = dome.wear.scratches;
      const dirt = dome.wear.dirtHaze;
      const yellowing = dome.wear.yellowing;

      // 2. Light Transfer into the Solid Glass Body (Polycarbonate Luminescence)
      // When cloudy or scratched, light is absorbed and scattered internally rather than escaping as a pinpoint!
      const lightTransferCoeff = (0.28 + cloud * 1.45 + scratches * 0.95) * settings.refractionStrength;
      const trappedGlow = (totalInternalGlow * 0.65 + totalDirectGlow * 0.45) * lightTransferCoeff;

      if (trappedGlow > 0.02) {
        // A. Volumetric Chamber Luminescence (whole dome acrylic lights up)
        const scatterGrad = ctx.createLinearGradient(0, domeY, 0, domeY + barH);
        const scatterAlpha = Math.min(0.95, trappedGlow * 0.5);
        scatterGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${scatterAlpha * 0.75})`);
        scatterGrad.addColorStop(0.4, `rgba(${Math.min(255, rgb.r + 90)}, ${Math.min(255, rgb.g + 90)}, ${Math.min(255, rgb.b + 90)}, ${scatterAlpha * 0.95})`);
        scatterGrad.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.8)}, ${Math.floor(rgb.g * 0.8)}, ${Math.floor(rgb.b * 0.8)}, ${scatterAlpha * 0.85})`);
        ctx.fillStyle = scatterGrad;
        ctx.fillRect(domeX, domeY, domeW, barH);

        // B. Localized Diffusion Hotspots in the Plastic Shell
        domeFlares.forEach((f) => {
          const hx = f.x + f.sweepOffset * 0.45;
          const hy = f.y;
          const hotspotRadius = (barH * 0.85) * (0.6 + cloud * 1.35 + scratches * 0.75);

          const hotspotGrad = ctx.createRadialGradient(hx, hy, 2, hx, hy, hotspotRadius);
          const hotspotAlpha = Math.min(0.88, f.internalIntensity * (0.32 + cloud * 0.85 + scratches * 0.55) * settings.refractionStrength);
          hotspotGrad.addColorStop(0, f.coreColor);
          hotspotGrad.addColorStop(0.28, f.glowColor);
          hotspotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = hotspotGrad;
          ctx.globalAlpha = hotspotAlpha;
          ctx.fillRect(domeX, domeY, domeW, barH);
          ctx.restore();
        });
      }

      // 3. Fluting / Fresnel Optics with Asymmetric Dispersion & Light Catching
      // Anchored strictly to the actual dome boundaries [domeX, domeX + domeW] and domeY
      if (dome.fluting.intensity > 0.05 && dome.fluting.density > 0) {
        const style = dome.fluting.style || 'vertical_ribs';
        const ribCount = Math.max(3, Math.floor((domeW / 100) * dome.fluting.density));
        const domeCenterX = domeX + domeW / 2;
        const isCylindrical = sType === 'cylindrical_beacon' || sType === 'teardrop_beacon' || sType === 'dual_beacon_bridge';

        if (style === 'fresnel_prism') {
          // Horizontal stepped refraction bands across dome height
          const bandCount = 5;
          const bandH = barH / bandCount;
          for (let b = 0; b < bandCount; b++) {
            const by = domeY + b * bandH;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * dome.fluting.intensity})`;
            ctx.fillRect(domeX, by, domeW, 1.4);
            ctx.fillStyle = `rgba(0, 0, 0, ${0.14 * dome.fluting.intensity})`;
            ctx.fillRect(domeX, by + bandH - 1.4, domeW, 1.4);
          }

          // Concentric circular refractive rings around lights
          domeFlares.forEach((f) => {
            const ringCount = 3;
            for (let r = 1; r <= ringCount; r++) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 * dome.fluting.intensity * f.internalIntensity})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(f.x, f.y, r * 14, 0, Math.PI * 2);
              ctx.stroke();
            }
          });
        } else if (style === 'diamond_optic') {
          // Prismatic diamond facets (criss-cross angled ridges)
          const diagSpacing = Math.max(6, 110 / dome.fluting.density);
          ctx.save();
          ctx.lineWidth = 1;
          for (let d = -barH; d < domeW + barH; d += diagSpacing) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * dome.fluting.intensity})`;
            ctx.beginPath();
            ctx.moveTo(domeX + d, domeY);
            ctx.lineTo(domeX + d + barH, domeY + barH);
            ctx.stroke();

            ctx.strokeStyle = `rgba(0, 0, 0, ${0.12 * dome.fluting.intensity})`;
            ctx.beginPath();
            ctx.moveTo(domeX + d, domeY + barH);
            ctx.lineTo(domeX + d + barH, domeY);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Vertical optical fluting ridges (anchored to dome position)
        for (let i = 0; i < ribCount; i++) {
          let rx: number;
          let ribWidth: number;

          if (isCylindrical) {
            // Cylindrical perspective foreshortening: ridges compress toward curved outer edges
            const t0 = -1 + (2 * i) / ribCount;
            const t1 = -1 + (2 * (i + 1)) / ribCount;
            const maxSin = Math.sin(Math.PI * 0.46);
            const p0 = domeCenterX + (Math.sin(t0 * Math.PI * 0.46) / maxSin) * (domeW * 0.5);
            const p1 = domeCenterX + (Math.sin(t1 * Math.PI * 0.46) / maxSin) * (domeW * 0.5);
            rx = Math.min(p0, p1);
            ribWidth = Math.max(1.5, Math.abs(p1 - p0));
          } else {
            // Precision uniform spacing anchored to domeX and domeW
            ribWidth = domeW / ribCount;
            rx = domeX + i * ribWidth;
          }

          // Rib refractive highlight & shadow groove pair
          const ribAlpha = 0.14 * dome.fluting.intensity;
          ctx.fillStyle = `rgba(255, 255, 255, ${ribAlpha})`;
          ctx.fillRect(rx, domeY, ribWidth * 0.35, barH);

          ctx.fillStyle = `rgba(0, 0, 0, ${ribAlpha * 1.25})`;
          ctx.fillRect(rx + ribWidth * 0.5, domeY, ribWidth * 0.5, barH);

          // If light is inside, fluting ribs catch and refract light unevenly
          domeFlares.forEach((f) => {
            const flareProximityX = f.x + f.sweepOffset * 0.5;
            const dist = Math.abs(flareProximityX - rx);
            if (dist < 140) {
              const catchAlpha =
                Math.pow(1 - dist / 140, 2) *
                f.internalIntensity *
                0.45 *
                dome.fluting.intensity *
                (1.0 + cloud * 0.6) *
                settings.refractionStrength;

              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              ctx.fillStyle = f.coreColor;
              ctx.globalAlpha = Math.min(0.9, catchAlpha);
              ctx.fillRect(rx, domeY, ribWidth * 0.55, barH);

              // Secondary chromatic edge fringing on adjacent rib face
              if (dist < 70) {
                ctx.fillStyle = f.glowColor;
                ctx.globalAlpha = Math.min(0.65, catchAlpha * 0.7);
                ctx.fillRect(rx + ribWidth * 0.4, domeY, ribWidth * 0.4, barH);
              }
              ctx.restore();
            }
          });
        }
      }

      // 4. Luminous Glowing Scratches & Micro-Abrasions (Edge-Lit Fiber-Optic Effect)
      // When cloudy/scratched glass receives light, scratches catch and glow intensely!
      if (scratches > 0.02) {
        const domeSeed = stringToSeed(dome.id + '_scratches');
        const rng = createDeterministicRng(domeSeed);

        // Number of scratches scales with wear
        const scratchCount = Math.floor(12 + scratches * 32);

        for (let s = 0; s < scratchCount; s++) {
          const sx = domeX + rng() * domeW;
          const sy = domeY + rng() * barH;
          const length = 10 + rng() * 28;
          const angle = (rng() - 0.5) * Math.PI * 0.85; // angled/crosshatch
          const isSwirl = rng() > 0.55; // curved wiper/cleaning swirl
          const ex = sx + Math.cos(angle) * length;
          const ey = sy + Math.sin(angle) * length;

          // Check proximity to light sources inside this dome
          let scratchLight = 0;
          let nearestFlare: ActiveFlare | null = null;
          for (const f of domeFlares) {
            const hx = f.x + f.sweepOffset * 0.45;
            const dist = Math.hypot(hx - sx, f.y - sy);
            if (dist < 180) {
              const contrib = f.internalIntensity * (1 - dist / 180);
              scratchLight += contrib;
              if (!nearestFlare || contrib > 0.1) nearestFlare = f;
            }
          }

          // Ambient scratch visibility (subtle gray line)
          const baseScratchAlpha = scratches * 0.15;
          // Light-activated scratch luminescence (ignites into bright glowing filament)
          const activeScratchGlow = scratchLight * (0.35 + cloud * 0.75) * scratches * 2.4 * settings.refractionStrength;

          ctx.save();
          if (isSwirl) {
            const radius = 8 + rng() * 18;
            const startArc = rng() * Math.PI * 2;
            const arcSpan = 0.4 + rng() * 0.9;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, startArc, startArc + arcSpan);
          } else {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
          }

          // A. Ambient faint scratch line
          ctx.strokeStyle = `rgba(255, 255, 255, ${baseScratchAlpha})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();

          // B. Glowing scratch edge-lighting when struck by internal beam
          if (activeScratchGlow > 0.02 && nearestFlare) {
            ctx.globalCompositeOperation = 'screen';

            // Outer colored luminous glow along scratch
            ctx.strokeStyle = nearestFlare.glowColor;
            ctx.lineWidth = 2.4;
            ctx.globalAlpha = Math.min(0.85, activeScratchGlow * 0.65);
            ctx.stroke();

            // Inner high-contrast specular scratch core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.9;
            ctx.globalAlpha = Math.min(0.95, activeScratchGlow * 0.9);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 5. Aging Patina: UV Degradation Patina & Road Dirt Haze
      if (yellowing > 0.03) {
        ctx.fillStyle = `rgba(217, 119, 6, ${yellowing * 0.28})`;
        ctx.fillRect(domeX, domeY, domeW, barH);
      }

      if (dirt > 0.03) {
        const dirtGrad = ctx.createLinearGradient(0, domeY + barH - 26, 0, domeY + barH);
        dirtGrad.addColorStop(0, 'rgba(120, 113, 108, 0)');
        dirtGrad.addColorStop(1, `rgba(87, 83, 78, ${dirt * 0.55})`);
        ctx.fillStyle = dirtGrad;
        ctx.fillRect(domeX, domeY + barH - 26, domeW, 26);
      }

      // 6. Total Internal Reflection (TIR) Glowing Rims
      // Light trapped in the glass channels to the top curved brow and bottom seam
      if (trappedGlow > 0.04) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const rimAlpha = Math.min(0.85, trappedGlow * 0.45);

        // Top edge glow
        const topRimGrad = ctx.createLinearGradient(0, domeY, 0, domeY + 5);
        topRimGrad.addColorStop(0, `rgba(255, 255, 255, ${rimAlpha * 0.95})`);
        topRimGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rimAlpha * 0.8})`);
        topRimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = topRimGrad;
        ctx.fillRect(domeX, domeY, domeW, 5);

        // Bottom edge glow
        const btmRimGrad = ctx.createLinearGradient(0, domeY + barH - 5, 0, domeY + barH);
        btmRimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        btmRimGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rimAlpha * 0.75})`);
        btmRimGrad.addColorStop(1, `rgba(255, 255, 255, ${rimAlpha * 0.85})`);
        ctx.fillStyle = btmRimGrad;
        ctx.fillRect(domeX, domeY + barH - 5, domeW, 5);
        ctx.restore();
      }

      // Top edge glass specular reflection (unlit physical highlight)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(domeX, domeY, domeW, 1.8);

      // Section border gasket seal (black rubber partition) - only between contiguous sections
      if (sType !== 'dual_beacon_bridge' && sType !== 'cylindrical_beacon' && sType !== 'teardrop_beacon') {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(domeX - 1.5, domeY, 3, barH);
        ctx.fillRect(domeX + domeW - 1.5, domeY, 3, barH);
      }

      ctx.restore();
    });

    // Outer border & acrylic highlight of glass assembly
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 2;

    if (sType === 'cylindrical_beacon') {
      const topRad = barW * 0.46;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, [topRad, topRad, 4, 4]);
      ctx.stroke();

      // Curved acrylic dome top specular reflection
      const specGrad = ctx.createRadialGradient(barX + barW * 0.38, barY + topRad * 0.4, 2, barX + barW * 0.38, barY + topRad * 0.4, topRad);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      specGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.ellipse(barX + barW * 0.38, barY + topRad * 0.45, topRad * 0.6, topRad * 0.35, -0.2, 0, Math.PI * 2);
      ctx.fill();

    } else if (sType === 'teardrop_beacon') {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, [barW * 0.46, barW * 0.36, 4, 4]);
      ctx.stroke();

      const specGrad = ctx.createRadialGradient(barX + barW * 0.35, barY + barH * 0.2, 2, barX + barW * 0.35, barY + barH * 0.2, barW * 0.4);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.ellipse(barX + barW * 0.35, barY + barH * 0.2, barW * 0.32, barH * 0.18, -0.15, 0, Math.PI * 2);
      ctx.fill();

    } else if (sType === 'dual_beacon_bridge') {
      // Outline each beacon dome individually
      config.domes.forEach((dome) => {
        const domeX = barX + dome.startX * barW;
        const domeW = (dome.endX - dome.startX) * barW;
        const topRad = domeW * 0.44;
        ctx.beginPath();
        ctx.roundRect(domeX, barY, domeW, barH, [topRad, topRad, 3, 3]);
        ctx.stroke();

        // Top glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(domeX + domeW * 0.4, barY + topRad * 0.45, topRad * 0.5, topRad * 0.28, -0.15, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (sType === 'v_bar') {
      // Outline each chevron pod individually
      config.domes.forEach((dome) => {
        const podNormX = (dome.startX + dome.endX) / 2;
        const vY = (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor;
        const domeX = barX + dome.startX * barW;
        const domeW = (dome.endX - dome.startX) * barW;
        ctx.beginPath();
        ctx.roundRect(domeX, barY + vY, domeW, barH, 4);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(domeX + 2, barY + vY + 2, domeW - 4, 3);
      });

    } else {
      // Full bar / Mini-bar
      const outerRadius = sType === 'rotary_domes' ? 14 : sType === 'aero_modular' ? 22 : sType === 'mini_bar' ? 10 : 6;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, outerRadius);
      ctx.stroke();

      // Curved acrylic top specular reflection streak
      const specGrad = ctx.createLinearGradient(0, barY, 0, barY + 12);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      specGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.roundRect(barX + 6, barY + 2, barW - 12, 10, [outerRadius * 0.8, outerRadius * 0.8, 0, 0]);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render Integrated Atmospheric Dome Halos & Coronas:
   * Physically anchors optical bloom to the dome section bounds and matches dome glass transmission color.
   * On cloudy/scratched glass, point-source glare and halos are heavily attenuated to prevent harsh overlays,
   * transitioning into a soft, organic atmospheric wrap around the dome silhouette.
   */
  private renderHalosAndCoronas(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    flares: Array<ActiveFlare>,
    settings: RenderSettings,
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    width: number,
    height: number
  ) {
    if (flares.length === 0 || settings.coronaIntensity <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Per-Light-Source Advanced Physical Halos & Coronas
    // Dome-level bloom is removed so individual lights retain distinct, crisp optical definition
    // without being overshadowed or muddied by dome-wide rectangular envelope glows.
    flares.forEach((flare) => {
      this.renderSourceSpecificHalo(ctx, flare, settings, width, height);
    });

    ctx.restore();
  }

  /**
   * Per-Light-Source Advanced Halo Renderer:
   * Dynamically constructs halo shape, luminous brightness, and multi-stage spectral gradient
   * according to the specific physics of the emitting light source.
   */
  private renderSourceSpecificHalo(
    ctx: CanvasRenderingContext2D,
    flare: ActiveFlare,
    settings: RenderSettings,
    width: number,
    height: number
  ) {
    const { x, y, intensity, element, domeCloudiness, domeScratches, flutingDensity, flutingStyle } = flare;
    if (intensity < 0.035) return;

    // Direct optical clarity through the dome: decreases with cloudiness and surface abrasions
    const directClarity = Math.max(0.02, 1.0 - domeCloudiness * 1.75 - domeScratches * 0.7);
    if (directClarity <= 0.02) return;

    // Dome and subglass colors
    const domeRgb = hexToRgb(flare.domeColor);
    const subglassRgb = element.subglassColor ? hexToRgb(element.subglassColor) : null;

    // 1. SHAPE CALCULATION
    let scaleX = 1.15;
    let scaleY = 0.90;
    let tiltAngle = 0;
    let offsetX = 0;
    let offsetY = 0;
    let baseRadius = 55 * settings.bloomRadius;

    // 2. BRIGHTNESS CALCULATION
    let sourceBrightnessMult = 1.0;

    // 3. GRADIENT STOPS CALCULATION
    let coreColor = 'rgba(255, 255, 255, 0.95)';
    let innerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.75)`;
    let midColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.35)`;
    let outerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.06)`;

    if (element.type === 'rotating_halogen') {
      const rot = element.rotator;
      const reflectorType = rot?.reflectorType || 'parabolic_dish';
      const spreadDeg = rot?.beamSpreadDeg || 24;
      const wattage = rot?.wattage || 55;
      const warmthK = rot?.filamentWarmth || 3200;
      const finish = rot?.reflectorFinish || 'chrome';

      // Shape: derived from parabolic dish geometry & sweep trajectory
      if (reflectorType === 'parabolic_dish') {
        scaleX = 1.40;
        scaleY = 0.86;
      } else if (reflectorType === 'sealed_beam_par36') {
        scaleX = 1.18;
        scaleY = 0.96;
      } else if (reflectorType === 'par46') {
        scaleX = 1.24;
        scaleY = 0.92;
      } else if (reflectorType === 'dual_sided_mirror') {
        scaleX = 1.62;
        scaleY = 0.78;
      }

      // Beam spread modulation: tighter beams elongate along the parabolic axis
      const spreadRatio = spreadDeg / 24;
      scaleX /= Math.sqrt(spreadRatio);
      scaleY *= Math.sqrt(spreadRatio);

      // Sweeping dynamic tilt: as the rotator sweeps past, the halo tilts in sync with the reflector angle
      if (flare.rotationAngle !== undefined) {
        tiltAngle = Math.sin(flare.rotationAngle) * 0.16; // ~9 degrees dynamic tilt
      }
      offsetX = (flare.sweepOffset || 0) * 0.4;

      // Brightness: concentrated candlepower of high-wattage parabolic beam
      const wattageFactor = Math.sqrt(wattage / 55);
      const finishFactor = finish === 'chrome' ? 1.18 : finish === 'polished_aluminum' ? 1.05 : 0.88;
      const wearFactor = 1.0 - (element.wear.fadeWear * 0.22 + element.wear.reflectorTarnish * 0.20);
      sourceBrightnessMult = wattageFactor * finishFactor * wearFactor * (element.brightness || 1.0) * 1.15;
      baseRadius = 58 * settings.bloomRadius * Math.min(1.4, 0.8 + intensity * 0.5);

      // Gradient: Hot tungsten filament with Kelvin warmth transitioning to dome filter
      const tungsten = kelvinToRgb(warmthK);
      const hotR = Math.min(255, Math.round(tungsten.r * 0.6 + 255 * 0.4));
      const hotG = Math.min(255, Math.round(tungsten.g * 0.6 + 255 * 0.4));
      const hotB = Math.min(255, Math.round(tungsten.b * 0.6 + 255 * 0.4));
      coreColor = `rgba(${hotR}, ${hotG}, ${hotB}, 0.95)`;

      const warmR = Math.round(tungsten.r * 0.4 + (subglassRgb?.r ?? domeRgb.r) * 0.6);
      const warmG = Math.round(tungsten.g * 0.4 + (subglassRgb?.g ?? domeRgb.g) * 0.6);
      const warmB = Math.round(tungsten.b * 0.4 + (subglassRgb?.b ?? domeRgb.b) * 0.6);
      innerColor = `rgba(${warmR}, ${warmG}, ${warmB}, 0.70)`;

      midColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.32)`;
      outerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.05)`;
    } else if (element.type === 'static_halogen') {
      const hal = element.halogen;
      const bulbShape = hal?.bulbShape || 'h3';
      const wattage = hal?.wattage || 55;

      // Shape: vertical filament capsule orientation
      if (bulbShape === 'h1' || bulbShape === 'h3') {
        scaleX = 0.92;
        scaleY = 1.18; // Elongated along vertical filament axis
      } else {
        scaleX = 1.06;
        scaleY = 1.02; // PAR36 sealed round
      }

      // Brightness: smooth thermal inertia radiant flux
      const wattageFactor = Math.sqrt(wattage / 55);
      const wearFactor = 1.0 - element.wear.fadeWear * 0.25;
      sourceBrightnessMult = wattageFactor * wearFactor * (element.brightness || 1.0) * 1.05;
      baseRadius = 50 * settings.bloomRadius * (0.85 + intensity * 0.45);

      // Gradient: Warm tungsten incandescence
      const tungsten = kelvinToRgb(2950);
      const filR = Math.min(255, Math.round(tungsten.r * 0.5 + 255 * 0.5));
      const filG = Math.min(255, Math.round(tungsten.g * 0.5 + 255 * 0.5));
      const filB = Math.min(255, Math.round(tungsten.b * 0.5 + 255 * 0.5));
      coreColor = `rgba(${filR}, ${filG}, ${filB}, 0.92)`;

      const warmR = Math.round(tungsten.r * 0.45 + (subglassRgb?.r ?? domeRgb.r) * 0.55);
      const warmG = Math.round(tungsten.g * 0.45 + (subglassRgb?.g ?? domeRgb.g) * 0.55);
      const warmB = Math.round(tungsten.b * 0.45 + (subglassRgb?.b ?? domeRgb.b) * 0.55);
      innerColor = `rgba(${warmR}, ${warmG}, ${warmB}, 0.62)`;

      midColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.28)`;
      outerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.04)`;
    } else if (element.type === 'xenon_strobe') {
      const strobe = element.strobe;
      const joules = strobe?.joules || 10;
      const gasTintRgb = hexToRgb(strobe?.gasTint || '#e0f2fe');

      // Shape: linear quartz flash tube horizontal discharge arc
      scaleX = 1.78;
      scaleY = 0.74;

      // Brightness: massive instantaneous peak discharge lumen output
      const joulesFactor = Math.sqrt(joules / 10);
      sourceBrightnessMult = joulesFactor * (element.brightness || 1.0) * 1.38;
      baseRadius = 62 * settings.bloomRadius * (0.8 + intensity * 0.55);

      // Gradient: Dazzling electric plasma arc
      coreColor = `rgba(242, 248, 255, 1.0)`; // Ionized plasma bright core

      const gasR = Math.round(gasTintRgb.r * 0.7 + (subglassRgb?.r ?? domeRgb.r) * 0.3);
      const gasG = Math.round(gasTintRgb.g * 0.7 + (subglassRgb?.g ?? domeRgb.g) * 0.3);
      const gasB = Math.round(gasTintRgb.b * 0.7 + (subglassRgb?.b ?? domeRgb.b) * 0.3);
      innerColor = `rgba(${gasR}, ${gasG}, ${gasB}, 0.85)`;

      midColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.40)`;
      outerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.06)`;
    } else {
      // Modern LED
      const led = element.led;
      const optic = led?.opticLens || 'linear';
      const diodeCount = led?.diodeCount || 6;

      // Shape: Optic lens geometry (Linear wide bar vs TIR concentrated collimator spot)
      if (optic === 'linear') {
        scaleX = 1.90 + Math.min(0.4, (diodeCount - 4) * 0.04);
        scaleY = 0.70;
      } else {
        // TIR collimator spot
        scaleX = 1.04;
        scaleY = 1.02;
      }

      // Brightness: high-efficiency monochromatic direct emitter
      const diodeFactor = Math.min(1.4, 0.85 + diodeCount * 0.06);
      sourceBrightnessMult = diodeFactor * (element.brightness || 1.0) * 1.25;
      baseRadius = 48 * settings.bloomRadius * (0.8 + intensity * 0.5);

      // Gradient: Pure monochromatic solid-state emitter without thermal yellowing
      const chipRgb = subglassRgb || domeRgb;
      const chipCoreR = Math.min(255, Math.round(chipRgb.r * 0.4 + 255 * 0.6));
      const chipCoreG = Math.min(255, Math.round(chipRgb.g * 0.4 + 255 * 0.6));
      const chipCoreB = Math.min(255, Math.round(chipRgb.b * 0.4 + 255 * 0.6));
      coreColor = `rgba(${chipCoreR}, ${chipCoreG}, ${chipCoreB}, 0.98)`;

      innerColor = `rgba(${chipRgb.r}, ${chipRgb.g}, ${chipRgb.b}, 0.78)`;
      midColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.30)`;
      outerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.04)`;
    }

    // Fluting optical refraction on halo shape
    if (flutingStyle === 'vertical_ribs' && flutingDensity > 0) {
      const flutingStretch = 1.0 + Math.min(0.55, flutingDensity / 45);
      scaleX *= flutingStretch;
    } else if (flutingStyle === 'diamond_optic') {
      scaleX *= 1.12;
      scaleY *= 1.08;
    }

    // Cloudiness diffusion: on cloudy domes, direct glare is softened, while diffuse halo volume expands
    const cloudDiffusion = 1.0 + domeCloudiness * 0.55;
    const effectiveRadius = baseRadius * cloudDiffusion;

    // Flare power computation
    const flarePower = Math.min(
      1.0,
      Math.pow(directClarity, 1.3) * intensity * sourceBrightnessMult * settings.coronaIntensity
    );
    if (flarePower <= 0.01) return;

    // 1. Soft atmospheric light wrap around the emitter (replaces harsh dome bloom with organic per-emitter ambient)
    const ambientRadius = effectiveRadius * 2.2;
    const ambientGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ambientRadius);
    ambientGrad.addColorStop(0, innerColor);
    ambientGrad.addColorStop(0.3, midColor);
    ambientGrad.addColorStop(0.7, outerColor);
    ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.translate(x + offsetX, y + offsetY);
    ctx.scale(scaleX * 1.15, scaleY * 1.15);
    ctx.globalAlpha = Math.min(0.38, flarePower * 0.40);
    ctx.fillStyle = ambientGrad;
    ctx.beginPath();
    ctx.arc(0, 0, ambientRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Render the Physical Optical Halo Corona
    ctx.save();
    ctx.translate(x + offsetX, y + offsetY);
    if (tiltAngle !== 0) {
      ctx.rotate(tiltAngle);
    }
    ctx.scale(scaleX, scaleY);

    const coronaGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, effectiveRadius * 1.5);
    coronaGrad.addColorStop(0, coreColor);
    coronaGrad.addColorStop(0.16, innerColor);
    coronaGrad.addColorStop(0.42, midColor);
    coronaGrad.addColorStop(0.75, outerColor);
    coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.globalAlpha = Math.min(0.92, flarePower * 0.90);
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(0, 0, effectiveRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. High-Intensity Directional Beam Flash Accents
    if (element.type === 'rotating_halogen' && intensity > 0.45) {
      const beamSweep = Math.cos(flare.rotationAngle ?? 0);
      if (beamSweep > 0.55) {
        const sweepIntensity = (beamSweep - 0.55) / 0.45;
        // Parabolic reflector front-facing specular flash
        ctx.save();
        ctx.translate(x + offsetX, y + offsetY);
        if (tiltAngle !== 0) ctx.rotate(tiltAngle);
        ctx.scale(scaleX * 1.6, scaleY * 0.65);
        const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveRadius * 1.3);
        flashGrad.addColorStop(0, coreColor);
        flashGrad.addColorStop(0.25, innerColor);
        flashGrad.addColorStop(0.65, midColor);
        flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = Math.min(0.85, flarePower * sweepIntensity * 0.8);
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(0, 0, effectiveRadius * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (element.type === 'xenon_strobe' && intensity > 0.35) {
      // Quartz flash tube high-joule ionization burst punch
      ctx.save();
      ctx.translate(x + offsetX, y + offsetY);
      ctx.scale(scaleX * 1.45, scaleY * 0.55);
      const strobeFlashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveRadius * 1.15);
      strobeFlashGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      strobeFlashGrad.addColorStop(0.2, 'rgba(224, 242, 254, 0.85)');
      strobeFlashGrad.addColorStop(0.55, innerColor);
      strobeFlashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = Math.min(0.95, flarePower * 0.88);
      ctx.fillStyle = strobeFlashGrad;
      ctx.beginPath();
      ctx.arc(0, 0, effectiveRadius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Source-Specific Micro-Core
    if (directClarity > 0.35 && intensity > 0.20) {
      this.renderSourceMicroCore(ctx, flare, x + offsetX, y + offsetY, directClarity, flarePower);
    }

    // Integrated Horizontal Anamorphic Flare Streak (Opt-in with enableLensFlares)
    if (settings.enableLensFlares && flutingDensity > 5 && directClarity > 0.3) {
      const streakLength = Math.min(width * 0.65, 200 * intensity * settings.refractionStrength * directClarity);
      const streakHeight = Math.max(1.5, 4.0 * directClarity);

      const streakGrad = ctx.createLinearGradient(x - streakLength / 2, 0, x + streakLength / 2, 0);
      streakGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      streakGrad.addColorStop(0.3, innerColor);
      streakGrad.addColorStop(0.5, coreColor);
      streakGrad.addColorStop(0.7, innerColor);
      streakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = streakGrad;
      ctx.globalAlpha = Math.min(0.75, flarePower * 0.65);
      ctx.fillRect(x - streakLength / 2, y - streakHeight / 2, streakLength, streakHeight);
    }

    // Optical Starburst Glare Spikes (Opt-in with enableLensFlares)
    if (settings.enableLensFlares && intensity > 0.85 && directClarity > 0.7) {
      const spikeAlpha = Math.min(0.55, (directClarity - 0.7) * 3.0 * (intensity - 0.75) * 1.5);
      const spikeLen = 28 * intensity;

      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = spikeAlpha;

      ctx.beginPath();
      ctx.moveTo(x - spikeLen, y);
      ctx.lineTo(x + spikeLen, y);
      ctx.moveTo(x, y - spikeLen * 0.65);
      ctx.lineTo(x, y + spikeLen * 0.65);
      ctx.stroke();
    }
  }

  /**
   * Render source-specific micro core (tungsten filament, xenon spark, or LED die array)
   */
  private renderSourceMicroCore(
    ctx: CanvasRenderingContext2D,
    flare: ActiveFlare,
    cx: number,
    cy: number,
    directClarity: number,
    flarePower: number
  ) {
    const { element, intensity } = flare;
    const coreAlpha = Math.min(0.92, (directClarity - 0.35) * 2.0 * flarePower * 0.9);

    if (element.type === 'xenon_strobe') {
      // Xenon electric arc spark
      const sparkW = 6 + intensity * 6;
      const sparkH = 3;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sparkW);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(224, 242, 254, 0.8)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = coreAlpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sparkW, sparkH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (element.type === 'modern_led') {
      // Modern LED die points
      const diodeCount = Math.min(4, element.led?.diodeCount || 4);
      const spacing = 4;
      const startX = cx - ((diodeCount - 1) * spacing) / 2;

      ctx.save();
      ctx.globalAlpha = coreAlpha;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      for (let i = 0; i < diodeCount; i++) {
        const dx = startX + i * spacing;
        ctx.beginPath();
        ctx.arc(dx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Incandescent filament micro-point
      const coreSize = 3 + intensity * 3.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 2.2);
      grad.addColorStop(0, 'rgba(255, 252, 240, 1.0)');
      grad.addColorStop(0.45, 'rgba(255, 215, 130, 0.7)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = coreAlpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderVolumetricBeams(
    ctx: CanvasRenderingContext2D,
    flares: Array<ActiveFlare>,
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    canvasH: number
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    flares.forEach((flare) => {
      if (flare.intensity < 0.2) return;
      const { x, y, intensity, element, domeCloudiness, domeColor } = flare;

      // When dome is cloudy, directional projection into the air above is scattered
      const beamClarity = Math.max(0, 1.0 - (domeCloudiness || 0) * 1.5);
      if (beamClarity <= 0.05) return;

      const domeRgb = hexToRgb(domeColor);
      const beamRgb = `rgb(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b})`;

      // Volumetric beam cone projecting upwards into night air / fog
      const coneLength = 160 * intensity * beamClarity;
      const spread = element.rotator ? element.rotator.beamSpreadDeg * 2.5 : 55;

      const beamGrad = ctx.createLinearGradient(x, y, x, y - coneLength);
      beamGrad.addColorStop(0, beamRgb);
      beamGrad.addColorStop(0.5, beamRgb);
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = beamGrad;
      ctx.globalAlpha = Math.min(0.45, intensity * 0.25 * beamClarity);

      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x - spread, y - coneLength);
      ctx.lineTo(x + spread, y - coneLength);
      ctx.lineTo(x + 8, y);
      ctx.closePath();
      ctx.fill();
    });

    ctx.restore();
  }

  private renderRoofLightPool(
    ctx: CanvasRenderingContext2D,
    flares: Array<{
      x: number;
      y: number;
      intensity: number;
      glowColor: string;
    }>,
    barX: number,
    trayY: number,
    barW: number,
    barH: number
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    flares.forEach((flare) => {
      if (flare.intensity < 0.1) return;
      const rx = flare.x;
      const ry = trayY + 32;

      // Pool of colored reflected light on car roof
      const poolGrad = ctx.createRadialGradient(rx, ry, 5, rx, ry, 90 * flare.intensity);
      poolGrad.addColorStop(0, flare.glowColor);
      poolGrad.addColorStop(0.5, flare.glowColor);
      poolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = poolGrad;
      ctx.globalAlpha = Math.min(0.65, flare.intensity * 0.45);
      ctx.beginPath();
      ctx.ellipse(rx, ry, 90 * flare.intensity, 24 * flare.intensity, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  private renderLensDirt(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    flares: Array<{ intensity: number }>
  ) {
    const totalIntensity = flares.reduce((acc, f) => acc + f.intensity, 0);
    if (totalIntensity < 0.1) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.08, totalIntensity * 0.012)})`;

    // Subtle bokeh particles catching stray light
    const spots = [
      { x: width * 0.28, y: height * 0.32, r: 25 },
      { x: width * 0.72, y: height * 0.35, r: 35 },
      { x: width * 0.5, y: height * 0.22, r: 18 },
      { x: width * 0.18, y: height * 0.6, r: 28 },
      { x: width * 0.82, y: height * 0.58, r: 22 },
    ];

    spots.forEach((sp) => {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}
