import { LightbarConfig, RenderSettings } from '../types';
import { ActiveFlare } from './types';

export function renderAtmosphereBackground(
  ctx: CanvasRenderingContext2D,
  settings: RenderSettings,
  width: number,
  height: number,
  timeSec: number
) {
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

export function renderVehicleMountings(
  ctx: CanvasRenderingContext2D,
  config: LightbarConfig,
  barX: number,
  barY: number,
  barW: number,
  barH: number
) {
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
    const cx = barX + barW / 2;
    if (footStyle === 'pedestal_skirt') {
      const skirtTopW = barW * 0.94;
      const skirtBtmW = barW * 1.22;

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
      ctx.fillStyle = '#374151';
      ctx.fillRect(cx - 18, barY + barH, 36, roofY - (barY + barH));
      ctx.fillStyle = '#09090b';
      ctx.fillRect(cx - 30, roofY - 2, 60, 8);
    }
  } else {
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

      ctx.beginPath();
      ctx.roundRect(fx - 14, barY + barH, 28, footH, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0f1115';
      ctx.fillRect(fx - footW / 2, roofY - 2, footW, 10);

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

export function renderRoofLightPool(
  ctx: CanvasRenderingContext2D,
  flares: ActiveFlare[],
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
