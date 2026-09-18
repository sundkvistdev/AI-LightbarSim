import {
  LightbarConfig,
  DomeSection,
  LightElement,
  BaseStructureType,
  ElementType,
  SyncGroup,
  FlutingStyle,
  RotatorConfig,
  HalogenFlasherConfig,
  XenonStrobeConfig,
  LedConfig,
  SequencerState,
  RenderSettings,
} from '../types';

export const SCHEMA_VERSION = '1.0.0';

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedConfig: LightbarConfig | null;
  summary: {
    name: string;
    era: string;
    structureType: string;
    domesCount: number;
    elementsCount: number;
    schemaVersion: string;
  };
}

const VALID_STRUCTURE_TYPES: BaseStructureType[] = [
  'rotary_domes',
  'rigid_bar',
  'aero_modular',
  'v_bar',
  'cylindrical_beacon',
  'teardrop_beacon',
  'mini_bar',
  'dual_beacon_bridge',
];

const VALID_FRAME_FINISHES = ['chrome', 'black_powder', 'brushed_aluminum', 'stainless_tubular'];
const VALID_SPEAKER_CENTERS = ['vintage_mesh', 'slit_plate', 'mechanical_siren', 'none'];
const VALID_MOUNTING_FEET = [
  'chrome_gutter',
  'low_profile_strap',
  'heavy_duty',
  'magnetic_mount',
  'pedestal_skirt',
];
const VALID_ELEMENT_TYPES: ElementType[] = [
  'rotating_halogen',
  'static_halogen',
  'xenon_strobe',
  'modern_led',
];
const VALID_SYNC_GROUPS: SyncGroup[] = ['A', 'B', 'C', 'STEADY', 'INDEPENDENT'];
const VALID_FLUTING_STYLES: FlutingStyle[] = [
  'vertical_ribs',
  'fresnel_prism',
  'diamond_optic',
  'smooth_optic',
];
const VALID_REFLECTOR_TYPES = [
  'parabolic_dish',
  'sealed_beam_par36',
  'par46',
  'dual_sided_mirror',
];
const VALID_REFLECTOR_FINISHES = ['chrome', 'polished_aluminum', 'patina_aged'];
const VALID_BULB_SHAPES = ['h1', 'h3', 'par36'];
const VALID_BURST_PATTERNS = ['single', 'double', 'triple', 'quad'];
const VALID_OPTIC_LENSES = ['tir', 'linear'];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isHexColor(str: unknown): boolean {
  return typeof str === 'string' && HEX_COLOR_REGEX.test(str);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Validates any JSON input strictly against the LightbarConfig specification.
 * Provides granular field errors and an auto-sanitized clean fallback.
 */
export function validateLightbarConfig(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      errors: [{ path: '$', message: 'Input must be a valid non-null JSON object' }],
      warnings: [],
      sanitizedConfig: null,
      summary: {
        name: 'Unknown',
        era: 'Unknown',
        structureType: 'Unknown',
        domesCount: 0,
        elementsCount: 0,
        schemaVersion: SCHEMA_VERSION,
      },
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check Schema Version
  if (obj.schemaVersion && typeof obj.schemaVersion === 'string' && obj.schemaVersion !== SCHEMA_VERSION) {
    warnings.push({
      path: 'schemaVersion',
      message: `Config specifies schema version "${obj.schemaVersion}". System is on "${SCHEMA_VERSION}". Compatible fields will be loaded.`,
    });
  }

  // Name & Metadata
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `custom_${Date.now()}`;
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Custom Lightbar';
  const era = typeof obj.era === 'string' && obj.era.trim() ? obj.era.trim() : '1980s';
  const description =
    typeof obj.description === 'string' ? obj.description.trim() : 'Custom configuration created in editor.';

  if (!obj.name || typeof obj.name !== 'string') {
    warnings.push({ path: 'name', message: 'Missing or non-string "name", using fallback' });
  }

  // Validate Structure
  const rawStruct = (obj.structure && typeof obj.structure === 'object' ? obj.structure : {}) as Record<
    string,
    unknown
  >;

  let structureType: BaseStructureType = 'rotary_domes';
  if (typeof rawStruct.type === 'string' && VALID_STRUCTURE_TYPES.includes(rawStruct.type as BaseStructureType)) {
    structureType = rawStruct.type as BaseStructureType;
  } else {
    errors.push({
      path: 'structure.type',
      message: `Invalid structure type. Must be one of: ${VALID_STRUCTURE_TYPES.join(', ')}`,
      value: rawStruct.type,
    });
  }

  const widthMm = typeof rawStruct.widthMm === 'number' ? clamp(rawStruct.widthMm, 150, 2600) : 1200;
  const heightMm = typeof rawStruct.heightMm === 'number' ? clamp(rawStruct.heightMm, 60, 500) : 160;

  let frameFinish = 'chrome';
  if (typeof rawStruct.frameFinish === 'string' && VALID_FRAME_FINISHES.includes(rawStruct.frameFinish)) {
    frameFinish = rawStruct.frameFinish;
  } else {
    warnings.push({ path: 'structure.frameFinish', message: 'Invalid frameFinish, defaulted to chrome' });
  }

  let speakerCenter = 'none';
  if (typeof rawStruct.speakerCenter === 'string' && VALID_SPEAKER_CENTERS.includes(rawStruct.speakerCenter)) {
    speakerCenter = rawStruct.speakerCenter;
  } else {
    warnings.push({ path: 'structure.speakerCenter', message: 'Invalid speakerCenter, defaulted to none' });
  }

  let mountingFeet = 'chrome_gutter';
  if (typeof rawStruct.mountingFeet === 'string' && VALID_MOUNTING_FEET.includes(rawStruct.mountingFeet)) {
    mountingFeet = rawStruct.mountingFeet;
  } else {
    warnings.push({ path: 'structure.mountingFeet', message: 'Invalid mountingFeet, defaulted to chrome_gutter' });
  }

  // Validate Domes
  const sanitizedDomes: DomeSection[] = [];
  if (!Array.isArray(obj.domes) || obj.domes.length === 0) {
    errors.push({ path: 'domes', message: 'Config must have an array of at least 1 dome section' });
    // Provide a default dome
    sanitizedDomes.push({
      id: 'dome_1',
      name: 'Full Clear Dome',
      startX: 0,
      endX: 1,
      color: '#e2e8f0',
      opacity: 0.85,
      cloudiness: 0.1,
      fluting: { style: 'vertical_ribs', density: 24, intensity: 0.75 },
      wear: { scratches: 0.1, yellowing: 0.05, dirtHaze: 0.05 },
    });
  } else {
    const rawDomesArray = obj.domes as unknown[];
    rawDomesArray.forEach((rawDome, idx) => {
      const p = `domes[${idx}]`;
      if (!rawDome || typeof rawDome !== 'object') {
        errors.push({ path: p, message: 'Dome element must be an object' });
        return;
      }
      const d = rawDome as Record<string, unknown>;
      const domeId = typeof d.id === 'string' && d.id ? d.id : `dome_${idx + 1}`;
      const domeName = typeof d.name === 'string' && d.name ? d.name : `Dome ${idx + 1}`;

      let startX = typeof d.startX === 'number' ? clamp(d.startX, 0, 1) : idx * (1 / rawDomesArray.length);
      let endX = typeof d.endX === 'number' ? clamp(d.endX, 0, 1) : (idx + 1) * (1 / rawDomesArray.length);
      if (startX >= endX) {
        errors.push({
          path: `${p}.startX / endX`,
          message: `startX (${startX}) must be strictly less than endX (${endX})`,
        });
        endX = Math.min(1.0, startX + 0.1);
      }

      let color = '#dc2626';
      if (isHexColor(d.color)) {
        color = d.color as string;
      } else {
        errors.push({
          path: `${p}.color`,
          message: `Invalid hex color "${d.color}". Expected #rrggbb`,
          value: d.color,
        });
      }

      const opacity = typeof d.opacity === 'number' ? clamp(d.opacity, 0.05, 1.0) : 0.85;
      const cloudiness = typeof d.cloudiness === 'number' ? clamp(d.cloudiness, 0, 1.0) : 0.1;

      // Fluting
      const rawFluting = (d.fluting && typeof d.fluting === 'object' ? d.fluting : {}) as Record<string, unknown>;
      let flutingStyle: FlutingStyle = 'vertical_ribs';
      if (
        typeof rawFluting.style === 'string' &&
        VALID_FLUTING_STYLES.includes(rawFluting.style as FlutingStyle)
      ) {
        flutingStyle = rawFluting.style as FlutingStyle;
      }
      const flutingDensity =
        typeof rawFluting.density === 'number' ? clamp(rawFluting.density, 5, 80) : 24;
      const flutingIntensity =
        typeof rawFluting.intensity === 'number' ? clamp(rawFluting.intensity, 0, 1.0) : 0.7;

      // Wear
      const rawWear = (d.wear && typeof d.wear === 'object' ? d.wear : {}) as Record<string, unknown>;
      const scratches = typeof rawWear.scratches === 'number' ? clamp(rawWear.scratches, 0, 1.0) : 0.1;
      const yellowing = typeof rawWear.yellowing === 'number' ? clamp(rawWear.yellowing, 0, 1.0) : 0.05;
      const dirtHaze = typeof rawWear.dirtHaze === 'number' ? clamp(rawWear.dirtHaze, 0, 1.0) : 0.05;

      sanitizedDomes.push({
        id: domeId,
        name: domeName,
        startX,
        endX,
        color,
        opacity,
        cloudiness,
        fluting: { style: flutingStyle, density: flutingDensity, intensity: flutingIntensity },
        wear: { scratches, yellowing, dirtHaze },
      });
    });
  }

  // Validate Elements
  const sanitizedElements: LightElement[] = [];
  if (!Array.isArray(obj.elements) || obj.elements.length === 0) {
    errors.push({ path: 'elements', message: 'Config must have an array of at least 1 light element' });
  } else {
    obj.elements.forEach((rawElem, idx) => {
      const p = `elements[${idx}]`;
      if (!rawElem || typeof rawElem !== 'object') {
        errors.push({ path: p, message: 'Light element must be an object' });
        return;
      }
      const e = rawElem as Record<string, unknown>;
      const elemId = typeof e.id === 'string' && e.id ? e.id : `elem_${idx + 1}`;
      const elemName = typeof e.name === 'string' && e.name ? e.name : `Element ${idx + 1}`;

      let elemType: ElementType = 'rotating_halogen';
      if (typeof e.type === 'string' && VALID_ELEMENT_TYPES.includes(e.type as ElementType)) {
        elemType = e.type as ElementType;
      } else {
        errors.push({
          path: `${p}.type`,
          message: `Invalid element type. Must be one of: ${VALID_ELEMENT_TYPES.join(', ')}`,
          value: e.type,
        });
      }

      const xNorm = typeof e.xNorm === 'number' ? clamp(e.xNorm, 0, 1.0) : 0.5;
      const yNorm = typeof e.yNorm === 'number' ? clamp(e.yNorm, -0.4, 0.4) : 0.0;
      const subglassColor = isHexColor(e.subglassColor) ? (e.subglassColor as string) : null;
      const brightness = typeof e.brightness === 'number' ? clamp(e.brightness, 0.1, 3.0) : 1.4;

      let syncGroup: SyncGroup = 'A';
      if (typeof e.syncGroup === 'string' && VALID_SYNC_GROUPS.includes(e.syncGroup as SyncGroup)) {
        syncGroup = e.syncGroup as SyncGroup;
      }

      const enabled = e.enabled !== false;

      // Element Wear
      const rawWear = (e.wear && typeof e.wear === 'object' ? e.wear : {}) as Record<string, unknown>;
      const fadeWear = typeof rawWear.fadeWear === 'number' ? clamp(rawWear.fadeWear, 0, 1.0) : 0.05;
      const reflectorTarnish =
        typeof rawWear.reflectorTarnish === 'number' ? clamp(rawWear.reflectorTarnish, 0, 1.0) : 0.05;
      const jitter = typeof rawWear.jitter === 'number' ? clamp(rawWear.jitter, 0, 0.1) : 0.01;

      const elementObj: LightElement = {
        id: elemId,
        name: elemName,
        type: elemType,
        xNorm,
        yNorm,
        subglassColor,
        brightness,
        syncGroup,
        enabled,
        wear: { fadeWear, reflectorTarnish, jitter },
      };

      // Type-specific sub-configurations
      if (elemType === 'rotating_halogen') {
        const r = (e.rotator && typeof e.rotator === 'object' ? e.rotator : {}) as Record<string, unknown>;
        const rpm = typeof r.rpm === 'number' ? clamp(r.rpm, 10, 400) : 90;
        const beamSpreadDeg = typeof r.beamSpreadDeg === 'number' ? clamp(r.beamSpreadDeg, 8, 80) : 24;
        const rotationDirection = r.rotationDirection === -1 ? -1 : 1;
        const phaseOffsetDeg = typeof r.phaseOffsetDeg === 'number' ? (r.phaseOffsetDeg % 360 + 360) % 360 : 0;
        const reflectorType =
          typeof r.reflectorType === 'string' && VALID_REFLECTOR_TYPES.includes(r.reflectorType)
            ? (r.reflectorType as RotatorConfig['reflectorType'])
            : 'parabolic_dish';
        const wattage = typeof r.wattage === 'number' ? clamp(r.wattage, 20, 150) : 55;
        const filamentWarmth =
          typeof r.filamentWarmth === 'number' ? clamp(r.filamentWarmth, 2400, 3600) : 3000;
        const reflectorFinish =
          typeof r.reflectorFinish === 'string' && VALID_REFLECTOR_FINISHES.includes(r.reflectorFinish)
            ? (r.reflectorFinish as RotatorConfig['reflectorFinish'])
            : 'chrome';

        elementObj.rotator = {
          rpm,
          beamSpreadDeg,
          rotationDirection,
          phaseOffsetDeg,
          reflectorType,
          wattage,
          filamentWarmth,
          reflectorFinish,
        };
      } else if (elemType === 'static_halogen') {
        const h = (e.halogen && typeof e.halogen === 'object' ? e.halogen : {}) as Record<string, unknown>;
        const filamentThermalRiseMs =
          typeof h.filamentThermalRiseMs === 'number' ? clamp(h.filamentThermalRiseMs, 10, 250) : 60;
        const filamentThermalFallMs =
          typeof h.filamentThermalFallMs === 'number' ? clamp(h.filamentThermalFallMs, 20, 400) : 120;
        const wattage = typeof h.wattage === 'number' ? clamp(h.wattage, 20, 150) : 55;
        const bulbShape =
          typeof h.bulbShape === 'string' && VALID_BULB_SHAPES.includes(h.bulbShape)
            ? (h.bulbShape as HalogenFlasherConfig['bulbShape'])
            : 'h1';

        elementObj.halogen = {
          filamentThermalRiseMs,
          filamentThermalFallMs,
          wattage,
          bulbShape,
        };
      } else if (elemType === 'xenon_strobe') {
        const s = (e.strobe && typeof e.strobe === 'object' ? e.strobe : {}) as Record<string, unknown>;
        const joules = typeof s.joules === 'number' ? clamp(s.joules, 2, 40) : 12;
        const flashDurationMs = typeof s.flashDurationMs === 'number' ? clamp(s.flashDurationMs, 2, 30) : 8;
        const burstPattern =
          typeof s.burstPattern === 'string' && VALID_BURST_PATTERNS.includes(s.burstPattern)
            ? (s.burstPattern as XenonStrobeConfig['burstPattern'])
            : 'double';
        const gasTint = isHexColor(s.gasTint) ? (s.gasTint as string) : '#dbeafe';

        elementObj.strobe = {
          joules,
          flashDurationMs,
          burstPattern,
          gasTint,
        };
      } else if (elemType === 'modern_led') {
        const l = (e.led && typeof e.led === 'object' ? e.led : {}) as Record<string, unknown>;
        const diodeCount = typeof l.diodeCount === 'number' ? clamp(l.diodeCount, 1, 24) : 6;
        const opticLens =
          typeof l.opticLens === 'string' && VALID_OPTIC_LENSES.includes(l.opticLens)
            ? (l.opticLens as LedConfig['opticLens'])
            : 'tir';

        elementObj.led = {
          diodeCount,
          opticLens,
        };
      }

      sanitizedElements.push(elementObj);
    });
  }

  // Construct Final Sanitized Configuration
  const sanitizedConfig: LightbarConfig = {
    id,
    name,
    era,
    description,
    structure: {
      type: structureType,
      widthMm,
      heightMm,
      frameFinish: frameFinish as LightbarConfig['structure']['frameFinish'],
      speakerCenter: speakerCenter as LightbarConfig['structure']['speakerCenter'],
      mountingFeet: mountingFeet as LightbarConfig['structure']['mountingFeet'],
      podCount: typeof rawStruct.podCount === 'number' ? clamp(rawStruct.podCount, 3, 11) : undefined,
      vAngleDeg: typeof rawStruct.vAngleDeg === 'number' ? clamp(rawStruct.vAngleDeg, 5, 45) : undefined,
      beaconShape: typeof rawStruct.beaconShape === 'string' ? (rawStruct.beaconShape as any) : undefined,
    },
    domes: sanitizedDomes,
    elements: sanitizedElements,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedConfig,
    summary: {
      name: sanitizedConfig.name,
      era: sanitizedConfig.era,
      structureType: sanitizedConfig.structure.type,
      domesCount: sanitizedConfig.domes.length,
      elementsCount: sanitizedConfig.elements.length,
      schemaVersion: SCHEMA_VERSION,
    },
  };
}

/**
 * Returns a formal JSON Schema Draft-07 representation for documentation or export.
 */
export function getJsonSchemaDefinition(): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'EmergencyLightbarConfig',
    description: 'Formal schema definition for emergency vehicle lightbar and optical simulator configurations.',
    type: 'object',
    required: ['id', 'name', 'era', 'structure', 'domes', 'elements'],
    properties: {
      schemaVersion: { type: 'string', default: SCHEMA_VERSION },
      id: { type: 'string' },
      name: { type: 'string' },
      era: { type: 'string' },
      description: { type: 'string' },
      structure: {
        type: 'object',
        required: ['type', 'widthMm', 'heightMm', 'frameFinish', 'speakerCenter', 'mountingFeet'],
        properties: {
          type: { type: 'string', enum: VALID_STRUCTURE_TYPES },
          widthMm: { type: 'number', minimum: 150, maximum: 2600 },
          heightMm: { type: 'number', minimum: 60, maximum: 500 },
          frameFinish: { type: 'string', enum: VALID_FRAME_FINISHES },
          speakerCenter: { type: 'string', enum: VALID_SPEAKER_CENTERS },
          mountingFeet: { type: 'string', enum: VALID_MOUNTING_FEET },
          podCount: { type: 'number' },
          vAngleDeg: { type: 'number' },
          beaconShape: { type: 'string' },
        },
      },
      domes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'name', 'startX', 'endX', 'color', 'opacity', 'cloudiness', 'fluting', 'wear'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            startX: { type: 'number', minimum: 0, maximum: 1 },
            endX: { type: 'number', minimum: 0, maximum: 1 },
            color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' },
            opacity: { type: 'number', minimum: 0.05, maximum: 1.0 },
            cloudiness: { type: 'number', minimum: 0, maximum: 1.0 },
            fluting: {
              type: 'object',
              required: ['style', 'density', 'intensity'],
              properties: {
                style: { type: 'string', enum: VALID_FLUTING_STYLES },
                density: { type: 'number', minimum: 5, maximum: 80 },
                intensity: { type: 'number', minimum: 0, maximum: 1.0 },
              },
            },
            wear: {
              type: 'object',
              required: ['scratches', 'yellowing', 'dirtHaze'],
              properties: {
                scratches: { type: 'number', minimum: 0, maximum: 1.0 },
                yellowing: { type: 'number', minimum: 0, maximum: 1.0 },
                dirtHaze: { type: 'number', minimum: 0, maximum: 1.0 },
              },
            },
          },
        },
      },
      elements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'name', 'type', 'xNorm', 'yNorm', 'brightness', 'syncGroup', 'enabled', 'wear'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string', enum: VALID_ELEMENT_TYPES },
            xNorm: { type: 'number', minimum: 0, maximum: 1.0 },
            yNorm: { type: 'number', minimum: -0.4, maximum: 0.4 },
            subglassColor: { type: ['string', 'null'] },
            brightness: { type: 'number', minimum: 0.1, maximum: 3.0 },
            syncGroup: { type: 'string', enum: VALID_SYNC_GROUPS },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
  };
}
