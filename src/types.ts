/**
 * Optical Lightbar Simulator - Type Definitions
 */

export type BaseStructureType = 'rotary_domes' | 'rigid_bar' | 'aero_modular' | 'v_bar';

export type ElementType = 'rotating_halogen' | 'static_halogen' | 'xenon_strobe' | 'modern_led';

export type SyncGroup = 'A' | 'B' | 'C' | 'STEADY' | 'INDEPENDENT';

export type FlutingStyle = 'vertical_ribs' | 'fresnel_prism' | 'diamond_optic' | 'smooth_optic';

export interface DomeSection {
  id: string;
  name: string;
  startX: number; // 0 to 1
  endX: number;   // 0 to 1
  color: string;  // Hex color e.g. #dc2626
  opacity: number; // 0.1 to 1.0
  cloudiness: number; // 0 (crystal clear) to 1 (heavy frosted diffusion)
  fluting: {
    style: FlutingStyle;
    density: number; // Rib count factor e.g. 10 - 40
    intensity: number; // 0 to 1
  };
  wear: {
    scratches: number; // 0 to 1
    yellowing: number; // UV patina 0 to 1
    dirtHaze: number;  // Road film 0 to 1
  };
}

export interface RotatorConfig {
  rpm: number;
  beamSpreadDeg: number; // Beam cone width in degrees, e.g. 24
  rotationDirection: 1 | -1;
  phaseOffsetDeg: number; // 0 to 360
  reflectorType: 'parabolic_dish' | 'sealed_beam_par36' | 'par46' | 'dual_sided_mirror';
  wattage: number; // 35W, 55W, 100W
  filamentWarmth: number; // 2700K to 3400K
  reflectorFinish: 'chrome' | 'polished_aluminum' | 'patina_aged';
}

export interface HalogenFlasherConfig {
  filamentThermalRiseMs: number; // 40 - 100ms
  filamentThermalFallMs: number; // 80 - 180ms
  wattage: number;
  bulbShape: 'h1' | 'h3' | 'par36';
}

export interface XenonStrobeConfig {
  joules: number; // 5 to 20J
  flashDurationMs: number; // 5 to 15ms
  burstPattern: 'single' | 'double' | 'triple' | 'quad';
  gasTint: string; // #dbeafe
}

export interface LedConfig {
  diodeCount: number;
  opticLens: 'tir' | 'linear';
}

export interface LightElement {
  id: string;
  name: string;
  type: ElementType;
  xNorm: number; // 0.0 to 1.0 along the bar length
  yNorm: number; // -0.3 to 0.3 vertical offset
  subglassColor: string | null; // e.g. #ff0000 or null for clear bulb
  brightness: number; // 0.2 to 2.5 multiplier
  wear: {
    fadeWear: number;       // 0 to 1 (thermal coating loss/electrode deposit)
    reflectorTarnish: number; // 0 to 1
    jitter: number;         // 0 to 0.1 (analog circuit/motor drift)
  };
  syncGroup: SyncGroup;
  enabled: boolean;
  
  // Type specific configurations
  rotator?: RotatorConfig;
  halogen?: HalogenFlasherConfig;
  strobe?: XenonStrobeConfig;
  led?: LedConfig;
}

export interface LightbarConfig {
  id: string;
  name: string;
  era: string;
  description: string;
  structure: {
    type: BaseStructureType;
    widthMm: number; // Physical length e.g. 1200mm
    heightMm: number; // Height e.g. 160mm
    frameFinish: 'chrome' | 'black_powder' | 'brushed_aluminum';
    speakerCenter: 'vintage_mesh' | 'slit_plate' | 'none';
    mountingFeet: 'chrome_gutter' | 'low_profile_strap' | 'heavy_duty';
  };
  domes: DomeSection[];
  elements: LightElement[];
}

export interface SequencerState {
  bpm: number;
  rotatorSpeedMultiplier: number;
  activePatternId: string;
  customStepsA: boolean[];
  customStepsB: boolean[];
  customStepsC: boolean[];
}

export type ViewAngle = 'front' | 'angled_iso' | 'top_down';
export type EnvironmentAtmosphere = 'night_street' | 'foggy_atmosphere' | 'inspection_studio' | 'blackout_lab';

export interface RenderSettings {
  enableHalos: boolean; // Halos on by default (disableable)
  enableLensFlares: boolean; // Lens flare components opt-in (default false)
  coronaIntensity: number; // Halos / coronas intensity
  bloomRadius: number;
  refractionStrength: number;
  lensDirt: boolean;
  atmosphere: EnvironmentAtmosphere;
  viewAngle: ViewAngle;
  roofReflection: boolean;
  showBeamsInAir: boolean;
  audioEnabled: boolean;
  audioVolume: number;
}
