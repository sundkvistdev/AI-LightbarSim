import { LightbarConfig, RenderSettings } from '../types';
import { hexToRgb } from '../utils/colorUtils';
import { ActiveFlare, createDeterministicRng, SimulationState, stringToSeed } from './types';

/**
 * Render the Outer Glass / Polycarbonate Covering:
 * Volumetric subsurface light transfer, internal caustic wave ribbons,
 * light-activated glowing scratches, asymmetrical fluting dispersion, and TIR edge lighting.
 */
export function renderGlassCovering(
  ctx: CanvasRenderingContext2D,
  config: LightbarConfig,
  barX: number,
  barY: number,
  barW: number,
  barH: number,
  flares: Array<ActiveFlare>,
  settings: RenderSettings,
  _state: SimulationState
) {
  ctx.save();

  const sType = config.structure.type;
  const vAngleFactor = (config.structure.vAngleDeg || 24) / 24;

  config.domes.forEach((dome) => {
    const domeX = barX + dome.startX * barW;
    const domeW = (dome.endX - dome.startX) * barW;
    if (domeW <= 0) return;

    const podNormX = (dome.startX + dome.endX) / 2;
    const vY = sType === 'v_bar' ? (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor : 0;
    const domeY = barY + vY;

    const rgb = hexToRgb(dome.color);
    const isLeftEnd = dome.startX < 0.05;
    const isRightEnd = dome.endX > 0.95;

    let radii: [number, number, number, number];
    if (sType === 'cylindrical_beacon') {
      const topRadius = domeW * 0.46;
      radii = [topRadius, topRadius, 4, 4];
    } else if (sType === 'teardrop_beacon') {
      radii = [domeW * 0.46, domeW * 0.36, 4, 4];
    } else if (sType === 'dual_beacon_bridge') {
      const topRadius = domeW * 0.44;
      radii = [topRadius, topRadius, 3, 3];
    } else if (sType === 'mini_bar') {
      const cr = 10;
      radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
    } else if (sType === 'rotary_domes') {
      const cr = 14;
      radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
    } else if (sType === 'aero_modular') {
      const cr = 22;
      radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
    } else {
      const cr = 6;
      radii = [isLeftEnd ? cr : 0, isRightEnd ? cr : 0, isRightEnd ? cr * 0.4 : 0, isLeftEnd ? cr * 0.4 : 0];
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      domeX,
      domeY,
      domeW,
      barH,
      radii
    );
    ctx.clip();

    // 1. Base glass substrate gradient
    const domeGrad = ctx.createLinearGradient(0, domeY, 0, domeY + barH);
    domeGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.9, dome.opacity * 0.7)})`);
    domeGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.9, dome.opacity * 0.5)})`);
    domeGrad.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.7)}, ${Math.floor(rgb.g * 0.7)}, ${Math.floor(rgb.b * 0.7)}, ${Math.min(0.95, dome.opacity * 0.85)})`);
    ctx.fillStyle = domeGrad;
    ctx.fillRect(domeX, domeY, domeW, barH);

    // Light Interaction within this dome section
    const domeFlares = flares.filter((f) => f.x >= domeX - 40 && f.x <= domeX + domeW + 40);
    const totalDirectGlow = domeFlares.reduce((sum, f) => sum + f.intensity, 0);
    const totalInternalGlow = domeFlares.reduce((sum, f) => sum + f.internalIntensity, 0);
    const cloud = dome.cloudiness;
    const scratches = dome.wear.scratches;
    const dirt = dome.wear.dirtHaze;
    const yellowing = dome.wear.yellowing;

    // 2. Light Transfer into the Solid Glass Body (Polycarbonate Luminescence)
    const lightTransferCoeff = (0.28 + cloud * 1.45 + scratches * 0.95) * settings.refractionStrength;
    const trappedGlow = (totalInternalGlow * 0.65 + totalDirectGlow * 0.45) * lightTransferCoeff;

    if (trappedGlow > 0.02) {
      // A. Volumetric Chamber Luminescence
      const scatterGrad = ctx.createLinearGradient(0, domeY, 0, domeY + barH);
      const scatterAlpha = Math.min(0.95, trappedGlow * 0.5);
      scatterGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${scatterAlpha * 0.75})`);
      scatterGrad.addColorStop(0.4, `rgba(${Math.min(255, rgb.r + 90)}, ${Math.min(255, rgb.g + 90)}, ${Math.min(255, rgb.b + 90)}, ${scatterAlpha * 0.95})`);
      scatterGrad.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.8)}, ${Math.floor(rgb.g * 0.8)}, ${Math.floor(rgb.b * 0.8)}, ${scatterAlpha * 0.85})`);
      ctx.fillStyle = scatterGrad;
      ctx.fillRect(domeX, domeY, domeW, barH);

      // B. Localized Diffusion Hotspots in the Plastic Shell
      domeFlares.forEach((f) => {
        const hx = f.x + f.sweepOffset * 0.45;
        const hy = f.y;
        const hotspotRadius = (barH * 0.85) * (0.6 + cloud * 1.35 + scratches * 0.75);

        const hotspotGrad = ctx.createRadialGradient(hx, hy, 2, hx, hy, hotspotRadius);
        const hotspotAlpha = Math.min(0.88, f.internalIntensity * (0.32 + cloud * 0.85 + scratches * 0.55) * settings.refractionStrength);
        hotspotGrad.addColorStop(0, f.coreColor);
        hotspotGrad.addColorStop(0.28, f.glowColor);
        hotspotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = hotspotGrad;
        ctx.globalAlpha = hotspotAlpha;
        ctx.fillRect(domeX, domeY, domeW, barH);
        ctx.restore();
      });
    }

    // 3. Fluting / Fresnel Optics with Asymmetric Dispersion & Light Catching
    if (dome.fluting.intensity > 0.05 && dome.fluting.density > 0) {
      const style = dome.fluting.style || 'vertical_ribs';
      const ribCount = Math.max(3, Math.floor((domeW / 100) * dome.fluting.density));
      const domeCenterX = domeX + domeW / 2;
      const isCylindrical = sType === 'cylindrical_beacon' || sType === 'teardrop_beacon' || sType === 'dual_beacon_bridge';

      if (style === 'fresnel_prism') {
        // Horizontal stepped refraction bands (without artificial surface rings)
        const bandCount = 6;
        const bandH = barH / bandCount;
        for (let b = 0; b < bandCount; b++) {
          const by = domeY + b * bandH;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * dome.fluting.intensity})`;
          ctx.fillRect(domeX, by, domeW, 1.2);
          ctx.fillStyle = `rgba(0, 0, 0, ${0.1 * dome.fluting.intensity})`;
          ctx.fillRect(domeX, by + bandH - 1.2, domeW, 1.2);
        }
      } else if (style === 'diamond_optic') {
        const diagSpacing = Math.max(6, 110 / dome.fluting.density);
        ctx.save();
        ctx.lineWidth = 1;
        for (let d = -barH; d < domeW + barH; d += diagSpacing) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * dome.fluting.intensity})`;
          ctx.beginPath();
          ctx.moveTo(domeX + d, domeY);
          ctx.lineTo(domeX + d + barH, domeY + barH);
          ctx.stroke();

          ctx.strokeStyle = `rgba(0, 0, 0, ${0.12 * dome.fluting.intensity})`;
          ctx.beginPath();
          ctx.moveTo(domeX + d, domeY + barH);
          ctx.lineTo(domeX + d + barH, domeY);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Vertical optical fluting ridges
      for (let i = 0; i < ribCount; i++) {
        let rx: number;
        let ribWidth: number;

        if (isCylindrical) {
          const t0 = -1 + (2 * i) / ribCount;
          const t1 = -1 + (2 * (i + 1)) / ribCount;
          const maxSin = Math.sin(Math.PI * 0.46);
          const p0 = domeCenterX + (Math.sin(t0 * Math.PI * 0.46) / maxSin) * (domeW * 0.5);
          const p1 = domeCenterX + (Math.sin(t1 * Math.PI * 0.46) / maxSin) * (domeW * 0.5);
          rx = Math.min(p0, p1);
          ribWidth = Math.max(1.5, Math.abs(p1 - p0));
        } else {
          ribWidth = domeW / ribCount;
          rx = domeX + i * ribWidth;
        }

        const ribAlpha = 0.14 * dome.fluting.intensity;
        ctx.fillStyle = `rgba(255, 255, 255, ${ribAlpha})`;
        ctx.fillRect(rx, domeY, ribWidth * 0.35, barH);

        ctx.fillStyle = `rgba(0, 0, 0, ${ribAlpha * 1.25})`;
        ctx.fillRect(rx + ribWidth * 0.5, domeY, ribWidth * 0.5, barH);

        domeFlares.forEach((f) => {
          const flareProximityX = f.x + f.sweepOffset * 0.5;
          const dist = Math.abs(flareProximityX - rx);
          if (dist < 140) {
            const catchAlpha =
              Math.pow(1 - dist / 140, 2) *
              f.internalIntensity *
              0.45 *
              dome.fluting.intensity *
              (1.0 + cloud * 0.6) *
              settings.refractionStrength;

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = f.coreColor;
            ctx.globalAlpha = Math.min(0.9, catchAlpha);
            ctx.fillRect(rx, domeY, ribWidth * 0.55, barH);

            if (dist < 70) {
              ctx.fillStyle = f.glowColor;
              ctx.globalAlpha = Math.min(0.65, catchAlpha * 0.7);
              ctx.fillRect(rx + ribWidth * 0.4, domeY, ribWidth * 0.4, barH);
            }
            ctx.restore();
          }
        });
      }
    }

    // 4. Luminous Glowing Scratches
    if (scratches > 0.02) {
      const domeSeed = stringToSeed(dome.id + '_scratches');
      const rng = createDeterministicRng(domeSeed);
      const scratchCount = Math.floor(12 + scratches * 32);

      for (let s = 0; s < scratchCount; s++) {
        const sx = domeX + rng() * domeW;
        const sy = domeY + rng() * barH;
        const length = 10 + rng() * 28;
        const angle = (rng() - 0.5) * Math.PI * 0.85;
        const isSwirl = rng() > 0.55;
        const ex = sx + Math.cos(angle) * length;
        const ey = sy + Math.sin(angle) * length;

        let scratchLight = 0;
        let nearestFlare: ActiveFlare | null = null;
        for (const f of domeFlares) {
          const hx = f.x + f.sweepOffset * 0.45;
          const dist = Math.hypot(hx - sx, f.y - sy);
          if (dist < 180) {
            const contrib = f.internalIntensity * (1 - dist / 180);
            scratchLight += contrib;
            if (!nearestFlare || contrib > 0.1) nearestFlare = f;
          }
        }

        const baseScratchAlpha = scratches * 0.15;
        const activeScratchGlow = scratchLight * (0.35 + cloud * 0.75) * scratches * 2.4 * settings.refractionStrength;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);

        ctx.strokeStyle = `rgba(255, 255, 255, ${baseScratchAlpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        if (activeScratchGlow > 0.02 && nearestFlare) {
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = nearestFlare.glowColor;
          ctx.lineWidth = 2.4;
          ctx.globalAlpha = Math.min(0.85, activeScratchGlow * 0.65);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.9;
          ctx.globalAlpha = Math.min(0.95, activeScratchGlow * 0.9);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 5. Aging Patina: UV Degradation Patina & Road Dirt Haze
    if (yellowing > 0.03) {
      ctx.fillStyle = `rgba(217, 119, 6, ${yellowing * 0.28})`;
      ctx.fillRect(domeX, domeY, domeW, barH);
    }

    if (dirt > 0.03) {
      const dirtGrad = ctx.createLinearGradient(0, domeY + barH - 26, 0, domeY + barH);
      dirtGrad.addColorStop(0, 'rgba(120, 113, 108, 0)');
      dirtGrad.addColorStop(1, `rgba(87, 83, 78, ${dirt * 0.55})`);
      ctx.fillStyle = dirtGrad;
      ctx.fillRect(domeX, domeY + barH - 26, domeW, 26);
    }

    // 6. Total Internal Reflection (TIR) Glowing Rims
    if (trappedGlow > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const rimAlpha = Math.min(0.85, trappedGlow * 0.45);

      // Top edge glow
      const topRimGrad = ctx.createLinearGradient(0, domeY, 0, domeY + 5);
      topRimGrad.addColorStop(0, `rgba(255, 255, 255, ${rimAlpha * 0.95})`);
      topRimGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rimAlpha * 0.8})`);
      topRimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topRimGrad;
      ctx.fillRect(domeX, domeY, domeW, 5);

      // Bottom edge glow
      const btmRimGrad = ctx.createLinearGradient(0, domeY + barH - 5, 0, domeY + barH);
      btmRimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      btmRimGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rimAlpha * 0.75})`);
      btmRimGrad.addColorStop(1, `rgba(255, 255, 255, ${rimAlpha * 0.85})`);
      ctx.fillStyle = btmRimGrad;
      ctx.fillRect(domeX, domeY + barH - 5, domeW, 5);
      ctx.restore();
    }

    // Top edge glass specular reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(domeX, domeY, domeW, 1.8);

    // Section border gasket seal
    if (sType !== 'dual_beacon_bridge' && sType !== 'cylindrical_beacon' && sType !== 'teardrop_beacon') {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(domeX - 1.5, domeY, 3, barH);
      ctx.fillRect(domeX + domeW - 1.5, domeY, 3, barH);
    }

    ctx.restore();
  });

  // Outer border & acrylic highlight of glass assembly
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = 2;

  if (sType === 'cylindrical_beacon') {
    const topRad = barW * 0.46;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, [topRad, topRad, 4, 4]);
    ctx.stroke();

    const specGrad = ctx.createRadialGradient(barX + barW * 0.38, barY + topRad * 0.4, 2, barX + barW * 0.38, barY + topRad * 0.4, topRad);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    specGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.ellipse(barX + barW * 0.38, barY + topRad * 0.45, topRad * 0.6, topRad * 0.35, -0.2, 0, Math.PI * 2);
    ctx.fill();

  } else if (sType === 'teardrop_beacon') {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, [barW * 0.46, barW * 0.36, 4, 4]);
    ctx.stroke();

    const specGrad = ctx.createRadialGradient(barX + barW * 0.35, barY + barH * 0.2, 2, barX + barW * 0.35, barY + barH * 0.2, barW * 0.4);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.ellipse(barX + barW * 0.35, barY + barH * 0.2, barW * 0.32, barH * 0.18, -0.15, 0, Math.PI * 2);
    ctx.fill();

  } else if (sType === 'dual_beacon_bridge') {
    config.domes.forEach((dome) => {
      const domeX = barX + dome.startX * barW;
      const domeW = (dome.endX - dome.startX) * barW;
      const topRad = domeW * 0.44;
      ctx.beginPath();
      ctx.roundRect(domeX, barY, domeW, barH, [topRad, topRad, 3, 3]);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.ellipse(domeX + domeW * 0.4, barY + topRad * 0.45, topRad * 0.5, topRad * 0.28, -0.15, 0, Math.PI * 2);
      ctx.fill();
    });

  } else if (sType === 'v_bar') {
    config.domes.forEach((dome) => {
      const podNormX = (dome.startX + dome.endX) / 2;
      const vY = (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor;
      const domeX = barX + dome.startX * barW;
      const domeW = (dome.endX - dome.startX) * barW;
      ctx.beginPath();
      ctx.roundRect(domeX, barY + vY, domeW, barH, 4);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(domeX + 2, barY + vY + 2, domeW - 4, 3);
    });

  } else {
    const outerRadius = sType === 'rotary_domes' ? 14 : sType === 'aero_modular' ? 22 : sType === 'mini_bar' ? 10 : 6;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, outerRadius);
    ctx.stroke();

    const specGrad = ctx.createLinearGradient(0, barY, 0, barY + 12);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    specGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.roundRect(barX + 6, barY + 2, barW - 12, 10, [outerRadius * 0.8, outerRadius * 0.8, 0, 0]);
    ctx.fill();
  }

  ctx.restore();
}
