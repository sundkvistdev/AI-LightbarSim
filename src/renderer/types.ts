import { BaseStructureType, DomeSection, ElementType, FlutingStyle, LightbarConfig, LightElement, RenderSettings, SequencerState, ViewAngle } from '../types';

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

export interface RenderCallbacks {
  onRelay?: () => void;
  onStrobe?: (joules: number) => void;
}

export interface StructureBounds {
  barX: number;
  barY: number;
  barW: number;
  barH: number;
}

export function createDeterministicRng(seed: number): () => number {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}
