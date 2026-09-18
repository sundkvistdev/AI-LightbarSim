import { LightElement } from '../types';
import { ActiveFlare } from './types';

export function renderRotatorReflector(
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

export function renderStaticHalogenBulb(
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

export function renderXenonStrobeTube(
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

export function renderLedModule(
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

export function renderSourceMicroCore(
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
