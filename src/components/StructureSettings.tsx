import React from 'react';
import { Box, Wrench, Eye, Sun, Sparkles, Sliders } from 'lucide-react';
import { BaseStructureType, LightbarConfig, RenderSettings } from '../types';

interface StructureSettingsProps {
  config: LightbarConfig;
  onUpdateStructure: (structure: LightbarConfig['structure']) => void;
  renderSettings: RenderSettings;
  onUpdateRenderSettings: (settings: Partial<RenderSettings>) => void;
}

export const StructureSettings: React.FC<StructureSettingsProps> = ({
  config,
  onUpdateStructure,
  renderSettings,
  onUpdateRenderSettings,
}) => {
  const structure = config.structure;

  const handleStructureChange = (updated: Partial<LightbarConfig['structure']>) => {
    onUpdateStructure({ ...structure, ...updated });
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/80">
        <Box className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-zinc-100">
          Base Structure & Optical Post-Processing
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Physical Chassis & Mounting */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-3">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-zinc-400" />
            Physical Chassis & Mounting
          </span>

          {/* Base Structure Type */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 block">Base Structure Type:</label>
            <select
              id="structure-type-select"
              value={structure.type}
              onChange={(e) =>
                handleStructureChange({ type: e.target.value as BaseStructureType })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="rotary_domes">Rotary Lightbar with Domes (Vintage Twin)</option>
              <option value="rigid_bar">Rigid Metal Extrusion Bar (Modular Pods)</option>
              <option value="aero_modular">Aerodynamic Continuous Contoured Housing</option>
              <option value="v_bar">Forward-Swept V-Shape Bar (Vector Spec)</option>
            </select>
          </div>

          {/* Frame Finish & Speaker Center */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-400 block mb-1">Frame Tray Finish</span>
              <select
                value={structure.frameFinish}
                onChange={(e) => handleStructureChange({ frameFinish: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 cursor-pointer"
              >
                <option value="chrome">Polished Chrome</option>
                <option value="black_powder">Black Powder-Coat</option>
                <option value="brushed_aluminum">Brushed Aluminum</option>
              </select>
            </div>
            <div>
              <span className="text-zinc-400 block mb-1">Center Siren Speaker</span>
              <select
                value={structure.speakerCenter}
                onChange={(e) => handleStructureChange({ speakerCenter: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 cursor-pointer"
              >
                <option value="vintage_mesh">Perforated Mesh</option>
                <option value="slit_plate">Slotted Louver</option>
                <option value="none">None (Full Lens)</option>
              </select>
            </div>
          </div>

          {/* Mounting Feet */}
          <div className="text-xs">
            <span className="text-zinc-400 block mb-1">Vehicle Roof Mountings</span>
            <select
              value={structure.mountingFeet}
              onChange={(e) => handleStructureChange({ mountingFeet: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 cursor-pointer"
            >
              <option value="chrome_gutter">Vintage Chrome Gutter Clamps</option>
              <option value="low_profile_strap">Low-Profile Roof Straps</option>
              <option value="heavy_duty">Heavy-Duty Apparatus Feet</option>
            </select>
          </div>
        </div>

        {/* Right Column: Optical Bloom, Coronas & Refraction Sliders */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-3">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Rasterized Optics & Corona Engine
          </span>

          {/* Corona Intensity */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Halos & Coronas Intensity</span>
              <span className="font-mono text-amber-400 font-bold">
                {renderSettings.coronaIntensity.toFixed(1)}x
              </span>
            </div>
            <input
              id="corona-intensity-slider"
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={renderSettings.coronaIntensity}
              onChange={(e) =>
                onUpdateRenderSettings({ coronaIntensity: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Bloom Radius */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Atmospheric Bloom Scattering</span>
              <span className="font-mono text-zinc-300">
                {renderSettings.bloomRadius.toFixed(1)}x
              </span>
            </div>
            <input
              id="bloom-radius-slider"
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              value={renderSettings.bloomRadius}
              onChange={(e) =>
                onUpdateRenderSettings({ bloomRadius: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
            />
          </div>

          {/* Refraction Strength */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Glass Refraction Flare Strength</span>
              <span className="font-mono text-cyan-400 font-bold">
                {renderSettings.refractionStrength.toFixed(1)}x
              </span>
            </div>
            <input
              id="refraction-strength-slider"
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={renderSettings.refractionStrength}
              onChange={(e) =>
                onUpdateRenderSettings({ refractionStrength: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-zinc-800 space-y-2 text-xs text-zinc-300">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-zinc-200">Enable Halos & Coronas</span>
              <input
                id="toggle-halos-checkbox"
                type="checkbox"
                checked={renderSettings.enableHalos !== false}
                onChange={(e) => onUpdateRenderSettings({ enableHalos: e.target.checked })}
                className="rounded border-zinc-700 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-zinc-200">Opt-in Lens Flare Effects</div>
                <div className="text-[11px] text-zinc-500">Includes upward shine, underlight, streaks & spikes</div>
              </div>
              <input
                id="toggle-lens-flares-checkbox"
                type="checkbox"
                checked={Boolean(renderSettings.enableLensFlares)}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onUpdateRenderSettings({
                    enableLensFlares: enabled,
                    lensDirt: enabled,
                    showBeamsInAir: enabled,
                    roofReflection: enabled,
                  });
                }}
                className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
              />
            </label>
            {renderSettings.enableLensFlares && (
              <div className="pl-3 border-l-2 border-cyan-500/30 space-y-2 pt-1 text-xs">
                <label className="flex items-center justify-between cursor-pointer text-zinc-300">
                  <span>Upward Shine (Fog Beams)</span>
                  <input
                    id="toggle-beams-in-air-checkbox"
                    type="checkbox"
                    checked={renderSettings.showBeamsInAir}
                    onChange={(e) => onUpdateRenderSettings({ showBeamsInAir: e.target.checked })}
                    className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer text-zinc-300">
                  <span>Underlight (Roof Reflection Pool)</span>
                  <input
                    id="toggle-roof-reflection-checkbox"
                    type="checkbox"
                    checked={renderSettings.roofReflection}
                    onChange={(e) => onUpdateRenderSettings({ roofReflection: e.target.checked })}
                    className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer text-zinc-400">
                  <span>Camera Lens Dust / Particles</span>
                  <input
                    id="toggle-lens-dirt-checkbox"
                    type="checkbox"
                    checked={renderSettings.lensDirt}
                    onChange={(e) => onUpdateRenderSettings({ lensDirt: e.target.checked })}
                    className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
