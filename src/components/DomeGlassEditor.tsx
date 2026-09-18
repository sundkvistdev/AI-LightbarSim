import React, { useState } from 'react';
import { Layers, Plus, Copy, Trash2, Palette } from 'lucide-react';
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

  const handleAddDome = () => {
    const newId = `dome_${Date.now()}`;
    const newDome: DomeSection = {
      id: newId,
      name: `Section ${domes.length + 1}`,
      startX: 0.8,
      endX: 1.0,
      color: '#ef4444',
      opacity: 0.85,
      cloudiness: 0.05,
      fluting: {
        style: 'vertical_ribs',
        density: 28,
        intensity: 0.75,
      },
      wear: {
        scratches: 0.05,
        yellowing: 0.02,
        dirtHaze: 0.05,
      },
    };
    onUpdateDomes([...domes, newDome]);
    setSelectedDomeId(newId);
  };

  const handleDuplicateDome = () => {
    if (!activeDome) return;
    const newId = `dome_${Date.now()}`;
    const duplicated: DomeSection = {
      ...JSON.parse(JSON.stringify(activeDome)),
      id: newId,
      name: `${activeDome.name} (Copy)`,
      startX: Math.min(0.9, activeDome.startX + 0.05),
      endX: Math.min(1.0, activeDome.endX + 0.05),
    };
    onUpdateDomes([...domes, duplicated]);
    setSelectedDomeId(newId);
  };

  const handleDeleteDome = () => {
    if (!activeDome || domes.length <= 1) return;
    const next = domes.filter((d) => d.id !== activeDome.id);
    onUpdateDomes(next);
    setSelectedDomeId(next[0].id);
  };

  const handleApplyProfile = (profileId: string) => {
    const profile = opticalProfilesData.profiles.find((p) => p.id === profileId);
    if (!profile || !activeDome) return;

    handleUpdateActiveDome({
      color: profile.color,
      opacity: profile.opacity,
      cloudiness: profile.cloudiness,
      fluting: {
        style: profile.flutingStyle as FlutingStyle,
        density: profile.flutingDensity,
        intensity: profile.flutingIntensity,
      },
    });
  };

  if (!activeDome) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 p-2.5 space-y-2 text-xs font-mono select-none rounded-none">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-bold text-zinc-200 text-[11px]">DOME SECTIONS ({domes.length})</span>
        </div>

        {/* Action buttons: Add / Duplicate / Delete */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddDome}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-bold rounded-none cursor-pointer"
            title="Add new dome partition"
          >
            <Plus className="w-3 h-3" />
            <span>ADD</span>
          </button>
          <button
            onClick={handleDuplicateDome}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-bold rounded-none cursor-pointer"
            title="Duplicate selected dome"
          >
            <Copy className="w-3 h-3" />
            <span>DUP</span>
          </button>
          <button
            onClick={handleDeleteDome}
            disabled={domes.length <= 1}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-700 text-[10px] font-bold disabled:opacity-30 rounded-none cursor-pointer"
            title="Delete selected dome"
          >
            <Trash2 className="w-3 h-3" />
            <span>DEL</span>
          </button>
        </div>
      </div>

      {/* Visual Interactive Dome Strip */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-zinc-400">
          <span>PARTITION STRIP (CLICK TO SELECT):</span>
          <span className="text-zinc-200 font-bold">
            {activeDome.name} [{(activeDome.startX * 100).toFixed(0)}%–{(activeDome.endX * 100).toFixed(0)}%]
          </span>
        </div>
        <div className="relative h-8 w-full border border-zinc-700 bg-black p-0.5">
          {domes.map((dome) => {
            const isSelected = activeDome && dome.id === activeDome.id;
            const leftPct = dome.startX * 100;
            const widthPct = Math.max(3, (dome.endX - dome.startX) * 100);
            return (
              <button
                key={dome.id}
                id={`dome-selector-${dome.id}`}
                onClick={() => setSelectedDomeId(dome.id)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: dome.color,
                }}
                className={`absolute top-0.5 bottom-0.5 transition-all flex items-center justify-center text-[10px] font-bold text-white cursor-pointer rounded-none ${
                  isSelected
                    ? 'ring-2 ring-white z-10 font-black brightness-110'
                    : 'opacity-65 hover:opacity-90'
                }`}
              >
                <span className="bg-black/70 px-1 py-0.2 text-[9px] truncate max-w-full">
                  {dome.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Dome Properties Grid */}
      <div className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-2">
        {/* Name & Material preset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[10px] w-12 shrink-0">NAME:</span>
            <input
              type="text"
              value={activeDome.name}
              onChange={(e) => handleUpdateActiveDome({ name: e.target.value })}
              className="flex-1 bg-black border border-zinc-700 px-1.5 py-0.5 text-zinc-200 text-xs font-mono focus:outline-none focus:border-amber-500 rounded-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[10px] w-16 shrink-0">PRESET:</span>
            <select
              id="optical-profile-select"
              onChange={(e) => handleApplyProfile(e.target.value)}
              className="flex-1 bg-black border border-zinc-700 px-1.5 py-0.5 text-zinc-200 text-[11px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
              defaultValue=""
            >
              <option value="" disabled>Apply Material...</option>
              {opticalProfilesData.profiles.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Physical Boundaries (startX / endX) */}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-1.5">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">START X:</span>
              <span className="text-zinc-200 font-bold font-mono">{(activeDome.startX * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.96}
              step={0.01}
              value={activeDome.startX}
              onChange={(e) => {
                const s = parseFloat(e.target.value);
                const safeEnd = Math.max(s + 0.04, activeDome.endX);
                handleUpdateActiveDome({ startX: s, endX: safeEnd });
              }}
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">END X:</span>
              <span className="text-zinc-200 font-bold font-mono">{(activeDome.endX * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0.04}
              max={1.0}
              step={0.01}
              value={activeDome.endX}
              onChange={(e) => {
                const end = parseFloat(e.target.value);
                const safeStart = Math.min(end - 0.04, activeDome.startX);
                handleUpdateActiveDome({ startX: safeStart, endX: end });
              }}
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>
        </div>

        {/* Color Hex & Swatches */}
        <div className="border-t border-zinc-800 pt-1.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-[10px]">POLYCARBONATE COLOR:</span>
            <div className="flex items-center gap-1.5">
              <input
                id="dome-color-picker"
                type="color"
                value={activeDome.color}
                onChange={(e) => handleUpdateActiveDome({ color: e.target.value })}
                className="w-4 h-4 border border-zinc-700 cursor-pointer bg-transparent rounded-none"
              />
              <input
                type="text"
                value={activeDome.color}
                onChange={(e) => handleUpdateActiveDome({ color: e.target.value })}
                className="w-20 bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500 rounded-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {[
              { hex: '#dc2626', label: 'Red' },
              { hex: '#2563eb', label: 'Blue' },
              { hex: '#f59e0b', label: 'Amber' },
              { hex: '#10b981', label: 'Green' },
              { hex: '#f8fafc', label: 'Clear' },
              { hex: '#18181b', label: 'Smoked' },
            ].map((swatch) => (
              <button
                key={swatch.hex}
                onClick={() => handleUpdateActiveDome({ color: swatch.hex })}
                style={{ backgroundColor: swatch.hex }}
                className="flex-1 h-4 border border-zinc-700 hover:border-white transition-colors cursor-pointer rounded-none"
                title={swatch.label}
              />
            ))}
          </div>
        </div>

        {/* Optical Cloudiness & Transmittance Opacity */}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-1.5">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">DIFFUSION:</span>
              <span className="text-zinc-200 font-bold font-mono">{(activeDome.cloudiness * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={activeDome.cloudiness}
              onChange={(e) => handleUpdateActiveDome({ cloudiness: parseFloat(e.target.value) })}
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">OPACITY:</span>
              <span className="text-zinc-200 font-bold font-mono">{(activeDome.opacity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.02}
              value={activeDome.opacity}
              onChange={(e) => handleUpdateActiveDome({ opacity: parseFloat(e.target.value) })}
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>
        </div>

        {/* Fluting Optic Geometry */}
        <div className="border-t border-zinc-800 pt-1.5 space-y-1.5">
          <span className="text-zinc-400 text-[10px] font-bold">FRESNEL FLUTING:</span>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <span className="text-zinc-500 text-[9px]">STYLE</span>
              <select
                value={activeDome.fluting.style}
                onChange={(e) =>
                  handleUpdateActiveDome({
                    fluting: { ...activeDome.fluting, style: e.target.value as FlutingStyle },
                  })
                }
                className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
              >
                <option value="vertical_ribs">Vertical Ribs</option>
                <option value="fresnel_prism">Fresnel Prism</option>
                <option value="diamond_optic">Diamond Optic</option>
                <option value="smooth_optic">Smooth Optic</option>
              </select>
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>DENSITY</span>
                <span className="text-zinc-300">{activeDome.fluting.density}</span>
              </div>
              <input
                type="range"
                min={8}
                max={60}
                step={2}
                value={activeDome.fluting.density}
                onChange={(e) =>
                  handleUpdateActiveDome({
                    fluting: { ...activeDome.fluting, density: parseInt(e.target.value, 10) },
                  })
                }
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
              />
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>INTENSITY</span>
                <span className="text-zinc-300">{(activeDome.fluting.intensity * 100).toFixed(0)}%</span>
              </div>
              <input
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
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Environmental Wear / UV Aging */}
        <div className="border-t border-zinc-800 pt-1.5 space-y-1">
          <span className="text-zinc-400 text-[10px] font-bold">PHYSICAL WEAR & UV PATINA:</span>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>SCRATCHES</span>
                <span className="text-zinc-300">{(activeDome.wear.scratches * 100).toFixed(0)}%</span>
              </div>
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
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
              />
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>UV YELLOW</span>
                <span className="text-zinc-300">{(activeDome.wear.yellowing * 100).toFixed(0)}%</span>
              </div>
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
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
              />
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>ROAD HAZE</span>
                <span className="text-zinc-300">{(activeDome.wear.dirtHaze * 100).toFixed(0)}%</span>
              </div>
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
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
