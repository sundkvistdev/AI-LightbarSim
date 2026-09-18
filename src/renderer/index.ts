/**
 * Modular Optical Lightbar Simulator Engine
 * Cleanly decomposed into:
 * - simulation.ts (Physical thermal rise/fall, xenon discharge, 16-step clock)
 * - bounds.ts (Precise 2D bounds and element positions)
 * - atmosphere.ts (Photometric atmospheres, vehicle mountings, underlight pools)
 * - housing.ts (Vintage rotaries, aero bars, V-bars, beacons, bridges, chrome finish)
 * - emitters.ts (Parabolic reflectors, xenon quartz tubes, incandescent capsules, TIR LEDs)
 * - glass.ts (Polycarbonate fluting, Fresnel refraction, scratches, aging patina)
 * - effects.ts (Coronas, halos, volumetric beams, lens dirt)
 * - frontRenderer.ts (Dedicated front and angled isometric projection renderer)
 * - overheadRenderer.ts (Specialized overhead 360° sweeping beam optical renderer)
 */

import { LightbarConfig, RenderSettings, SequencerState } from '../types';
import { renderAtmosphereBackground } from './atmosphere';
import { LightbarGeometry } from './bounds';
import { FrontRenderer } from './frontRenderer';
import { OverheadRenderer } from './overheadRenderer';
import { createInitialSimulationState, updateSimulationPhysics } from './simulation';
import { ActiveFlare, RenderCallbacks, SimulationState } from './types';

export {
  createInitialSimulationState,
  updateSimulationPhysics,
  LightbarGeometry,
  FrontRenderer,
  OverheadRenderer,
};
export type { SimulationState, ActiveFlare, RenderCallbacks };

export class LightbarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Failed to acquire 2D Canvas context');
    this.ctx = context;
  }

  /**
   * Static helper for structure bounds
   */
  public static getStructureBounds(config: LightbarConfig, canvasW: number, canvasH: number) {
    return LightbarGeometry.getStructureBounds(config, canvasW, canvasH);
  }

  /**
   * Static helper for element position
   */
  public static getElementPosition(
    elem: any,
    config: LightbarConfig,
    barX: number,
    barY: number,
    barW: number,
    barH: number
  ) {
    return LightbarGeometry.getElementPosition(elem, config, barX, barY, barW, barH);
  }

  /**
   * Main render dispatch
   */
  public render(
    config: LightbarConfig,
    settings: RenderSettings,
    sequencer: SequencerState,
    state: SimulationState,
    onAudioTrigger?: RenderCallbacks
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // 1. Clear with common atmospheric background
    renderAtmosphereBackground(ctx, settings, width, height, state.timeSec);

    // 2. Dispatch to Specialized View Mode Renderers
    if (settings.viewAngle === 'top_down') {
      OverheadRenderer.render(
        ctx,
        config,
        settings,
        sequencer,
        state,
        width,
        height,
        onAudioTrigger
      );
    } else {
      // 'front' or 'angled_iso'
      FrontRenderer.render(
        ctx,
        config,
        settings,
        sequencer,
        state,
        width,
        height,
        onAudioTrigger
      );
    }
  }
}
