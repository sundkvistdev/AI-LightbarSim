import React from 'react';
import { Volume2, VolumeX, Camera, Sun, Moon, Sparkles, RefreshCw } from 'lucide-react';
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
    <header className="bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono select-none rounded-none">
      {/* Brand & App Title - Strict, no jargon */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-red-600 rounded-none animate-pulse" />
          <h1 className="text-xs font-bold text-zinc-100 tracking-wider font-mono">
            OPTICAL LIGHTBAR SIMULATOR
          </h1>
        </div>
        <span className="text-[10px] text-zinc-500 border border-zinc-800 px-1 bg-zinc-900 rounded-none">
          v1.0
        </span>
      </div>

      {/* Preset Selector & Quick Controls */}
      <div className="flex items-center flex-wrap gap-1.5">
        {/* Presets dropdown */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-1">
          <span className="text-zinc-400 text-[10px]">PRESET:</span>
          <select
            id="preset-selector"
            className="bg-transparent text-zinc-200 text-xs font-bold focus:outline-none cursor-pointer pr-1 rounded-none"
            value={currentConfig.id}
            onChange={(e) => {
              const found = (presetsData.presets as unknown as LightbarConfig[]).find(
                (p) => p.id === e.target.value
              );
              if (found) onSelectPreset(found);
            }}
          >
            {(presetsData.presets as unknown as LightbarConfig[]).map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-zinc-950 text-zinc-200">
                {preset.name} ({preset.era})
              </option>
            ))}
          </select>
        </div>

        {/* Atmosphere mode */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 gap-0.5">
          {(
            [
              { id: 'night_street', label: 'NIGHT', icon: Moon },
              { id: 'foggy_atmosphere', label: 'FOG', icon: Sparkles },
              { id: 'inspection_studio', label: 'STUDIO', icon: Sun },
              { id: 'blackout_lab', label: 'DARK', icon: RefreshCw },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = renderSettings.atmosphere === item.id;
            return (
              <button
                key={item.id}
                id={`atmosphere-${item.id}`}
                onClick={() => onUpdateSettings({ atmosphere: item.id as EnvironmentAtmosphere })}
                title={`Atmosphere: ${item.label}`}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono transition-colors cursor-pointer rounded-none border ${
                  active
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-bold'
                    : 'bg-zinc-950 text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Audio Toggle & Volume Slider */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1">
          <button
            id="audio-toggle-btn"
            onClick={() => onUpdateSettings({ audioEnabled: !renderSettings.audioEnabled })}
            className={`cursor-pointer ${
              renderSettings.audioEnabled ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={renderSettings.audioEnabled ? 'Mute Rotator Motor Audio' : 'Unmute Motor Audio'}
          >
            {renderSettings.audioEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
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
              className="w-12 h-1 bg-zinc-700 appearance-none cursor-pointer accent-amber-500 rounded-none"
              title={`Motor audio volume: ${Math.round(renderSettings.audioVolume * 100)}%`}
            />
          )}
        </div>

        {/* Snapshot Button */}
        <button
          id="btn-take-snapshot"
          onClick={onTakeSnapshot}
          className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 px-2 py-1 text-[11px] font-mono font-bold cursor-pointer rounded-none"
          title="Save canvas screenshot"
        >
          <Camera className="w-3.5 h-3.5 text-zinc-400" />
          <span>SNAP</span>
        </button>

        {/* FPS Counter */}
        <div className="bg-zinc-900 border border-zinc-800 font-mono text-[10px] text-emerald-400 px-1.5 py-1">
          {fps} <span className="text-zinc-600">FPS</span>
        </div>
      </div>
    </header>
  );
};
