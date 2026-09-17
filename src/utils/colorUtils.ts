/**
 * Color and Optics Utility Functions
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

/**
 * Approximate color temperature (Kelvin) to RGB
 */
export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  // Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

/**
 * Multiplicative optical filter combination:
 * Light passes through element subglass, then through the outer dome glass.
 */
export function blendGlassColor(
  sourceColor: { r: number; g: number; b: number },
  subglassHex: string | null,
  domeHex: string,
  domeOpacity: number,
  domeCloudiness: number
): { r: number; g: number; b: number; coreRgb: string; glowRgb: string } {
  let r = sourceColor.r / 255;
  let g = sourceColor.g / 255;
  let b = sourceColor.b / 255;

  // Apply subglass color filter if present
  if (subglassHex) {
    const sub = hexToRgb(subglassHex);
    r *= (sub.r / 255);
    g *= (sub.g / 255);
    b *= (sub.b / 255);
  }

  // Apply dome glass color filter
  const dome = hexToRgb(domeHex);
  const dr = dome.r / 255;
  const dg = dome.g / 255;
  const db = dome.b / 255;

  // Blend with dome glass transmission
  const finalR = r * dr * 255;
  const finalG = g * dg * 255;
  const finalB = b * db * 255;

  // When cloudiness is high, diffuse scatter takes on more of the dome's pigment
  const scatterR = Math.round(finalR * (1 - domeCloudiness * 0.5) + dome.r * (domeCloudiness * 0.5));
  const scatterG = Math.round(finalG * (1 - domeCloudiness * 0.5) + dome.g * (domeCloudiness * 0.5));
  const scatterB = Math.round(finalB * (1 - domeCloudiness * 0.5) + dome.b * (domeCloudiness * 0.5));

  // Hot core is brighter and slightly de-saturated towards white
  const desat = 0.45;
  const coreR = Math.round(Math.min(255, finalR + (255 - finalR) * desat));
  const coreG = Math.round(Math.min(255, finalG + (255 - finalG) * desat));
  const coreB = Math.round(Math.min(255, finalB + (255 - finalB) * desat));

  return {
    r: Math.round(finalR),
    g: Math.round(finalG),
    b: Math.round(finalB),
    coreRgb: `rgb(${coreR}, ${coreG}, ${coreB})`,
    glowRgb: `rgb(${scatterR}, ${scatterG}, ${scatterB})`
  };
}
