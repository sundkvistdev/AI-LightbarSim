import React from 'react';
import { Volume2, VolumeX, Camera, Sun, Moon, Sparkles, Shield, RefreshCw } from 'lucide-react';
import { EnvironmentAtmosphere, LightbarConfig, RenderSettings } from '../types';
import presetsData from '../data/lightbarPresets.json';

interface HeaderBarProps {
  currentConfig: LightbarConfig;
  onSelectPreset: (preset: LightbarConfig) => void;
  renderSettings: RenderSettings;
  onUpdateSettings: (settings: Partial<RenderSettings>) => void;
  onTakeSnapshot: () => void;
  fps: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentConfig,
  onSelectPreset,
  renderSettings,
  onUpdateSettings,
  onTakeSnapshot,
  fps,
}) => {
  return (
    <header className="bg-zinc-950/95 border-b border-zinc-800/80 px-4 py-3 sticky top-0 z-30 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
      {/* Brand & App Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-sm shadow-red-500/20">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Optical Lightbar Simulator
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Raster 2D
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Physical glass refraction, filament thermal inertia & xenon strobe dynamics
          </p>
        </div>
      </div>

      {/* Preset Selector & Quick Controls */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Presets dropdown */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs">
          <span className="text-zinc-400 font-medium">Preset:</span>
          <select
            id="preset-selector"
            className="bg-transparent text-zinc-200 font-semibold focus:outline-none cursor-pointer pr-1"
            value={currentConfig.id}
            onChange={(e) => {
              const found = (presetsData.presets as unknown as LightbarConfig[]).find(
                (p) => p.id === e.target.value
              );
              if (found) onSelectPreset(found);
            }}
          >
            {(presetsData.presets as unknown as LightbarConfig[]).map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-zinc-900 text-zinc-200">
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Atmosphere mode */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
          {(
            [
              { id: 'night_street', label: 'Night Street', icon: Moon },
              { id: 'foggy_atmosphere', label: 'Misty Fog', icon: Sparkles },
              { id: 'inspection_studio', label: 'Studio Grid', icon: Sun },
              { id: 'blackout_lab', label: 'Dark Lab', icon: RefreshCw },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = renderSettings.atmosphere === item.id;
            return (
              <button
                key={item.id}
                id={`atmosphere-${item.id}`}
                onClick={() => onUpdateSettings({ atmosphere: item.id as EnvironmentAtmosphere })}
                title={`Environment: ${item.label}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                  active
                    ? 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Audio Toggle & Volume Slider */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
          <button
            id="audio-toggle-btn"
            onClick={() => onUpdateSettings({ audioEnabled: !renderSettings.audioEnabled })}
            className={`transition-colors ${
              renderSettings.audioEnabled ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={renderSettings.audioEnabled ? 'Mute Audio' : 'Unmute Motor & Relay Audio'}
          >
            {renderSettings.audioEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          {renderSettings.audioEnabled && (
            <input
              id="audio-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={renderSettings.audioVolume}
              onChange={(e) => onUpdateSettings({ audioVolume: parseFloat(e.target.value) })}
              className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              title={`Volume: ${Math.round(renderSettings.audioVolume * 100)}%`}
            />
          )}
        </div>

        {/* Snapshot Button */}
        <button
          id="btn-take-snapshot"
          onClick={onTakeSnapshot}
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          title="Export high-resolution canvas snapshot"
        >
          <Camera className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden md:inline">Snapshot</span>
        </button>

        {/* FPS Counter Badge */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 font-mono text-[11px] text-emerald-400 px-2 py-1 rounded">
          {fps} <span className="text-zinc-500 text-[9px]">FPS</span>
        </div>
      </div>
    </header>
  );
};
