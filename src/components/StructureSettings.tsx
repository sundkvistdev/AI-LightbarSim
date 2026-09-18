import React from 'react';
import { Box, Sparkles } from 'lucide-react';
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
    <div className="bg-zinc-950 border border-zinc-800 p-2.5 space-y-2 text-xs font-mono select-none rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-bold text-zinc-200 text-[11px]">
            PHYSICAL CHASSIS & RASTER OPTICS
          </span>
        </div>
        <span className="text-[10px] text-zinc-500">
          {structure.widthMm}mm × {structure.heightMm}mm
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Left Column: Physical Chassis & Mounting */}
        <div className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 block border-b border-zinc-800 pb-1">
            CHASSIS ARCHITECTURE & MOUNTS
          </span>

          {/* Base Structure Type */}
          <div className="space-y-0.5">
            <span className="text-zinc-500 text-[9px]">STRUCTURE PROFILE</span>
            <select
              id="structure-type-select"
              value={structure.type}
              onChange={(e) =>
                handleStructureChange({ type: e.target.value as BaseStructureType })
              }
              className="w-full bg-black border border-zinc-700 px-1.5 py-0.5 text-zinc-200 text-[11px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
            >
              <option value="cylindrical_beacon">Cylindrical Beacon (Model 17 / 184 Ray)</option>
              <option value="teardrop_beacon">Teardrop Pod Beacon (Kojak / Mars 888)</option>
              <option value="v_bar">Forward-Swept V-Bar (Vector / Vision 7-Pod)</option>
              <option value="dual_beacon_bridge">Twin Beacon Bridge with Center Siren</option>
              <option value="mini_bar">Compact Utility Mini-Bar (Tow / Escort)</option>
              <option value="rotary_domes">Rotary Lightbar with Domes (Vintage Twin)</option>
              <option value="rigid_bar">Rigid Metal Extrusion Bar (Modular Pods)</option>
              <option value="aero_modular">Aerodynamic Continuous Contoured Housing</option>
            </select>
          </div>

          {/* Width & Height MM */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-400">
                <span>WIDTH (MM)</span>
                <span className="text-zinc-200 font-bold">{structure.widthMm}</span>
              </div>
              <input
                type="range"
                min={300}
                max={2200}
                step={25}
                value={structure.widthMm}
                onChange={(e) =>
                  handleStructureChange({ widthMm: parseInt(e.target.value, 10) })
                }
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-emerald-500 rounded-none"
              />
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-400">
                <span>HEIGHT (MM)</span>
                <span className="text-zinc-200 font-bold">{structure.heightMm}</span>
              </div>
              <input
                type="range"
                min={80}
                max={350}
                step={10}
                value={structure.heightMm}
                onChange={(e) =>
                  handleStructureChange({ heightMm: parseInt(e.target.value, 10) })
                }
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-emerald-500 rounded-none"
              />
            </div>
          </div>

          {/* Frame Finish & Speaker Center */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="space-y-0.5">
              <span className="text-zinc-500 text-[9px]">FRAME FINISH</span>
              <select
                value={structure.frameFinish}
                onChange={(e) => handleStructureChange({ frameFinish: e.target.value as any })}
                className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 font-mono text-[10px] cursor-pointer rounded-none"
              >
                <option value="chrome">Polished Chrome</option>
                <option value="stainless_tubular">Stainless Tubular Rails</option>
                <option value="black_powder">Black Powder-Coat</option>
                <option value="brushed_aluminum">Brushed Aluminum</option>
              </select>
            </div>

            <div className="space-y-0.5">
              <span className="text-zinc-500 text-[9px]">CENTER SPEAKER GRILL</span>
              <select
                value={structure.speakerCenter}
                onChange={(e) => handleStructureChange({ speakerCenter: e.target.value as any })}
                className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 font-mono text-[10px] cursor-pointer rounded-none"
              >
                <option value="vintage_mesh">Perforated Mesh</option>
                <option value="slit_plate">Slotted Louver</option>
                <option value="mechanical_siren">Mechanical Q2B Siren</option>
                <option value="none">None (Full Lens)</option>
              </select>
            </div>
          </div>

          {/* Mounting Feet */}
          <div className="space-y-0.5">
            <span className="text-zinc-500 text-[9px]">ROOF MOUNT FEET</span>
            <select
              value={structure.mountingFeet}
              onChange={(e) => handleStructureChange({ mountingFeet: e.target.value as any })}
              className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 font-mono text-[10px] cursor-pointer rounded-none"
            >
              <option value="pedestal_skirt">Spun Chrome Pedestal Skirt</option>
              <option value="magnetic_mount">Heavy Magnetic Mount Pad</option>
              <option value="chrome_gutter">Vintage Chrome Gutter Clamps</option>
              <option value="low_profile_strap">Low-Profile Roof Straps</option>
              <option value="heavy_duty">Heavy-Duty Apparatus Feet</option>
            </select>
          </div>
        </div>

        {/* Right Column: Optical Bloom, Coronas & Refraction Sliders */}
        <div className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-2">
          <span className="text-[10px] font-bold text-amber-400 block border-b border-zinc-800 pb-1">
            OPTICAL POST-PROCESSING & BLOOM
          </span>

          {/* Corona Intensity */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">CORONA HALOS</span>
              <span className="text-zinc-200 font-bold font-mono">
                {renderSettings.coronaIntensity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={renderSettings.coronaIntensity}
              onChange={(e) =>
                onUpdateRenderSettings({ coronaIntensity: parseFloat(e.target.value) })
              }
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>

          {/* Bloom Radius */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">ATMOSPHERIC BLOOM</span>
              <span className="text-zinc-200 font-bold font-mono">
                {renderSettings.bloomRadius.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              value={renderSettings.bloomRadius}
              onChange={(e) =>
                onUpdateRenderSettings({ bloomRadius: parseFloat(e.target.value) })
              }
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>

          {/* Refraction Strength */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">POLYCARBONATE REFRACTION</span>
              <span className="text-zinc-200 font-bold font-mono">
                {renderSettings.refractionStrength.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={renderSettings.refractionStrength}
              onChange={(e) =>
                onUpdateRenderSettings({ refractionStrength: parseFloat(e.target.value) })
              }
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>

          {/* Toggles */}
          <div className="border-t border-zinc-800 pt-1.5 space-y-1 text-[10px]">
            <label className="flex items-center justify-between cursor-pointer text-zinc-300">
              <span>ENABLE CORONAS</span>
              <input
                type="checkbox"
                checked={renderSettings.enableHalos !== false}
                onChange={(e) => onUpdateRenderSettings({ enableHalos: e.target.checked })}
                className="cursor-pointer accent-amber-500 rounded-none"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-zinc-300">
              <span>UPWARD SHINE (FOG BEAMS)</span>
              <input
                type="checkbox"
                checked={renderSettings.showBeamsInAir}
                onChange={(e) => onUpdateRenderSettings({ showBeamsInAir: e.target.checked })}
                className="cursor-pointer accent-amber-500 rounded-none"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-zinc-300">
              <span>UNDERLIGHT ROOF REFLECTION</span>
              <input
                type="checkbox"
                checked={renderSettings.roofReflection}
                onChange={(e) => onUpdateRenderSettings({ roofReflection: e.target.checked })}
                className="cursor-pointer accent-amber-500 rounded-none"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
