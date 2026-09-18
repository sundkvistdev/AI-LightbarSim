import { LightbarConfig } from '../types';

export function renderHousingFrame(
  ctx: CanvasRenderingContext2D,
  config: LightbarConfig,
  barX: number,
  barY: number,
  barW: number,
  barH: number
) {
  ctx.save();

  const finish = config.structure.frameFinish;
  const sType = config.structure.type;

  // Helper metallic linear gradient
  const createMetalGrad = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    if (finish === 'chrome' || finish === 'stainless_tubular') {
      g.addColorStop(0, '#4b5563');
      g.addColorStop(0.2, '#f3f4f6');
      g.addColorStop(0.5, '#e5e7eb');
      g.addColorStop(0.8, '#9ca3af');
      g.addColorStop(1, '#374151');
    } else if (finish === 'brushed_aluminum') {
      g.addColorStop(0, '#6b7280');
      g.addColorStop(0.3, '#9ca3af');
      g.addColorStop(0.7, '#4b5563');
      g.addColorStop(1, '#374151');
    } else {
      // Black powder-coat
      g.addColorStop(0, '#27272a');
      g.addColorStop(0.5, '#18181b');
      g.addColorStop(1, '#09090b');
    }
    return g;
  };

  if (sType === 'cylindrical_beacon') {
    // Cylindrical Beacon: Chrome tension split-clamp ring around base of dome & central motor gearbox hub
    const trayH = 18;
    const trayY = barY + barH - 4;
    const cx = barX + barW / 2;

    // Chrome split-ring dome retaining band
    const bandGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    bandGrad.addColorStop(0, '#4b5563');
    bandGrad.addColorStop(0.2, '#f3f4f6');
    bandGrad.addColorStop(0.5, '#ffffff');
    bandGrad.addColorStop(0.7, '#d1d5db');
    bandGrad.addColorStop(1, '#374151');

    ctx.fillStyle = bandGrad;
    ctx.beginPath();
    ctx.roundRect(barX - 4, trayY, barW + 8, trayH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Split-ring tension tightening latch & bolt on right side
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(barX + barW - 6, trayY + 2, 8, trayH - 4);
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.arc(barX + barW - 2, trayY + trayH / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner motor gearbox turntable & center vertical spindle shaft
    ctx.fillStyle = '#111317';
    ctx.beginPath();
    ctx.roundRect(barX + 6, barY + barH * 0.76, barW - 12, barH * 0.22, 4);
    ctx.fill();

    // Brass drive gear teeth & chrome drive spindle
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx - 18, barY + barH * 0.82, 36, 6);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cx - 6, barY + barH * 0.38, 12, barH * 0.46);
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(cx - 6, barY + barH * 0.38, 12, barH * 0.46);

  } else if (sType === 'teardrop_beacon') {
    // Aerodynamic Teardrop Base Tray & Reflector Cavity
    const trayH = 16;
    const trayY = barY + barH - 2;
    const cx = barX + barW / 2;

    ctx.fillStyle = createMetalGrad(barX, trayY, barX + barW, trayY + trayH);
    ctx.beginPath();
    ctx.roundRect(barX - 4, trayY, barW + 8, trayH, [3, 8, 8, 3]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.stroke();

    // Inner drive motor
    ctx.fillStyle = '#111317';
    ctx.fillRect(cx - 16, barY + barH * 0.74, 32, barH * 0.22);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 4, barY + barH * 0.45, 8, barH * 0.32);

  } else if (sType === 'v_bar') {
    // Forward-Swept 7-Pod Chevron Truss Frame
    const podCount = config.structure.podCount || 7;
    const podW = barW / podCount;
    const vAngleFactor = (config.structure.vAngleDeg || 24) / 24;

    // Heavy-duty chevron wiring raceway spine spanning behind pods
    ctx.fillStyle = '#111317';
    ctx.beginPath();
    for (let i = 0; i < podCount; i++) {
      const podNormX = (i + 0.5) / podCount;
      const vY = (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor;
      const px = barX + i * podW;
      if (i === 0) ctx.moveTo(px, barY + barH * 0.85 + vY);
      else ctx.lineTo(px + podW / 2, barY + barH * 0.85 + vY);
    }
    ctx.lineTo(barX + barW, barY + barH * 0.95);
    ctx.lineTo(barX + barW, barY + barH + 16);
    ctx.lineTo(barX, barY + barH + 16);
    ctx.closePath();
    ctx.fill();

    // Pod base trays with forward-swept chevron angles
    for (let i = 0; i < podCount; i++) {
      const podNormX = (i + 0.5) / podCount;
      const vY = (1 - 2 * Math.abs(podNormX - 0.5)) * barH * 0.32 * vAngleFactor;
      const px = barX + i * podW;

      // Pod tray
      ctx.fillStyle = createMetalGrad(px, barY + barH + vY, px + podW, barY + barH + 14 + vY);
      ctx.beginPath();
      ctx.roundRect(px + 1, barY + barH + vY - 2, podW - 2, 14, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner back wall of each pod
      ctx.fillStyle = '#18181b';
      ctx.fillRect(px + 2, barY + vY + 2, podW - 4, barH - 4);
    }

  } else if (sType === 'dual_beacon_bridge') {
    // Twin Polished Stainless Steel Tubular Rails & Center Federal Q2B Mechanical Siren
    const railH = 11;
    const topRailY = barY + barH * 0.78;
    const btmRailY = barY + barH + 10;

    // Twin Stainless Tubular Crossbars
    [topRailY, btmRailY].forEach((ry) => {
      const railGrad = ctx.createLinearGradient(0, ry, 0, ry + railH);
      railGrad.addColorStop(0, '#374151');
      railGrad.addColorStop(0.25, '#f3f4f6');
      railGrad.addColorStop(0.5, '#ffffff');
      railGrad.addColorStop(0.75, '#9ca3af');
      railGrad.addColorStop(1, '#1f2937');

      ctx.fillStyle = railGrad;
      ctx.beginPath();
      ctx.roundRect(barX - 16, ry, barW + 32, railH, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tube chrome endcaps with dome nuts
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(barX - 16, ry + railH / 2, 4, 0, Math.PI * 2);
      ctx.arc(barX + barW + 16, ry + railH / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Elevated chrome beacon turret bases positioned dynamically under each dome
    config.domes.forEach((dome) => {
      const domeX = barX + dome.startX * barW;
      const domeW = (dome.endX - dome.startX) * barW;
      const tx = domeX + domeW / 2;
      const turretW = Math.max(domeW * 1.06, 50);

      const tGrad = ctx.createLinearGradient(tx - turretW / 2, 0, tx + turretW / 2, 0);
      tGrad.addColorStop(0, '#4b5563');
      tGrad.addColorStop(0.3, '#ffffff');
      tGrad.addColorStop(0.7, '#d1d5db');
      tGrad.addColorStop(1, '#374151');

      // Circular stepped turret platform
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.roundRect(tx - turretW / 2, barY + barH - 4, turretW, 16, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Inner turret turntable
      ctx.fillStyle = '#111317';
      ctx.fillRect(tx - turretW / 2 + 4, barY + barH * 0.78, turretW - 8, barH * 0.2);
    });

    // Center Iconic Federal Q2B Mechanical Siren!
    if (config.structure.speakerCenter === 'mechanical_siren') {
      const sirenCx = barX + barW / 2;
      const sirenCy = barY + barH * 0.58;
      const sirenRadius = Math.min(46, barH * 0.44);

      // Heavy-duty chrome cradle bracket clamping to both tubular rails
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(sirenCx - 14, topRailY - 4, 28, btmRailY - topRailY + railH + 6);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(sirenCx - 14, topRailY - 4, 28, btmRailY - topRailY + railH + 6);

      // Flared chrome siren acoustic horn bell housing
      const bellGrad = ctx.createRadialGradient(
        sirenCx - sirenRadius * 0.3,
        sirenCy - sirenRadius * 0.3,
        4,
        sirenCx,
        sirenCy,
        sirenRadius
      );
      bellGrad.addColorStop(0, '#ffffff');
      bellGrad.addColorStop(0.4, '#e5e7eb');
      bellGrad.addColorStop(0.75, '#9ca3af');
      bellGrad.addColorStop(1, '#374151');

      ctx.fillStyle = bellGrad;
      ctx.beginPath();
      ctx.arc(sirenCx, sirenCy, sirenRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flared outer chrome rim lip
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sirenCx, sirenCy, sirenRadius - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Dark siren intake throat chamber
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.arc(sirenCx, sirenCy, sirenRadius * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // Spinning mechanical siren rotor blades / stator ports
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(sirenCx + Math.cos(a) * (sirenRadius * 0.32), sirenCy + Math.sin(a) * (sirenRadius * 0.32));
        ctx.lineTo(sirenCx + Math.cos(a) * (sirenRadius * 0.70), sirenCy + Math.sin(a) * (sirenRadius * 0.70));
        ctx.stroke();
      }

      // Center aerodynamic chrome bullet nose cone
      const coneRadius = sirenRadius * 0.34;
      const coneGrad = ctx.createRadialGradient(
        sirenCx - coneRadius * 0.3,
        sirenCy - coneRadius * 0.3,
        2,
        sirenCx,
        sirenCy,
        coneRadius
      );
      coneGrad.addColorStop(0, '#ffffff');
      coneGrad.addColorStop(0.45, '#d1d5db');
      coneGrad.addColorStop(0.85, '#6b7280');
      coneGrad.addColorStop(1, '#1f2937');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.arc(sirenCx, sirenCy, coneRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Specular chrome glint on nose
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(sirenCx - coneRadius * 0.35, sirenCy - coneRadius * 0.35, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (sType === 'mini_bar') {
    // Compact Mini-Bar Extrusion Frame with Center Diamond Mirror
    const trayH = 15;
    const trayY = barY + barH;

    ctx.fillStyle = createMetalGrad(barX, trayY, barX + barW, trayY + trayH);
    ctx.fillRect(barX - 4, trayY, barW + 8, trayH);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 4, trayY, barW + 8, trayH);

    // Inner backplane
    ctx.fillStyle = '#18181b';
    ctx.fillRect(barX, barY, barW, barH);

    // Center dual-sided 45° diamond mirror reflector to bounce lateral light
    const mirW = barW * 0.12;
    const mirX = barX + (barW - mirW) / 2;
    const mirGrad = ctx.createLinearGradient(mirX, 0, mirX + mirW, 0);
    mirGrad.addColorStop(0, '#374151');
    mirGrad.addColorStop(0.3, '#f3f4f6');
    mirGrad.addColorStop(0.5, '#ffffff');
    mirGrad.addColorStop(0.7, '#d1d5db');
    mirGrad.addColorStop(1, '#4b5563');

    ctx.fillStyle = mirGrad;
    ctx.beginPath();
    ctx.moveTo(mirX + mirW / 2, barY + 4);
    ctx.lineTo(mirX + mirW, barY + barH - 4);
    ctx.lineTo(mirX, barY + barH - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.2;
    ctx.stroke();

  } else {
    // Standard Lightbar Base Extrusion (Rotary Domes, Rigid Bar, Aero Modular)
    const trayH = 16;
    const trayY = barY + barH;

    ctx.fillStyle = createMetalGrad(0, trayY, 0, trayY + trayH);
    ctx.fillRect(barX - 6, trayY, barW + 12, trayH);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 6, trayY, barW + 12, trayH);

    // Inner back wall of housing behind domes (mirrored or matte)
    const backGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    backGrad.addColorStop(0, '#111317');
    backGrad.addColorStop(0.5, '#1c1f26');
    backGrad.addColorStop(1, '#0d0f12');
    ctx.fillStyle = backGrad;
    ctx.fillRect(barX, barY, barW, barH);

    // Center speaker grille if configured
    if (config.structure.speakerCenter !== 'none') {
      const centerDome = config.domes.find(
        (d) => d.id.includes('speaker') || d.id.includes('center') || d.id.includes('mid') || (d.startX <= 0.45 && d.endX >= 0.55)
      );
      if (centerDome) {
        const spkX = barX + centerDome.startX * barW;
        const spkW = (centerDome.endX - centerDome.startX) * barW;

        ctx.fillStyle = '#1e232b';
        ctx.fillRect(spkX, barY + 2, spkW, barH - 4);

        if (config.structure.speakerCenter === 'vintage_mesh') {
          // Perforated stainless steel speaker mesh
          ctx.fillStyle = '#9ca3af';
          ctx.fillRect(spkX + 4, barY + 4, spkW - 8, barH - 8);

          ctx.fillStyle = '#111827';
          const dotSpacing = 7;
          for (let px = spkX + 8; px < spkX + spkW - 8; px += dotSpacing) {
            for (let py = barY + 8; py < barY + barH - 8; py += dotSpacing) {
              ctx.beginPath();
              ctx.arc(px, py, 1.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (config.structure.speakerCenter === 'slit_plate') {
          // Slotted horizontal louvers
          ctx.fillStyle = '#374151';
          const slotH = 4;
          const slotGap = 6;
          for (let py = barY + 8; py < barY + barH - 8; py += slotH + slotGap) {
            ctx.fillRect(spkX + 8, py, spkW - 16, slotH);
          }
        }
      }
    }
  }

  ctx.restore();
}
