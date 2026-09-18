import { LightbarConfig, LightElement, SequencerState } from '../types';
import { RenderCallbacks, SimulationState } from './types';

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

export function updateSimulationPhysics(
  config: LightbarConfig,
  sequencer: SequencerState,
  simState: SimulationState,
  callbacks?: RenderCallbacks
): { currentStepIndex: number } {
  const dt = simState.dt;

  // Evaluate 16-step Sequencer Clock
  const stepDuration = 60 / sequencer.bpm / 4; // 16th notes
  const currentStepIndex = Math.floor(simState.timeSec / stepDuration) % 16;
  const isNewStep = currentStepIndex !== simState.lastStepIndex;

  if (isNewStep && callbacks?.onRelay) {
    // Fire audible relay click when sequence step switches
    callbacks.onRelay();
  }
  simState.lastStepIndex = currentStepIndex;

  // Process physics for each element
  for (const element of config.elements) {
    if (!element.enabled) {
      simState.filamentThermal.set(element.id, 0);
      simState.strobeEnergy.set(element.id, 0);
      continue;
    }

    // Determine if this element's sync group is actively driven HIGH on this step
    let isDriven = false;
    if (element.syncGroup === 'STEADY') {
      isDriven = true;
    } else if (element.syncGroup === 'INDEPENDENT') {
      isDriven = true;
    } else if (element.syncGroup === 'A') {
      isDriven = sequencer.customStepsA[currentStepIndex] ?? false;
    } else if (element.syncGroup === 'B') {
      isDriven = sequencer.customStepsB[currentStepIndex] ?? false;
    } else if (element.syncGroup === 'C') {
      isDriven = sequencer.customStepsC[currentStepIndex] ?? false;
    }

    // 1. ROTATING HALOGEN
    if (element.type === 'rotating_halogen' && element.rotator) {
      const rot = element.rotator;
      const currentAngle = simState.rotatorAngles.get(element.id) ?? (rot.phaseOffsetDeg * Math.PI) / 180;
      const radPerSec =
        ((rot.rpm * sequencer.rotatorSpeedMultiplier) / 60) * Math.PI * 2 * rot.rotationDirection;
      const nextAngle = (currentAngle + radPerSec * dt) % (Math.PI * 2);
      simState.rotatorAngles.set(element.id, nextAngle);

      // Thermal inertia for rotating halogen bulb
      const currentTherm = simState.filamentThermal.get(element.id) ?? 0;
      const targetTherm = isDriven ? 1.0 : 0.0;
      const riseRate = dt / 0.08;
      const fallRate = dt / 0.16;
      let nextTherm = currentTherm;
      if (targetTherm > currentTherm) {
        nextTherm = Math.min(1.0, currentTherm + riseRate);
      } else {
        nextTherm = Math.max(0.0, currentTherm - fallRate);
      }
      simState.filamentThermal.set(element.id, nextTherm);
    }

    // 2. STATIC HALOGEN FLASHER
    else if (element.type === 'static_halogen' && element.halogen) {
      const hal = element.halogen;
      const currentTherm = simState.filamentThermal.get(element.id) ?? 0;
      const targetTherm = isDriven ? 1.0 : 0.0;
      const riseRate = dt / (hal.filamentThermalRiseMs / 1000);
      const fallRate = dt / (hal.filamentThermalFallMs / 1000);

      let nextTherm = currentTherm;
      if (targetTherm > currentTherm) {
        nextTherm = Math.min(1.0, currentTherm + riseRate);
      } else {
        nextTherm = Math.max(0.0, currentTherm - fallRate);
      }
      simState.filamentThermal.set(element.id, nextTherm);
    }

    // 3. XENON STROBE DISCHARGE
    else if (element.type === 'xenon_strobe' && element.strobe) {
      const strobe = element.strobe;
      const currentEnergy = simState.strobeEnergy.get(element.id) ?? 0;
      const lastTrigger = simState.strobeLastTrigger.get(element.id) ?? -99;
      const timeSinceTrigger = simState.timeSec - lastTrigger;

      // Decay curve for existing flash: sharp peak followed by exponential decay
      const decayDuration = strobe.flashDurationMs / 1000;
      let nextEnergy = 0;
      if (timeSinceTrigger < decayDuration) {
        nextEnergy = Math.max(0, 1 - timeSinceTrigger / decayDuration);
      }

      // Check if newly triggered on this sequencer step
      if (isNewStep && isDriven) {
        simState.strobeLastTrigger.set(element.id, simState.timeSec);
        nextEnergy = 1.0;
        if (callbacks?.onStrobe) {
          callbacks.onStrobe(strobe.joules);
        }
      }
      simState.strobeEnergy.set(element.id, nextEnergy);
    }

    // 4. MODERN SOLID STATE LED
    else if (element.type === 'modern_led') {
      // Instantaneous switching with near-zero thermal latency (sub-millisecond)
      simState.filamentThermal.set(element.id, isDriven ? 1.0 : 0.0);
    }
  }

  return { currentStepIndex };
}
