import React from 'react';
import { Gauge, Zap, Activity, Sliders, PlayCircle } from 'lucide-react';
import { SequencerState } from '../types';
import patternsData from '../data/sequencePatterns.json';

interface SequencerControlsProps {
  sequencer: SequencerState;
  onUpdateSequencer: (updated: Partial<SequencerState>) => void;
}

export const SequencerControls: React.FC<SequencerControlsProps> = ({
  sequencer,
  onUpdateSequencer,
}) => {
  const patterns = patternsData.patterns;

  const handleSelectPattern = (patternId: string) => {
    const found = patterns.find((p) => p.id === patternId);
    if (!found) return;

    // Pad or slice to 16 steps
    const padTo16 = (arr: boolean[]) => {
      const result: boolean[] = [];
      for (let i = 0; i < 16; i++) {
        result.push(arr[i % arr.length]);
      }
      return result;
    };

    onUpdateSequencer({
      activePatternId: patternId,
      bpm: found.defaultBpm || sequencer.bpm,
      customStepsA: padTo16(found.stepsA),
      customStepsB: padTo16(found.stepsB),
      customStepsC: padTo16(found.stepsC),
    });
  };

  const toggleStep = (group: 'A' | 'B' | 'C', index: number) => {
    if (group === 'A') {
      const next = [...sequencer.customStepsA];
      next[index] = !next[index];
      onUpdateSequencer({ customStepsA: next, activePatternId: 'custom' });
    } else if (group === 'B') {
      const next = [...sequencer.customStepsB];
      next[index] = !next[index];
      onUpdateSequencer({ customStepsB: next, activePatternId: 'custom' });
    } else {
      const next = [...sequencer.customStepsC];
      next[index] = !next[index];
      onUpdateSequencer({ customStepsC: next, activePatternId: 'custom' });
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Sequencer Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-zinc-100">Sequencer & Cadence Engine</h2>
        </div>

        {/* Pattern Preset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Pattern:</span>
          <select
            id="sequencer-pattern-select"
            value={sequencer.activePatternId}
            onChange={(e) => handleSelectPattern(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
          >
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="custom">Custom Pattern (User Edited)</option>
          </select>
        </div>
      </div>

      {/* Speed & Multiplier Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flash Cadence (BPM) */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Flasher & Strobe Cadence
            </span>
            <span className="font-mono text-amber-400 font-bold">{sequencer.bpm} BPM</span>
          </div>
          <input
            id="flasher-bpm-slider"
            type="range"
            min={40}
            max={240}
            step={5}
            value={sequencer.bpm}
            onChange={(e) => onUpdateSequencer({ bpm: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>40 (Slow Wig)</span>
            <span>120 (Standard)</span>
            <span>240 (Hyper-Alert)</span>
          </div>
        </div>

        {/* Rotator Speed Multiplier */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              Rotator Drive Multiplier
            </span>
            <span className="font-mono text-blue-400 font-bold">
              {sequencer.rotatorSpeedMultiplier.toFixed(2)}x
            </span>
          </div>
          <input
            id="rotator-speed-slider"
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={sequencer.rotatorSpeedMultiplier}
            onChange={(e) =>
              onUpdateSequencer({ rotatorSpeedMultiplier: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>0.2x (Slow Motion)</span>
            <span>1.0x (Calibrated RPM)</span>
            <span>2.5x (High Speed)</span>
          </div>
        </div>
      </div>

      {/* 16-Step Cadence Matrix Grid */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            16-Step Flasher Trigger Matrix (Click to Toggle)
          </span>
          <span className="text-[11px] text-zinc-500">A = Left / B = Right / C = Aux Center</span>
        </div>

        {/* Step Grid Rows */}
        <div className="space-y-2 font-mono text-xs">
          {/* Row A */}
          <div className="flex items-center gap-2">
            <span className="w-16 text-[11px] text-red-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Sync A:
            </span>
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
              {sequencer.customStepsA.map((active, idx) => (
                <button
                  key={`step-a-${idx}`}
                  id={`step-a-${idx}`}
                  onClick={() => toggleStep('A', idx)}
                  className={`h-7 rounded border transition-colors flex items-center justify-center text-[10px] ${
                    active
                      ? 'bg-red-600 text-white font-bold border-red-500 shadow-sm shadow-red-600/40'
                      : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                  }`}
                  title={`Step ${idx + 1} Group A: ${active ? 'ON' : 'OFF'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Row B */}
          <div className="flex items-center gap-2">
            <span className="w-16 text-[11px] text-blue-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Sync B:
            </span>
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
              {sequencer.customStepsB.map((active, idx) => (
                <button
                  key={`step-b-${idx}`}
                  id={`step-b-${idx}`}
                  onClick={() => toggleStep('B', idx)}
                  className={`h-7 rounded border transition-colors flex items-center justify-center text-[10px] ${
                    active
                      ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-sm shadow-blue-600/40'
                      : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                  }`}
                  title={`Step ${idx + 1} Group B: ${active ? 'ON' : 'OFF'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Row C */}
          <div className="flex items-center gap-2">
            <span className="w-16 text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Sync C:
            </span>
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
              {sequencer.customStepsC.map((active, idx) => (
                <button
                  key={`step-c-${idx}`}
                  id={`step-c-${idx}`}
                  onClick={() => toggleStep('C', idx)}
                  className={`h-7 rounded border transition-colors flex items-center justify-center text-[10px] ${
                    active
                      ? 'bg-amber-600 text-white font-bold border-amber-500 shadow-sm shadow-amber-600/40'
                      : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                  }`}
                  title={`Step ${idx + 1} Group C: ${active ? 'ON' : 'OFF'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
