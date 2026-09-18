import { LightbarConfig, LightElement, RenderSettings, SequencerState } from '../types';
import { blendGlassColor, hexToRgb, kelvinToRgb } from '../utils/colorUtils';
import { LightbarGeometry } from './bounds';
import { RenderCallbacks, SimulationState } from './types';

export class OverheadRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    settings: RenderSettings,
    sequencer: SequencerState,
    state: SimulationState,
    width: number,
    height: number,
    onAudioTrigger?: RenderCallbacks
  ) {
    ctx.save();

    // 1. Sequencer Clock & Step Calculation
    const secondsPerBeat = 60 / Math.max(20, sequencer.bpm);
    const stepCount = 16;
    const stepDuration = secondsPerBeat / 4;
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

    // 2. Geometry for Overhead View
    const { barX, barW } = LightbarGeometry.getStructureBounds(config, width, height);

    // Top-down depth of lightbar (scaled to physical proportions)
    const isBeacon = config.structure.type === 'cylindrical_beacon' || config.structure.type === 'teardrop_beacon';
    const isMiniBar = config.structure.type === 'mini_bar';
    const isVBar = config.structure.type === 'v_bar';

    const barDepth = isBeacon ? Math.min(barW, 180) : isMiniBar ? 85 : 120;
    const barY = height * 0.44 - barDepth / 2;

    // 3. Render Vehicle Top Body (Roof, Windshield, Rear Window, Gutters)
    this.renderVehicleRoofTopDown(ctx, width, height, barX, barY, barW, barDepth);

    // 4. Render Mounting Gutters & Crossbars
    this.renderMountingBracketsTopDown(ctx, config, barX, barY, barW, barDepth);

    // 5. Render Lightbar Metal Tray & Chassis
    this.renderChassisTopDown(ctx, config, barX, barY, barW, barDepth, isVBar, isBeacon);

    // 6. Update Physics & Render Internal Light Emitters + 360° Sweeping Optical Beams
    this.renderElementsAndBeamsTopDown(
      ctx,
      config,
      settings,
      sequencer,
      state,
      barX,
      barY,
      barW,
      barDepth,
      stepA,
      stepB,
      stepC,
      isStepTransition,
      onAudioTrigger
    );

    // 7. Render Top-Down Polycarbonate Domes & Glass Shells
    this.renderDomesTopDown(ctx, config, settings, barX, barY, barW, barDepth, isVBar, isBeacon);

    ctx.restore();
  }

  /**
   * Render Vehicle Silhouette from directly above
   */
  private static renderVehicleRoofTopDown(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    barX: number,
    barY: number,
    barW: number,
    barDepth: number
  ) {
    ctx.save();

    const carW = barW + 140;
    const carH = Math.min(height * 0.90, 580);
    const carX = (width - carW) / 2;
    const carY = (height - carH) / 2;

    // Outer Vehicle Body Shell (Deep cruiser blue/charcoal with clearcoat)
    const bodyGrad = ctx.createLinearGradient(carX, 0, carX + carW, 0);
    bodyGrad.addColorStop(0, '#0a0d14');
    bodyGrad.addColorStop(0.12, '#151922');
    bodyGrad.addColorStop(0.5, '#1e2430');
    bodyGrad.addColorStop(0.88, '#151922');
    bodyGrad.addColorStop(1, '#0a0d14');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(carX, carY, carW, carH, [36, 36, 44, 44]);
    ctx.fill();

    // Body panel boundary contour
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Front Windshield (curved forward glass panel with tinted edge)
    const wsTopY = carY + 28;
    const wsH = carH * 0.22;
    const wsGrad = ctx.createLinearGradient(0, wsTopY, 0, wsTopY + wsH);
    wsGrad.addColorStop(0, '#0b131e');
    wsGrad.addColorStop(0.5, '#142030');
    wsGrad.addColorStop(1, '#090d14');

    ctx.fillStyle = wsGrad;
    ctx.beginPath();
    ctx.moveTo(carX + 24, wsTopY + wsH);
    ctx.quadraticCurveTo(carX + carW / 2, wsTopY - 14, carX + carW - 24, wsTopY + wsH);
    ctx.lineTo(carX + carW - 16, wsTopY + 12);
    ctx.quadraticCurveTo(carX + carW / 2, wsTopY - 24, carX + 16, wsTopY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Front windshield wiper cowl lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(carX + carW * 0.22, wsTopY + wsH - 8);
    ctx.lineTo(carX + carW * 0.44, wsTopY + 24);
    ctx.moveTo(carX + carW * 0.56, wsTopY + wsH - 8);
    ctx.lineTo(carX + carW * 0.78, wsTopY + 24);
    ctx.stroke();

    // Rear Window (sloped glass panel at bottom of roof)
    const rwTopY = carY + carH - carH * 0.22;
    const rwH = carH * 0.18;
    const rwGrad = ctx.createLinearGradient(0, rwTopY, 0, rwTopY + rwH);
    rwGrad.addColorStop(0, '#090d14');
    rwGrad.addColorStop(0.6, '#131b26');
    rwGrad.addColorStop(1, '#090c12');

    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(carX + 18, rwTopY);
    ctx.quadraticCurveTo(carX + carW / 2, rwTopY + 16, carX + carW - 18, rwTopY);
    ctx.lineTo(carX + carW - 24, rwTopY + rwH);
    ctx.quadraticCurveTo(carX + carW / 2, rwTopY + rwH + 10, carX + 24, rwTopY + rwH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rear defroster electric grid lines
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.12)';
    ctx.lineWidth = 1;
    for (let dy = rwTopY + 14; dy < rwTopY + rwH - 10; dy += 9) {
      ctx.beginPath();
      ctx.moveTo(carX + 36, dy);
      ctx.lineTo(carX + carW - 36, dy);
      ctx.stroke();
    }

    // Roof Rain Gutters / Rails running down left and right flanks
    const gutterL = carX + 18;
    const gutterR = carX + carW - 18;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gutterL, wsTopY + wsH);
    ctx.lineTo(gutterL, rwTopY);
    ctx.moveTo(gutterR, wsTopY + wsH);
    ctx.lineTo(gutterR, rwTopY);
    ctx.stroke();

    // Center roof ridge / reinforcing creases
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(carX + carW * 0.35, wsTopY + wsH + 15);
    ctx.lineTo(carX + carW * 0.35, rwTopY - 15);
    ctx.moveTo(carX + carW * 0.65, wsTopY + wsH + 15);
    ctx.lineTo(carX + carW * 0.65, rwTopY - 15);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render Mounting Gutters & Crossbars Top-Down
   */
  private static renderMountingBracketsTopDown(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barDepth: number
  ) {
    ctx.save();
    const isBeacon = config.structure.type === 'cylindrical_beacon' || config.structure.type === 'teardrop_beacon';
    const isBridge = config.structure.type === 'dual_beacon_bridge';

    if (isBeacon) {
      // Beacon base pad / circular mounting flange
      const cx = barX + barW / 2;
      const cy = barY + barDepth / 2;
      const baseRadius = barDepth * 0.58;

      const padGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, baseRadius);
      padGrad.addColorStop(0, '#374151');
      padGrad.addColorStop(0.7, '#1f2937');
      padGrad.addColorStop(1, '#111827');

      ctx.fillStyle = padGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rubber gasket ring
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Full lightbar crossbars spanning from roof gutters
      const crossbarW = barW + 50;
      const crossbarX = barX - 25;
      const crossbarY1 = barY + 12;
      const crossbarY2 = barY + barDepth - 12;

      [crossbarY1, crossbarY2].forEach((cy) => {
        // Black steel or chrome crossbar tube
        const cbGrad = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
        if (config.structure.frameFinish === 'chrome' || isBridge) {
          cbGrad.addColorStop(0, '#4b5563');
          cbGrad.addColorStop(0.5, '#e5e7eb');
          cbGrad.addColorStop(1, '#374151');
        } else {
          cbGrad.addColorStop(0, '#1f2937');
          cbGrad.addColorStop(0.5, '#374151');
          cbGrad.addColorStop(1, '#111827');
        }

        ctx.fillStyle = cbGrad;
        ctx.beginPath();
        ctx.roundRect(crossbarX, cy - 5, crossbarW, 10, 3);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Gutter clamping feet pads at ends
        ctx.fillStyle = '#09090b';
        ctx.fillRect(crossbarX - 4, cy - 8, 12, 16);
        ctx.fillRect(crossbarX + crossbarW - 8, cy - 8, 12, 16);

        // Stainless clamp bolts
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath();
        ctx.arc(crossbarX + 2, cy, 2.5, 0, Math.PI * 2);
        ctx.arc(crossbarX + crossbarW - 2, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }

  /**
   * Render Lightbar Chassis Frame & Speaker Grille Top-Down
   */
  private static renderChassisTopDown(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barDepth: number,
    isVBar: boolean,
    isBeacon: boolean
  ) {
    ctx.save();
    const finish = config.structure.frameFinish;

    // Helper metal gradient
    const getMetalGrad = (x0: number, y0: number, x1: number, y1: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      if (finish === 'chrome' || finish === 'stainless_tubular') {
        g.addColorStop(0, '#4b5563');
        g.addColorStop(0.3, '#f3f4f6');
        g.addColorStop(0.7, '#9ca3af');
        g.addColorStop(1, '#374151');
      } else if (finish === 'brushed_aluminum') {
        g.addColorStop(0, '#6b7280');
        g.addColorStop(0.5, '#9ca3af');
        g.addColorStop(1, '#4b5563');
      } else {
        g.addColorStop(0, '#27272a');
        g.addColorStop(0.5, '#18181b');
        g.addColorStop(1, '#09090b');
      }
      return g;
    };

    if (isBeacon) {
      const cx = barX + barW / 2;
      const cy = barY + barDepth / 2;
      const r = barDepth * 0.48;

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = getMetalGrad(cx - r, cy, cx + r, cy);
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (isVBar) {
      const podCount = config.structure.podCount || 7;
      const podW = barW / podCount;
      const vFactor = (config.structure.vAngleDeg || 24) / 24;

      for (let i = 0; i < podCount; i++) {
        const podNormX = (i + 0.5) / podCount;
        const vOffsetY = (1 - 2 * Math.abs(podNormX - 0.5)) * barDepth * 0.45 * vFactor;
        const px = barX + i * podW;
        const py = barY + vOffsetY;

        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.roundRect(px + 2, py + 2, podW - 4, barDepth - 4, 6);
        ctx.fill();
        ctx.strokeStyle = getMetalGrad(px, py, px + podW, py);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      // Standard rectangular / aerodynamic lightbar tray
      ctx.fillStyle = '#111317';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barDepth, 14);
      ctx.fill();

      // Outer metal frame border
      ctx.strokeStyle = getMetalGrad(barX, barY, barX + barW, barY);
      ctx.lineWidth = 3;
      ctx.stroke();

      // Center speaker mesh top view
      if (config.structure.speakerCenter !== 'none') {
        const centerDome = config.domes.find(
          (d) => d.id.includes('speaker') || d.id.includes('center') || d.id.includes('mid') || (d.startX <= 0.45 && d.endX >= 0.55)
        );
        if (centerDome) {
          const spkX = barX + centerDome.startX * barW;
          const spkW = (centerDome.endX - centerDome.startX) * barW;
          const spkH = barDepth - 8;
          const spkY = barY + 4;

          ctx.fillStyle = '#1f242d';
          ctx.beginPath();
          ctx.roundRect(spkX, spkY, spkW, spkH, 6);
          ctx.fill();
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Speaker top grille perforated dots
          ctx.fillStyle = '#111827';
          const dotStep = 8;
          for (let dx = spkX + 6; dx < spkX + spkW - 6; dx += dotStep) {
            for (let dy = spkY + 6; dy < spkY + spkH - 6; dy += dotStep) {
              ctx.beginPath();
              ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    ctx.restore();
  }

  /**
   * Render Elements, Internal Hardware & Realistic 360-Degree Sweeping Beams
   */
  private static renderElementsAndBeamsTopDown(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    settings: RenderSettings,
    sequencer: SequencerState,
    state: SimulationState,
    barX: number,
    barY: number,
    barW: number,
    barDepth: number,
    stepA: boolean,
    stepB: boolean,
    stepC: boolean,
    isStepTransition: boolean,
    onAudioTrigger?: RenderCallbacks
  ) {
    const isVBar = config.structure.type === 'v_bar';
    const vFactor = (config.structure.vAngleDeg || 24) / 24;

    config.elements.forEach((elem) => {
      if (!elem.enabled) return;

      const matchingDome = config.domes.find(
        (d) => elem.xNorm >= d.startX && elem.xNorm <= d.endX
      ) || config.domes[0];

      const domeColor = matchingDome ? matchingDome.color : '#ffffff';
      const domeOpacity = matchingDome ? matchingDome.opacity : 0.8;
      const domeCloud = matchingDome ? matchingDome.cloudiness : 0.2;
      const domeRgb = hexToRgb(domeColor);

      // Element coordinate in top-down view
      const elemX = barX + elem.xNorm * barW;
      const vOffsetY = isVBar ? (1 - 2 * Math.abs(elem.xNorm - 0.5)) * barDepth * 0.45 * vFactor : 0;
      const elemY = barY + barDepth / 2 + elem.yNorm * (barDepth * 0.35) + vOffsetY;

      // 1. ROTATING HALOGEN (The Crown Jewel of Overhead Optical Realism!)
      if (elem.type === 'rotating_halogen' && elem.rotator) {
        const rot = elem.rotator;
        let currentAngle = state.rotatorAngles.get(elem.id) || (rot.phaseOffsetDeg * Math.PI) / 180;
        const rpm = rot.rpm * sequencer.rotatorSpeedMultiplier;
        const radPerSec = (rpm * 2 * Math.PI) / 60 * rot.rotationDirection;
        currentAngle += radPerSec * state.dt;
        state.rotatorAngles.set(elem.id, currentAngle);

        // Effective angle pointing from top down (angle 0 points straight down towards front of vehicle)
        const angle = currentAngle;
        const isDual = rot.reflectorType === 'dual_sided_mirror';

        // Warm filament color blended through dome
        const filamentRgb = kelvinToRgb(rot.filamentWarmth || 3000);
        const blended = blendGlassColor(
          filamentRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        // Project 360-Degree Sweeping Light Beams Outward!
        const beamAngles = isDual ? [angle, angle + Math.PI] : [angle];
        const spreadRad = ((rot.beamSpreadDeg || 26) * Math.PI) / 180;
        const beamLength = Math.min(360, 240 * elem.brightness * (1 - elem.wear.fadeWear * 0.2));

        beamAngles.forEach((bAngle) => {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';

          // Beam cone: sweeps outward from focal point (elemX, elemY)
          const startA = bAngle - spreadRad / 2;
          const endA = bAngle + spreadRad / 2;

          const beamGrad = ctx.createRadialGradient(elemX, elemY, 6, elemX, elemY, beamLength);
          beamGrad.addColorStop(0, blended.coreRgb);
          beamGrad.addColorStop(0.18, blended.glowRgb);
          beamGrad.addColorStop(0.55, `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.28)`);
          beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = beamGrad;
          ctx.globalAlpha = Math.min(0.85, 0.65 * elem.brightness * (1 - elem.wear.fadeWear * 0.25));

          ctx.beginPath();
          ctx.moveTo(elemX, elemY);
          ctx.arc(elemX, elemY, beamLength, startA, endA);
          ctx.closePath();
          ctx.fill();

          // Intense focal beam center streak
          ctx.strokeStyle = blended.coreRgb;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = Math.min(0.9, 0.75 * elem.brightness);
          ctx.beginPath();
          ctx.moveTo(elemX, elemY);
          ctx.lineTo(elemX + Math.cos(bAngle) * beamLength * 0.85, elemY + Math.sin(bAngle) * beamLength * 0.85);
          ctx.stroke();

          ctx.restore();
        });

        // Overhead Reflector Assembly (Internal hardware seen from top down)
        ctx.save();
        const baseRadius = barDepth * 0.30;

        // Chrome circular turntable base
        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.arc(elemX, elemY, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Parabolic curved reflector dish slice rotating with exact angle
        ctx.save();
        ctx.translate(elemX, elemY);
        ctx.rotate(angle);

        // Concave reflector mirror arc
        ctx.strokeStyle = rot.reflectorFinish === 'chrome' ? '#ffffff' : '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius * 0.85, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();

        // Dark rear backing of mirror
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius * 0.95, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();

        if (isDual) {
          // Opposite secondary reflector dish
          ctx.strokeStyle = rot.reflectorFinish === 'chrome' ? '#ffffff' : '#e2e8f0';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, baseRadius * 0.85, Math.PI * 0.55, Math.PI * 1.45);
          ctx.stroke();
        }

        // Center bulb filament capsule (at focal point)
        ctx.fillStyle = blended.coreRgb;
        ctx.shadowColor = blended.glowRgb;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
        ctx.restore();
      }

      // 2. STATIC HALOGEN FLASHER
      else if (elem.type === 'static_halogen' && elem.halogen) {
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

        const currentKelvin = 1800 + thermal * 1400;
        const filamentRgb = kelvinToRgb(currentKelvin);
        const blended = blendGlassColor(
          filamentRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        // Forward directional beam cone
        if (thermal > 0.05) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const beamLen = 180 * thermal * elem.brightness;
          const beamGrad = ctx.createRadialGradient(elemX, elemY, 4, elemX, elemY, beamLen);
          beamGrad.addColorStop(0, blended.coreRgb);
          beamGrad.addColorStop(0.3, blended.glowRgb);
          beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = beamGrad;
          ctx.globalAlpha = Math.min(0.75, thermal * 0.65 * elem.brightness);
          ctx.beginPath();
          ctx.moveTo(elemX, elemY);
          ctx.arc(elemX, elemY, beamLen, Math.PI * 0.3, Math.PI * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Halogen Reflector Cup
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(elemX, elemY, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = blended.coreRgb;
        ctx.beginPath();
        ctx.arc(elemX, elemY, 3 + thermal * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. XENON STROBE DISCHARGE
      else if (elem.type === 'xenon_strobe' && elem.strobe) {
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
          const decayRate = 1.0 / ((elem.strobe.flashDurationMs || 8) / 1000);
          energy = Math.max(0, energy - state.dt * decayRate * 1.5);
          state.strobeEnergy.set(elem.id, energy);
        }

        const xenonGasRgb = hexToRgb(elem.strobe.gasTint || '#e0f2fe');
        const blended = blendGlassColor(
          xenonGasRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        // High-Energy Omnidirectional Flash Burst
        if (energy > 0.05) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const burstRad = 220 * energy * elem.brightness;
          const flashGrad = ctx.createRadialGradient(elemX, elemY, 2, elemX, elemY, burstRad);
          flashGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
          flashGrad.addColorStop(0.2, blended.coreRgb);
          flashGrad.addColorStop(0.5, blended.glowRgb);
          flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = flashGrad;
          ctx.globalAlpha = Math.min(0.95, energy * 0.85 * elem.brightness);
          ctx.beginPath();
          ctx.arc(elemX, elemY, burstRad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Reflector cup & quartz tube from above
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(elemX - 12, elemY - 8, 24, 16, 3);
        ctx.fill();

        ctx.strokeStyle = energy > 0.1 ? blended.coreRgb : 'rgba(224, 242, 254, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(elemX, elemY, 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. MODERN LED
      else {
        let isActive = elem.syncGroup === 'A' ? stepA : elem.syncGroup === 'B' ? stepB : stepC;
        if (elem.syncGroup === 'STEADY') isActive = true;

        const blended = blendGlassColor(
          { r: 255, g: 255, b: 255 },
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        if (isActive) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const beamLen = 160 * elem.brightness;
          const ledGrad = ctx.createRadialGradient(elemX, elemY, 2, elemX, elemY, beamLen);
          ledGrad.addColorStop(0, blended.coreRgb);
          ledGrad.addColorStop(0.35, blended.glowRgb);
          ledGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = ledGrad;
          ctx.globalAlpha = Math.min(0.85, 0.7 * elem.brightness);
          ctx.beginPath();
          ctx.moveTo(elemX, elemY);
          ctx.arc(elemX, elemY, beamLen, Math.PI * 0.25, Math.PI * 0.75);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // LED housing strip from above
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(elemX - 14, elemY - 5, 28, 10);
        ctx.fillStyle = isActive ? blended.coreRgb : '#475569';
        [-8, 0, 8].forEach((ox) => {
          ctx.beginPath();
          ctx.arc(elemX + ox, elemY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  }

  /**
   * Render Top-Down Polycarbonate Dome Envelopes & Fluted Lenses
   */
  private static renderDomesTopDown(
    ctx: CanvasRenderingContext2D,
    config: LightbarConfig,
    _settings: RenderSettings,
    barX: number,
    barY: number,
    barW: number,
    barDepth: number,
    isVBar: boolean,
    isBeacon: boolean
  ) {
    ctx.save();
    const vFactor = (config.structure.vAngleDeg || 24) / 24;

    config.domes.forEach((dome) => {
      const domeX = barX + dome.startX * barW;
      const domeW = (dome.endX - dome.startX) * barW;
      if (domeW <= 0) return;

      const rgb = hexToRgb(dome.color);

      if (isBeacon) {
        const cx = barX + barW / 2;
        const cy = barY + barDepth / 2;
        const r = barDepth * 0.46;

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.55, dome.opacity * 0.45)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Outer glass wall rim highlight
        ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 80)}, ${Math.min(255, rgb.g + 80)}, ${Math.min(255, rgb.b + 80)}, 0.85)`;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      } else if (isVBar) {
        const podNormX = (dome.startX + dome.endX) / 2;
        const vOffsetY = (1 - 2 * Math.abs(podNormX - 0.5)) * barDepth * 0.45 * vFactor;
        const py = barY + vOffsetY;

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.55, dome.opacity * 0.45)})`;
        ctx.beginPath();
        ctx.roundRect(domeX, py, domeW, barDepth, 6);
        ctx.fill();

        ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 80)}, ${Math.min(255, rgb.g + 80)}, ${Math.min(255, rgb.b + 80)}, 0.85)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        // Full lightbar dome section top view
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.55, dome.opacity * 0.45)})`;
        ctx.beginPath();
        ctx.roundRect(domeX, barY, domeW, barDepth, 8);
        ctx.fill();

        // Top glass fluting lines along lens length
        if (dome.fluting.intensity > 0.1) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * dome.fluting.intensity})`;
          ctx.lineWidth = 1;
          const spacing = Math.max(8, 120 / dome.fluting.density);
          for (let lx = domeX + 4; lx < domeX + domeW - 4; lx += spacing) {
            ctx.beginPath();
            ctx.moveTo(lx, barY + 3);
            ctx.lineTo(lx, barY + barDepth - 3);
            ctx.stroke();
          }
        }

        // Glass perimeter shell rim
        ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 70)}, ${Math.min(255, rgb.g + 70)}, ${Math.min(255, rgb.b + 70)}, 0.85)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}
