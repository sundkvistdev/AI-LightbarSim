import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Eye, Maximize2, Minimize2, Sparkles, Wind, Sun, Aperture } from 'lucide-react';
import { LightbarConfig, RenderSettings, SequencerState, ViewAngle } from '../types';
import {
  LightbarRenderer,
  SimulationState,
  createInitialSimulationState,
} from '../utils/lightbarRenderer';
import { lightbarAudio } from '../utils/audioEngine';

interface SimulatorCanvasProps {
  config: LightbarConfig;
  settings: RenderSettings;
  sequencer: SequencerState;
  onUpdateSettings: (settings: Partial<RenderSettings>) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
  setFps: (fps: number) => void;
}

export const SimulatorCanvas: React.FC<SimulatorCanvasProps> = ({
  config,
  settings,
  sequencer,
  onUpdateSettings,
  selectedElementId,
  onSelectElement,
  setFps,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LightbarRenderer | null>(null);
  const simStateRef = useRef<SimulationState>(createInitialSimulationState());
  const isPlayingRef = useRef<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // FPS tracking
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());

  // Handle Play/Pause
  const togglePlay = () => {
    isPlayingRef.current = !isPlayingRef.current;
    setIsPlaying(isPlayingRef.current);
    if (isPlayingRef.current) {
      lightbarAudio.resume();
    }
  };

  const handleResetTimer = () => {
    simStateRef.current = createInitialSimulationState();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Sync Audio Volume & Settings
  useEffect(() => {
    lightbarAudio.setMasterVolume(settings.audioVolume, settings.audioEnabled);
  }, [settings.audioVolume, settings.audioEnabled]);

  // Audio motor hum sync
  useEffect(() => {
    const rotators = config.elements.filter((e) => e.enabled && e.type === 'rotating_halogen');
    const avgRpm =
      rotators.length > 0
        ? rotators.reduce((sum, r) => sum + (r.rotator?.rpm || 90), 0) / rotators.length
        : 90;
    lightbarAudio.updateMotor(
      rotators.length,
      avgRpm * sequencer.rotatorSpeedMultiplier,
      settings.audioEnabled && isPlaying
    );
  }, [config.elements, sequencer.rotatorSpeedMultiplier, settings.audioEnabled, isPlaying]);

  // Canvas ResizeObserver for high-DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayW = Math.floor(rect.width);
      const displayH = Math.floor(rect.height);

      if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
        canvas.width = displayW * dpr;
        canvas.height = displayH * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
        rendererRef.current = new LightbarRenderer(canvas);
      }
    };

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(container);
    updateSize();

    return () => ro.disconnect();
  }, []);

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = (currentTime: number) => {
      const now = currentTime;
      const deltaSec = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Update simulation physics if playing
      if (isPlayingRef.current) {
        simStateRef.current.dt = deltaSec;
        simStateRef.current.timeSec += deltaSec;
      } else {
        simStateRef.current.dt = 0;
      }

      // Render frame
      if (rendererRef.current && canvasRef.current) {
        rendererRef.current.render(
          config,
          settings,
          sequencer,
          simStateRef.current,
          {
            onRelay: () => {
              if (settings.audioEnabled) lightbarAudio.playRelayClick();
            },
            onStrobe: (joules) => {
              if (settings.audioEnabled) lightbarAudio.playStrobePop(joules);
            },
          }
        );
      }

      // FPS Calculation
      frameCountRef.current++;
      if (now - lastFpsUpdateRef.current >= 600) {
        const measuredFps = Math.round(
          (frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)
        );
        setFps(measuredFps);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [config, settings, sequencer, setFps]);

  // Handle clicking on Canvas to select nearest element
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const canvasW = rect.width;

      const barW = Math.min(canvasW * 0.88, 1000);
      const barX = (canvasW - barW) / 2;

      // Check if clicked in bar area
      if (clickX >= barX && clickX <= barX + barW) {
        const normX = (clickX - barX) / barW;
        // Find nearest element
        let closestElem = config.elements[0];
        let minDiff = 999;
        config.elements.forEach((elem) => {
          const diff = Math.abs(elem.xNorm - normX);
          if (diff < minDiff) {
            minDiff = diff;
            closestElem = elem;
          }
        });
        if (closestElem && minDiff < 0.15) {
          onSelectElement(closestElem.id);
        }
      }
    },
    [config.elements, onSelectElement]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[380px] lg:h-[460px] bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center select-none"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating Canvas Controls - Top Left */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-lg p-1 text-xs">
        <button
          id="canvas-btn-play-pause"
          onClick={togglePlay}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium transition-colors"
          title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          id="canvas-btn-reset"
          onClick={handleResetTimer}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Reset Simulation Phase Clock"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Canvas Controls - Top Right (View Angles & Atmosphere) */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {/* View Angle Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-lg p-1 text-xs">
          {(
            [
              { id: 'front', label: 'Front' },
              { id: 'angled_iso', label: 'Angled' },
              { id: 'top_down', label: 'Overhead' },
            ] as const
          ).map((v) => {
            const active = settings.viewAngle === v.id;
            return (
              <button
                key={v.id}
                id={`view-angle-${v.id}`}
                onClick={() => onUpdateSettings({ viewAngle: v.id as ViewAngle })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Fullscreen button */}
        <button
          id="canvas-btn-fullscreen"
          onClick={toggleFullscreen}
          className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 p-2 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors text-xs"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Floating Canvas Quick Toggles - Bottom Left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200" title="Toggle Halos & Coronas (On by default)">
          <input
            id="toggle-halos"
            type="checkbox"
            checked={settings.enableHalos !== false}
            onChange={(e) => onUpdateSettings({ enableHalos: e.target.checked })}
            className="rounded border-zinc-700 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
          />
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px]">Halos</span>
        </label>
        <div className="w-px h-3 bg-zinc-800" />
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200" title="Toggle Lens Flare Effects (Upward Shine, Underlight, Streaks, Spikes)">
          <input
            id="toggle-lens-flares"
            type="checkbox"
            checked={Boolean(settings.enableLensFlares)}
            onChange={(e) => {
              const enabled = e.target.checked;
              onUpdateSettings({
                enableLensFlares: enabled,
                lensDirt: enabled,
                showBeamsInAir: enabled,
                roofReflection: enabled,
              });
            }}
            className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
          />
          <Aperture className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px]">Lens Flares</span>
        </label>
        {settings.enableLensFlares && (
          <>
            <div className="w-px h-3 bg-zinc-800" />
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200" title="Upward Shine (Volumetric Fog Beams)">
              <input
                id="toggle-beams-in-air"
                type="checkbox"
                checked={settings.showBeamsInAir}
                onChange={(e) => onUpdateSettings({ showBeamsInAir: e.target.checked })}
                className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
              />
              <Wind className="w-3.5 h-3.5" />
              <span className="text-[11px]">Upward Shine</span>
            </label>
            <div className="w-px h-3 bg-zinc-800" />
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200" title="Underlight (Roof Bounce Reflection)">
              <input
                id="toggle-roof-reflection"
                type="checkbox"
                checked={settings.roofReflection}
                onChange={(e) => onUpdateSettings({ roofReflection: e.target.checked })}
                className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-800 cursor-pointer"
              />
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[11px]">Underlight</span>
            </label>
          </>
        )}
      </div>

      {/* Bottom Right - Selected Element quick badge */}
      {selectedElementId && (
        <div className="absolute bottom-3 right-3 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>
            Selected:{' '}
            <strong className="text-zinc-100">
              {config.elements.find((e) => e.id === selectedElementId)?.name || 'Element'}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};
