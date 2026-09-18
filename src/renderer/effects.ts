import { LightbarConfig, RenderSettings } from '../types';
import { hexToRgb, kelvinToRgb } from '../utils/colorUtils';
import { renderSourceMicroCore } from './emitters';
import { ActiveFlare } from './types';

export function renderSourceSpecificHalo(
  ctx: CanvasRenderingContext2D,
  flare: ActiveFlare,
  settings: RenderSettings,
  width: number,
  _height: number
) {
  const { x, y, intensity, element, domeCloudiness, domeScratches, flutingDensity, flutingStyle } = flare;
  if (intensity < 0.035) return;

  const directClarity = Math.max(0.02, 1.0 - domeCloudiness * 1.75 - domeScratches * 0.7);
  if (directClarity <= 0.02) return;

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

    const spreadRatio = spreadDeg / 24;
    scaleX /= Math.sqrt(spreadRatio);
    scaleY *= Math.sqrt(spreadRatio);

    if (flare.rotationAngle !== undefined) {
      tiltAngle = Math.sin(flare.rotationAngle) * 0.16;
    }
    offsetX = (flare.sweepOffset || 0) * 0.4;

    const wattageFactor = Math.sqrt(wattage / 55);
    const finishFactor = finish === 'chrome' ? 1.18 : finish === 'polished_aluminum' ? 1.05 : 0.88;
    const wearFactor = 1.0 - (element.wear.fadeWear * 0.22 + element.wear.reflectorTarnish * 0.20);
    sourceBrightnessMult = wattageFactor * finishFactor * wearFactor * (element.brightness || 1.0) * 1.15;
    baseRadius = 58 * settings.bloomRadius * Math.min(1.4, 0.8 + intensity * 0.5);

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

    if (bulbShape === 'h1' || bulbShape === 'h3') {
      scaleX = 0.92;
      scaleY = 1.18;
    } else {
      scaleX = 1.06;
      scaleY = 1.02;
    }

    const wattageFactor = Math.sqrt(wattage / 55);
    const wearFactor = 1.0 - element.wear.fadeWear * 0.25;
    sourceBrightnessMult = wattageFactor * wearFactor * (element.brightness || 1.0) * 1.05;
    baseRadius = 50 * settings.bloomRadius * (0.85 + intensity * 0.45);

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

    scaleX = 1.78;
    scaleY = 0.74;

    const joulesFactor = Math.sqrt(joules / 10);
    sourceBrightnessMult = joulesFactor * (element.brightness || 1.0) * 1.38;
    baseRadius = 62 * settings.bloomRadius * (0.8 + intensity * 0.55);

    coreColor = `rgba(242, 248, 255, 1.0)`;

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

    if (optic === 'linear') {
      scaleX = 1.90 + Math.min(0.4, (diodeCount - 4) * 0.04);
      scaleY = 0.70;
    } else {
      scaleX = 1.04;
      scaleY = 1.02;
    }

    const diodeFactor = Math.min(1.4, 0.85 + diodeCount * 0.06);
    sourceBrightnessMult = diodeFactor * (element.brightness || 1.0) * 1.25;
    baseRadius = 48 * settings.bloomRadius * (0.8 + intensity * 0.5);

    const chipRgb = subglassRgb || domeRgb;
    const chipCoreR = Math.min(255, Math.round(chipRgb.r * 0.4 + 255 * 0.6));
    const chipCoreG = Math.min(255, Math.round(chipRgb.g * 0.4 + 255 * 0.6));
    const chipCoreB = Math.min(255, Math.round(chipRgb.b * 0.4 + 255 * 0.6));
    coreColor = `rgba(${chipCoreR}, ${chipCoreG}, ${chipCoreB}, 0.98)`;

    innerColor = `rgba(${chipRgb.r}, ${chipRgb.g}, ${chipRgb.b}, 0.78)`;
    midColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.30)`;
    outerColor = `rgba(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b}, 0.04)`;
  }

  if (flutingStyle === 'vertical_ribs' && flutingDensity > 0) {
    const flutingStretch = 1.0 + Math.min(0.55, flutingDensity / 45);
    scaleX *= flutingStretch;
  } else if (flutingStyle === 'diamond_optic') {
    scaleX *= 1.12;
    scaleY *= 1.08;
  }

  const cloudDiffusion = 1.0 + domeCloudiness * 0.55;
  const effectiveRadius = baseRadius * cloudDiffusion;

  const flarePower = Math.min(
    1.0,
    Math.pow(directClarity, 1.3) * intensity * sourceBrightnessMult * settings.coronaIntensity
  );
  if (flarePower <= 0.01) return;

  // 1. Soft atmospheric light wrap around the emitter
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
    renderSourceMicroCore(ctx, flare, x + offsetX, y + offsetY, directClarity, flarePower);
  }

  // Integrated Horizontal Anamorphic Flare Streak
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

  // Optical Starburst Glare Spikes
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

export function renderHalosAndCoronas(
  ctx: CanvasRenderingContext2D,
  _config: LightbarConfig,
  flares: Array<ActiveFlare>,
  settings: RenderSettings,
  _barX: number,
  _barY: number,
  _barW: number,
  _barH: number,
  width: number,
  height: number
) {
  if (flares.length === 0 || settings.coronaIntensity <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  flares.forEach((flare) => {
    renderSourceSpecificHalo(ctx, flare, settings, width, height);
  });

  ctx.restore();
}

export function renderVolumetricBeams(
  ctx: CanvasRenderingContext2D,
  flares: Array<ActiveFlare>,
  _barX: number,
  _barY: number,
  _barW: number,
  _barH: number,
  _canvasH: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  flares.forEach((flare) => {
    if (flare.intensity < 0.2) return;
    const { x, y, intensity, element, domeCloudiness, domeColor } = flare;

    const beamClarity = Math.max(0, 1.0 - (domeCloudiness || 0) * 1.5);
    if (beamClarity <= 0.05) return;

    const domeRgb = hexToRgb(domeColor);
    const beamRgb = `rgb(${domeRgb.r}, ${domeRgb.g}, ${domeRgb.b})`;

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

export function renderLensDirt(
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
