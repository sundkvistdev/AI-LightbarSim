import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Radio, Zap, Disc3, ShieldAlert, Waves } from 'lucide-react';
import { SirenMode, SirenStyle, sirenAudio } from '../utils/sirenAudio';

export const SirenController: React.FC = () => {
  const [style, setStyle] = useState<SirenStyle>('WHELEN_295');
  const [mode, setMode] = useState<SirenMode>('OFF');
  const [volume, setVolume] = useState<number>(0.65);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speakerWatts, setSpeakerWatts] = useState<100 | 200>(100);
  const [isRumblerActive, setIsRumblerActive] = useState<boolean>(false);
  const [outputLevel, setOutputLevel] = useState<number>(0);

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

  const handleStyleChange = (newStyle: SirenStyle) => {
    setStyle(newStyle);
    sirenAudio.setStyle(newStyle);
  };

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

  const handleToggleRumbler = () => {
    const next = !isRumblerActive;
    setIsRumblerActive(next);
    sirenAudio.setRumbler(next);
  };

  return (
    <div
      id="siren-controller-panel"
      className="bg-zinc-950 border border-zinc-800 text-xs select-none rounded-none"
    >
      {/* Top Header / Status Line */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-mono text-[11px] font-bold text-zinc-200 tracking-wider">
            SIREN AMPLIFIER CONSOLE
          </span>
          <span className="font-mono text-[10px] text-zinc-500 border border-zinc-800 px-1 bg-zinc-950">
            AUDIO DRIVER
          </span>
        </div>

        {/* Amplifier Hardware Style Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-zinc-400">AMP:</span>
          <select
            id="siren-style-select"
            value={style}
            onChange={(e) => handleStyleChange(e.target.value as SirenStyle)}
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 font-mono text-[11px] px-1.5 py-0.5 rounded-none focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="WHELEN_295">Whelen 295 Series (Electronic Pulse)</option>
            <option value="FED_UNITROL">Federal Unitrol 8000 (Analog Dual-Saw)</option>
            <option value="CODE3_VCON">Code 3 Mastercom (Raspy Square)</option>
            <option value="MECH_Q2B">Federal Q2B (10/12-Port Mechanical)</option>
            <option value="EURO_MARTIN">Martinshorn (Dual-Tone Compressor)</option>
          </select>
        </div>

        {/* Meters & Audio Power Controls */}
        <div className="flex items-center gap-2.5">
          {/* VU Output Level */}
          <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 border border-zinc-800">
            <span className="text-[9px] font-mono text-zinc-500">VU</span>
            <div className="flex items-center gap-0.5 h-2.5">
              {[0.08, 0.22, 0.4, 0.62, 0.85].map((thresh, idx) => {
                const active = outputLevel >= thresh && !isMuted;
                const isPeak = idx === 4;
                const isWarn = idx === 3;
                const color = isPeak
                  ? active ? 'bg-red-500 shadow-[0_0_4px_#ef4444]' : 'bg-red-950'
                  : isWarn
                  ? active ? 'bg-amber-400' : 'bg-amber-950'
                  : active ? 'bg-emerald-400' : 'bg-emerald-950';
                return <div key={idx} className={`w-1 h-full rounded-none transition-colors duration-75 ${color}`} />;
              })}
            </div>
          </div>

          {/* Watts Toggle */}
          <button
            id="siren-btn-watts"
            onClick={handleToggleWatts}
            className={`px-1.5 py-0.5 font-mono text-[10px] font-bold border rounded-none transition-colors ${
              speakerWatts === 200
                ? 'bg-amber-500 text-zinc-950 border-amber-400'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
            title="Toggle between 100W and 200W driver power"
          >
            {speakerWatts}W
          </button>

          {/* Rumbler / Howler Sub-Bass Toggle */}
          <button
            id="siren-btn-rumbler"
            onClick={handleToggleRumbler}
            className={`flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] font-bold border rounded-none transition-colors ${
              isRumblerActive
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
            title="Toggle Rumbler / Howler low-frequency sub-bass interrupter"
          >
            <Waves className="w-3 h-3" />
            <span>RUMBLER</span>
          </button>

          {/* Mute Button */}
          <button
            id="siren-btn-mute"
            onClick={handleToggleMute}
            className={`p-1 border rounded-none transition-colors ${
              isMuted
                ? 'bg-red-950 text-red-400 border-red-800'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
            title={isMuted ? 'Unmute siren' : 'Mute siren'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Volume Slider */}
          <div className="flex items-center gap-1">
            <input
              id="siren-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              disabled={isMuted}
              className="w-16 h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 disabled:opacity-30 rounded-none"
              title={`Siren volume: ${Math.round(volume * 100)}%`}
            />
            <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Controller Buttons Grid */}
      <div className="p-2 flex flex-wrap items-center justify-between gap-2">
        {/* Siren Tones Selection */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'OFF', label: 'STANDBY' },
            { id: 'WAIL', label: 'WAIL' },
            { id: 'YELP', label: 'YELP' },
            { id: 'PRIORITY', label: 'PRIOR / PIERCE' },
            { id: 'HILO', label: 'HI-LO' },
            { id: 'POWERCALL', label: 'POWERCALL' },
            { id: 'MANUAL', label: 'MANUAL' },
          ].map((btn) => {
            const active = mode === btn.id;
            const isOff = btn.id === 'OFF';
            return (
              <button
                key={btn.id}
                id={`siren-mode-${btn.id.toLowerCase()}`}
                onClick={() => handleModeChange(btn.id as SirenMode)}
                className={`px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider rounded-none transition-all border ${
                  active
                    ? isOff
                      ? 'bg-zinc-800 text-zinc-200 border-zinc-600'
                      : 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Momentary Tactile Action Paddles */}
        <div className="flex items-center gap-1.5">
          {/* Air Horn (Hold) */}
          <button
            id="siren-btn-airhorn"
            onMouseDown={() => sirenAudio.setAirHorn(true)}
            onMouseUp={() => sirenAudio.setAirHorn(false)}
            onMouseLeave={() => sirenAudio.setAirHorn(false)}
            onTouchStart={() => sirenAudio.setAirHorn(true)}
            onTouchEnd={() => sirenAudio.setAirHorn(false)}
            className="flex items-center gap-1.5 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider bg-red-950 hover:bg-red-900 text-red-300 border border-red-700 active:bg-red-600 active:text-white rounded-none cursor-pointer"
            title="Hold to blast pneumatic dual-chime air horn"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>AIR HORN</span>
          </button>

          {/* Manual Spool / Wind */}
          <button
            id="siren-btn-manual"
            onMouseDown={() => sirenAudio.setManual(true)}
            onMouseUp={() => sirenAudio.setManual(false)}
            onMouseLeave={() => sirenAudio.setManual(false)}
            onTouchStart={() => sirenAudio.setManual(true)}
            onTouchEnd={() => sirenAudio.setManual(false)}
            className="flex items-center gap-1.5 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-850 text-amber-300 border border-amber-800/80 active:bg-amber-500 active:text-zinc-950 rounded-none cursor-pointer"
            title="Hold to spool rotor / manual tone"
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span>{style === 'MECH_Q2B' ? 'WIND ROTOR' : 'MANUAL'}</span>
          </button>

          {/* Electric Brake (Available for Mechanical Q2B) */}
          {style === 'MECH_Q2B' && (
            <button
              id="siren-btn-brake"
              onMouseDown={() => sirenAudio.setBrake(true)}
              onMouseUp={() => sirenAudio.setBrake(false)}
              onMouseLeave={() => sirenAudio.setBrake(false)}
              onTouchStart={() => sirenAudio.setBrake(true)}
              onTouchEnd={() => sirenAudio.setBrake(false)}
              className="flex items-center gap-1 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-850 text-rose-300 border border-rose-800 active:bg-rose-600 active:text-white rounded-none cursor-pointer"
              title="Hold to apply electromagnetic rotor brake"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>BRAKE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
