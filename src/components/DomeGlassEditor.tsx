import React, { useState } from 'react';
import { Layers, Droplets, Sparkles, Sliders, ShieldAlert, Palette } from 'lucide-react';
import { DomeSection, FlutingStyle } from '../types';
import opticalProfilesData from '../data/opticalProfiles.json';

interface DomeGlassEditorProps {
  domes: DomeSection[];
  onUpdateDomes: (domes: DomeSection[]) => void;
}

export const DomeGlassEditor: React.FC<DomeGlassEditorProps> = ({ domes, onUpdateDomes }) => {
  const [selectedDomeId, setSelectedDomeId] = useState<string>(domes[0]?.id || '');
  const activeDome = domes.find((d) => d.id === selectedDomeId) || domes[0];

  const handleUpdateActiveDome = (updated: Partial<DomeSection>) => {
    if (!activeDome) return;
    const newDomes = domes.map((d) => (d.id === activeDome.id ? { ...d, ...updated } : d));
    onUpdateDomes(newDomes);
  };

  const handleApplyProfile = (profileId: string) => {
    const profile = opticalProfilesData.profiles.find((p) => p.id === profileId);
    if (!profile || !activeDome) return;

    const wearUpdates =
      profileId === 'weathered_scratched_ruby'
        ? { scratches: 0.78, yellowing: 0.22, dirtHaze: 0.3 }
        : profileId === 'frosted_milky_diffuse'
        ? { scratches: 0.15, yellowing: 0.05, dirtHaze: 0.1 }
        : {};

    handleUpdateActiveDome({
      color: profile.color,
      opacity: profile.opacity,
      cloudiness: profile.cloudiness,
      fluting: {
        style: profile.flutingStyle as FlutingStyle,
        density: profile.flutingDensity,
        intensity: profile.flutingIntensity,
      },
      wear: {
        ...activeDome.wear,
        ...wearUpdates,
      },
    });
  };

  if (!activeDome) return null;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-zinc-100">
            Outer Glass & Dome Optical Refraction
          </h2>
        </div>

        {/* Material Preset quick loader */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Glass Material:</span>
          <select
            id="optical-profile-select"
            onChange={(e) => handleApplyProfile(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>
              Select Material Profile...
            </option>
            {opticalProfilesData.profiles.map((prof) => (
              <option key={prof.id} value={prof.id}>
                {prof.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual Section Partition Selector */}
      <div className="space-y-1.5">
        <span className="text-xs text-zinc-400 font-medium">Dome Partition Sections:</span>
        <div className="flex h-10 w-full rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 p-0.5 gap-1">
          {domes.map((dome) => {
            const isSelected = dome.id === activeDome.id;
            const widthPct = Math.max(15, (dome.endX - dome.startX) * 100);
            return (
              <button
                key={dome.id}
                id={`dome-selector-${dome.id}`}
                onClick={() => setSelectedDomeId(dome.id)}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: dome.color,
                }}
                className={`h-full rounded relative transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-inner ${
                  isSelected
                    ? 'ring-2 ring-white scale-[0.98] z-10'
                    : 'opacity-70 hover:opacity-90'
                }`}
                title={`${dome.name} (${Math.round((dome.endX - dome.startX) * 100)}% span)`}
              >
                <span className="bg-black/60 px-1 py-0.5 rounded backdrop-blur-xs truncate max-w-full">
                  {dome.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Dome Optical Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Color & Cloudiness (Refraction) */}
        <div className="space-y-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-zinc-400" />
              Glass Tint & Transmittance
            </span>
            <div className="flex items-center gap-2">
              <input
                id="dome-color-picker"
                type="color"
                value={activeDome.color}
                onChange={(e) => handleUpdateActiveDome({ color: e.target.value })}
                className="w-5 h-5 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px] text-zinc-300">{activeDome.color}</span>
            </div>
          </div>

          {/* Quick Color Palette Buttons */}
          <div className="flex items-center gap-1.5">
            {[
              { hex: '#ef4444', label: 'Ruby Red' },
              { hex: '#2563eb', label: 'Cobalt Blue' },
              { hex: '#f59e0b', label: 'Amber' },
              { hex: '#10b981', label: 'Green' },
              { hex: '#f8fafc', label: 'Clear' },
              { hex: '#18181b', label: 'Smoked' },
            ].map((swatch) => (
              <button
                key={swatch.hex}
                onClick={() => handleUpdateActiveDome({ color: swatch.hex })}
                style={{ backgroundColor: swatch.hex }}
                className="w-6 h-6 rounded-md border border-zinc-600 hover:scale-110 transition-transform shadow-xs"
                title={swatch.label}
              />
            ))}
          </div>

          {/* Cloudiness / Frosted Refraction Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                Frosted Cloudiness (Refraction)
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {Math.round(activeDome.cloudiness * 100)}%
              </span>
            </div>
            <input
              id="dome-cloudiness-slider"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={activeDome.cloudiness}
              onChange={(e) => handleUpdateActiveDome({ cloudiness: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0% (Crystal Clear)</span>
              <span>50% (Milky)</span>
              <span>100% (Frosted Diffuser)</span>
            </div>
            {(activeDome.cloudiness > 0.3 || activeDome.wear.scratches > 0.3) && (
              <div className="bg-cyan-950/40 border border-cyan-800/50 rounded p-1.5 text-[11px] text-cyan-300 flex items-start gap-1.5 mt-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Internal Refraction Active:</strong> Light transfers into the glass body and scratches, diffusing direct point halos into volumetric dome glow.
                </span>
              </div>
            )}
          </div>

          {/* Base Opacity Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Glass Shell Opacity</span>
              <span className="font-mono text-zinc-300 font-bold">
                {Math.round(activeDome.opacity * 100)}%
              </span>
            </div>
            <input
              id="dome-opacity-slider"
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={activeDome.opacity}
              onChange={(e) => handleUpdateActiveDome({ opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
            />
          </div>
        </div>

        {/* Right Column: Fluting Ribs & Optics */}
        <div className="space-y-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Fresnel Ribs & Fluting Optics
            </span>
            <select
              id="fluting-style-select"
              value={activeDome.fluting.style}
              onChange={(e) =>
                handleUpdateActiveDome({
                  fluting: { ...activeDome.fluting, style: e.target.value as FlutingStyle },
                })
              }
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="vertical_ribs">Vertical Ribs (Classic)</option>
              <option value="fresnel_prism">Fresnel Prisms</option>
              <option value="diamond_optic">Diamond Optics</option>
              <option value="smooth_optic">Smooth Unfluted</option>
            </select>
          </div>

          {/* Fluting Intensity */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Fluting Refraction Intensity</span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.round(activeDome.fluting.intensity * 100)}%
              </span>
            </div>
            <input
              id="fluting-intensity-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={activeDome.fluting.intensity}
              onChange={(e) =>
                handleUpdateActiveDome({
                  fluting: { ...activeDome.fluting, intensity: parseFloat(e.target.value) },
                })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Rib Density */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Rib Density (Grooves / 100px)</span>
              <span className="font-mono text-zinc-300 font-bold">{activeDome.fluting.density}</span>
            </div>
            <input
              id="fluting-density-slider"
              type="range"
              min={5}
              max={50}
              step={1}
              value={activeDome.fluting.density}
              onChange={(e) =>
                handleUpdateActiveDome({
                  fluting: { ...activeDome.fluting, density: parseInt(e.target.value, 10) },
                })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
            />
          </div>

          {/* Wear & Aging Patina */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              Glass Wear & Environmental Aging
            </span>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-400 block mb-1">Scratches: {Math.round(activeDome.wear.scratches * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeDome.wear.scratches}
                  onChange={(e) =>
                    handleUpdateActiveDome({
                      wear: { ...activeDome.wear, scratches: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-400"
                />
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">UV Patina: {Math.round(activeDome.wear.yellowing * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeDome.wear.yellowing}
                  onChange={(e) =>
                    handleUpdateActiveDome({
                      wear: { ...activeDome.wear, yellowing: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-600"
                />
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">Road Dirt: {Math.round(activeDome.wear.dirtHaze * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeDome.wear.dirtHaze}
                  onChange={(e) =>
                    handleUpdateActiveDome({
                      wear: { ...activeDome.wear, dirtHaze: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-stone-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
