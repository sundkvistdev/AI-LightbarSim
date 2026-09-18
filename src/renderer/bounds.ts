import { LightbarConfig, LightElement } from '../types';
import { StructureBounds } from './types';

export class LightbarGeometry {
  /**
   * Helper to calculate pixel bounding box for any lightbar or beacon structure type
   */
  public static getStructureBounds(
    config: LightbarConfig,
    canvasW: number,
    canvasH: number
  ): StructureBounds {
    const sType = config.structure.type;
    const isBeacon = sType === 'cylindrical_beacon' || sType === 'teardrop_beacon';
    const isMiniBar = sType === 'mini_bar';

    let barW: number;
    let barH: number;

    if (isBeacon) {
      // Beacon: scale proportional to canvas height to preserve iconic tall vertical silhouette
      barH = Math.min(canvasH * 0.52, 275);
      barW = barH * (config.structure.widthMm / Math.max(1, config.structure.heightMm));
    } else if (isMiniBar) {
      // Mini-bar: compact mid-width footprint
      barW = Math.min(canvasW * 0.48, 500);
      barH = barW * (config.structure.heightMm / Math.max(1, config.structure.widthMm));
    } else {
      // Full lightbars, V-bars, and Bridges
      barW = Math.min(canvasW * 0.88, 1000);
      barH = Math.min(canvasH * 0.48, barW * (config.structure.heightMm / Math.max(1, config.structure.widthMm)));
    }

    const barX = (canvasW - barW) / 2;
    const barY = canvasH * 0.43 - barH / 2;
    return { barX, barY, barW, barH };
  }

  /**
   * Calculate precise 2D screen coordinate for an element, accounting for V-bar forward-swept chevron offsets
   */
  public static getElementPosition(
    elem: LightElement,
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barH: number
  ): { x: number; y: number; vYOffset: number } {
    const isVBar = config.structure.type === 'v_bar';
    const vAngleFactor = (config.structure.vAngleDeg || 24) / 24;
    // For V-bars, center pod is swept forward (offset downwards in standard front view projection)
    const vYOffset = isVBar ? (1 - 2 * Math.abs(elem.xNorm - 0.5)) * barH * 0.32 * vAngleFactor : 0;
    const x = barX + elem.xNorm * barW;
    const y = barY + barH * 0.5 + elem.yNorm * barH * 0.5 + vYOffset;
    return { x, y, vYOffset };
  }
}
