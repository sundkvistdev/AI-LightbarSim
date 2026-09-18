import { LightbarConfig, RenderSettings, SequencerState } from '../types';
import { blendGlassColor, hexToRgb, kelvinToRgb } from '../utils/colorUtils';
import { renderVehicleMountings, renderRoofLightPool } from './atmosphere';
import { LightbarGeometry } from './bounds';
import {
  renderRotatorReflector,
  renderStaticHalogenBulb,
  renderXenonStrobeTube,
  renderLedModule,
} from './emitters';
import { renderGlassCovering } from './glass';
import { renderHousingFrame } from './housing';
import {
  renderHalosAndCoronas,
  renderLensDirt,
  renderVolumetricBeams,
} from './effects';
import { ActiveFlare, RenderCallbacks, SimulationState } from './types';

export class FrontRenderer {
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
    // 1. Sequencer Active Steps
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

    // 2. Layout geometry with dynamic structure type bounds
    const { barX, barY, barW, barH } = LightbarGeometry.getStructureBounds(config, width, height);

    // 3. Render Vehicle Roof & Mountings
    renderVehicleMountings(ctx, config, barX, barY, barW, barH);

    // 4. Render Housing Backplane & Frame
    renderHousingFrame(ctx, config, barX, barY, barW, barH);

    // 5. Update and render Elements (Internal lamps, rotators, strobes)
    const activeFlares: Array<ActiveFlare> = [];

    config.elements.forEach((elem) => {
      if (!elem.enabled) return;

      const { x: elemX, y: elemY } = LightbarGeometry.getElementPosition(
        elem,
        config,
        barX,
        barY,
        barW,
        barH
      );

      const isBeacon = config.structure.type === 'cylindrical_beacon' || config.structure.type === 'teardrop_beacon';
      const elemRenderSize = isBeacon
        ? (config.elements.length > 2 ? barH * 0.44 : barH * 0.68)
        : barH * 0.7;

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

      if (elem.type === 'rotating_halogen' && elem.rotator) {
        let currentAngle = state.rotatorAngles.get(elem.id) || (elem.rotator.phaseOffsetDeg * Math.PI) / 180;
        const rpm = elem.rotator.rpm * sequencer.rotatorSpeedMultiplier;
        const radPerSec = (rpm * 2 * Math.PI) / 60 * elem.rotator.rotationDirection;
        currentAngle += radPerSec * state.dt;
        state.rotatorAngles.set(elem.id, currentAngle);

        let viewOffsetAngle = 0;
        if (settings.viewAngle === 'angled_iso') viewOffsetAngle = 0.45;

        const effectiveAngle = currentAngle - viewOffsetAngle;
        const cosAngle = Math.cos(effectiveAngle);
        const isDual = elem.rotator.reflectorType === 'dual_sided_mirror';
        const beamAlignment = isDual ? Math.abs(cosAngle) : Math.max(0, cosAngle);

        const exponent = Math.max(6, 120 / (elem.rotator.beamSpreadDeg || 24));
        const directionalGlow = Math.pow(beamAlignment, exponent);

        const filamentRgb = kelvinToRgb(elem.rotator.filamentWarmth || 3000);
        const blended = blendGlassColor(
          filamentRgb,
          elem.subglassColor,
          domeColor,
          domeOpacity,
          domeCloud
        );

        renderRotatorReflector(ctx, elem, elemX, elemY, elemRenderSize, effectiveAngle, blended);

        const flashIntensity = directionalGlow * elem.brightness * (1 - elem.wear.fadeWear * 0.3);
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

        renderStaticHalogenBulb(ctx, elem, elemX, elemY, elemRenderSize * 0.92, thermal, blended);

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

        renderXenonStrobeTube(ctx, elem, elemX, elemY, elemRenderSize * 0.85, energy, blended);

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
        renderLedModule(ctx, elem, elemX, elemY, elemRenderSize * 0.72, isActive, blended);
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

    // 6. Glass / Domes Covering
    renderGlassCovering(ctx, config, barX, barY, barW, barH, activeFlares, settings, state);

    // 7. Halos & Coronas
    if (settings.enableHalos !== false && settings.coronaIntensity > 0) {
      renderHalosAndCoronas(ctx, config, activeFlares, settings, barX, barY, barW, barH, width, height);
    }

    // 8. Volumetric Beams in Air
    if (settings.enableLensFlares && settings.showBeamsInAir) {
      renderVolumetricBeams(ctx, activeFlares, barX, barY, barW, barH, height);
    }

    // 9. Roof Reflection Pool
    if (settings.enableLensFlares && settings.roofReflection) {
      renderRoofLightPool(ctx, activeFlares, barX, barY + barH, barW, barH);
    }

    // 10. Lens dirt
    if (settings.enableLensFlares && settings.lensDirt) {
      renderLensDirt(ctx, width, height, activeFlares);
    }
  }
}
