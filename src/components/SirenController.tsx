import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Radio, Zap, Disc3, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { SirenMode, sirenAudio } from '../utils/sirenAudio';

interface SirenControllerProps {
  onToggleExpand?: (expanded: boolean) => void;
}

export const SirenController: React.FC<SirenControllerProps> = () => {
  const [mode, setMode] = useState<SirenMode>('OFF');
  const [volume, setVolume] = useState<number>(0.65);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speakerWatts, setSpeakerWatts] = useState<100 | 200>(100);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Meter animation loop
  const meterRef = useRef<number | null>(null);

  useEffect(() => {
    const updateMeter = () => {
      const lvl = sirenAudio.getOutputLevel();
      setOutputLevel(lvl);
      meterRef.current = requestAnimationFrame(updateMeter);
    };
    meterRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (meterRef.current) cancelAnimationFrame(meterRef.current);
    };
  }, []);

  const handleModeChange = (newMode: SirenMode) => {
    setMode(newMode);
    sirenAudio.setMode(newMode);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    sirenAudio.setVolume(newVol);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sirenAudio.setMuted(next);
  };

  const handleToggleWatts = () => {
    const nextWatts = speakerWatts === 100 ? 200 : 100;
    setSpeakerWatts(nextWatts);
    sirenAudio.setSpeakerWatts(nextWatts);
  };

  return (
    <div
      id="siren-controller-panel"
      className="bg-zinc-950/95 border border-zinc-800/90 rounded-xl shadow-xl overflow-hidden transition-all text-xs select-none"
    >
      {/* Top Header / Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold tracking-wider text-zinc-200 font-mono text-[11px] uppercase">
              100W Emergency Siren Controller
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
            SERIES 295 / Q2B
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Output Level Meter (VU style) */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80" title="Audio Horn Driver Pressure">
            <span className="text-[9px] font-mono text-zinc-500 mr-0.5">OUT</span>
            <div className="flex items-center gap-0.5 h-2.5">
              {[0.1, 0.25, 0.45, 0.65, 0.85].map((thresh, idx) => {
                const active = outputLevel >= thresh && !isMuted;
                const isPeak = idx >= 4;
                const isWarn = idx === 3;
                const color = isPeak
                  ? active ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-red-950/60'
                  : isWarn
                  ? active ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]' : 'bg-amber-950/60'
                  : active ? 'bg-emerald-400 shadow-[0_0_5px_#10b981]' : 'bg-emerald-950/60';
                return <div key={idx} className={`w-1.5 h-full rounded-xs transition-colors duration-75 ${color}`} />;
              })}
            </div>
          </div>

          {/* Watts Toggle */}
          <button
            id="siren-btn-watts"
            onClick={handleToggleWatts}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-colors ${
              speakerWatts === 200
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
            }`}
            title="Switch Between 100W Single Driver and 200W Dual Speaker Output"
          >
            {speakerWatts}W
          </button>

          {/* Collapse/Expand Toggle */}
          <button
            id="siren-btn-collapse"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title={isCollapsed ? 'Expand Controller' : 'Minimize Controller'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Controller Body */}
      {!isCollapsed && (
        <div className="p-3 bg-zinc-950/90 flex flex-wrap items-center justify-between gap-3">
          {/* Primary Siren Tones (Tactile Backlit Pushbuttons) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'OFF', label: 'STANDBY / OFF' },
              { id: 'WAIL', label: 'WAIL' },
              { id: 'YELP', label: 'YELP' },
              { id: 'PRIORITY', label: 'PRIOR' },
              { id: 'HILO', label: 'HI-LO' },
              { id: 'MECH_Q', label: 'MECH Q' },
            ].map((btn) => {
              const active = mode === btn.id;
              const isOff = btn.id === 'OFF';
              return (
                <button
                  key={btn.id}
                  id={`siren-mode-${btn.id.toLowerCase()}`}
                  onClick={() => handleModeChange(btn.id as SirenMode)}
                  className={`px-3 py-1.5 rounded-md font-mono text-[11px] font-bold tracking-wider transition-all border ${
                    active
                      ? isOff
                        ? 'bg-zinc-800 text-zinc-200 border-zinc-600 shadow-xs'
                        : 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-850'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Momentary Tactile Action Paddles */}
          <div className="flex items-center gap-2">
            {/* Air Horn (Push and Hold) */}
            <button
              id="siren-btn-airhorn"
              onMouseDown={() => sirenAudio.setAirHorn(true)}
              onMouseUp={() => sirenAudio.setAirHorn(false)}
              onMouseLeave={() => sirenAudio.setAirHorn(false)}
              onTouchStart={() => sirenAudio.setAirHorn(true)}
              onTouchEnd={() => sirenAudio.setAirHorn(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 active:bg-red-600 active:text-white active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Hold to Blast 100W Dual-Harmonic Air Horn"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>AIR HORN</span>
            </button>

            {/* Manual Wind / Spool */}
            <button
              id="siren-btn-manual"
              onMouseDown={() => sirenAudio.setManual(true)}
              onMouseUp={() => sirenAudio.setManual(false)}
              onMouseLeave={() => sirenAudio.setManual(false)}
              onTouchStart={() => sirenAudio.setManual(true)}
              onTouchEnd={() => sirenAudio.setManual(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-900/40 active:bg-amber-500 active:text-zinc-950 active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Hold to Spool Siren Rotor (Coast Down on Release)"
            >
              <Disc3 className="w-3.5 h-3.5" />
              <span>{mode === 'MECH_Q' ? 'WIND' : 'MANUAL'}</span>
            </button>

            {/* Electric Brake (For Mechanical Q2B mode) */}
            {mode === 'MECH_Q' && (
              <button
                id="siren-btn-brake"
                onMouseDown={() => sirenAudio.setBrake(true)}
                onMouseUp={() => sirenAudio.setBrake(false)}
                onMouseLeave={() => sirenAudio.setBrake(false)}
                onTouchStart={() => sirenAudio.setBrake(true)}
                onTouchEnd={() => sirenAudio.setBrake(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-rose-300 border border-rose-900/50 active:bg-rose-600 active:text-white active:scale-95 transition-all cursor-pointer"
                title="Hold to Apply Electromagnetic Brake to Rotor"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>BRAKE</span>
              </button>
            )}

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            {/* Volume Control & Mute */}
            <div className="flex items-center gap-2">
              <button
                id="siren-btn-mute"
                onClick={handleToggleMute}
                className={`p-1.5 rounded-md border transition-colors ${
                  isMuted
                    ? 'bg-red-950/60 text-red-400 border-red-800/80'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
                title={isMuted ? 'Unmute Siren Output' : 'Mute Siren Output'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <div className="flex items-center gap-1.5">
                <input
                  id="siren-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  disabled={isMuted}
                  className="w-16 sm:w-20 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-30"
                  title={`Siren Volume: ${Math.round(volume * 100)}%`}
                />
                <span className="text-[10px] font-mono text-zinc-400 w-7 text-right">
                  {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
