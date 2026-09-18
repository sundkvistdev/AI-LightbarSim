/**
 * Backward compatibility facade.
 * The renderer has been decomposed into modular components in `src/renderer/`:
 * - `simulation.ts`: Physics and clock management
 * - `bounds.ts`: Physical geometry calculations
 * - `atmosphere.ts`: Background environments and vehicle mountings
 * - `housing.ts`: Structural framing, endcaps, and grilles
 * - `emitters.ts`: Individual light mechanisms (rotators, strobes, LEDs)
 * - `glass.ts`: Dome refraction, fluting, and aging patina
 * - `effects.ts`: Coronas, halos, volumetric beams, and lens dirt
 * - `frontRenderer.ts`: Front/isometric projection rendering
 * - `overheadRenderer.ts`: Specialized overhead 360° sweeping beam optical renderer
 * - `index.ts`: Unified LightbarRenderer dispatch engine
 */

export * from '../renderer';
export { LightbarRenderer as default } from '../renderer';
