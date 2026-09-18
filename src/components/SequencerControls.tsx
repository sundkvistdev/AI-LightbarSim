import React from 'react';
import { Activity } from 'lucide-react';
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
    <div className="bg-zinc-950 border border-zinc-800 p-2.5 space-y-2 text-xs font-mono select-none rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-red-500" />
          <span className="font-bold text-zinc-200 text-[11px]">
            16-STEP CADENCE & SEQUENCER MATRIX
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-[10px]">PATTERN:</span>
          <select
            id="sequencer-pattern-select"
            value={sequencer.activePatternId}
            onChange={(e) => handleSelectPattern(e.target.value)}
            className="bg-black border border-zinc-700 px-1.5 py-0.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
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

      {/* Speed Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-zinc-800 bg-zinc-900/60 p-2">
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-400">FLASHER CADENCE</span>
            <span className="text-zinc-200 font-bold font-mono">{sequencer.bpm} BPM</span>
          </div>
          <input
            type="range"
            min={40}
            max={240}
            step={5}
            value={sequencer.bpm}
            onChange={(e) => onUpdateSequencer({ bpm: parseInt(e.target.value, 10) })}
            className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
          />
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-400">ROTATOR DRIVE MULTIPLIER</span>
            <span className="text-zinc-200 font-bold font-mono">
              {sequencer.rotatorSpeedMultiplier.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={sequencer.rotatorSpeedMultiplier}
            onChange={(e) =>
              onUpdateSequencer({ rotatorSpeedMultiplier: parseFloat(e.target.value) })
            }
            className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
          />
        </div>
      </div>

      {/* 16-Step Grid Matrix */}
      <div className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1 border-b border-zinc-800">
          <span>STEP ACTIVATION (STEPS 1–16):</span>
          <span className="text-zinc-500">CLICK CELLS TO TOGGLE</span>
        </div>

        {/* Step Numbers Header */}
        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[9px] text-zinc-500">BUS</span>
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="text-center text-[8px] text-zinc-500 font-mono">
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* Sync Row A */}
        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[10px] font-bold text-red-400">SYNC A</span>
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
            {sequencer.customStepsA.map((active, i) => (
              <button
                key={i}
                onClick={() => toggleStep('A', i)}
                className={`h-5 border transition-colors cursor-pointer rounded-none ${
                  active
                    ? 'bg-red-600 border-red-400 shadow-[0_0_4px_#dc2626]'
                    : 'bg-black border-zinc-800 hover:border-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Sync Row B */}
        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[10px] font-bold text-blue-400">SYNC B</span>
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
            {sequencer.customStepsB.map((active, i) => (
              <button
                key={i}
                onClick={() => toggleStep('B', i)}
                className={`h-5 border transition-colors cursor-pointer rounded-none ${
                  active
                    ? 'bg-blue-600 border-blue-400 shadow-[0_0_4px_#2563eb]'
                    : 'bg-black border-zinc-800 hover:border-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Sync Row C */}
        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[10px] font-bold text-amber-400">SYNC C</span>
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
            {sequencer.customStepsC.map((active, i) => (
              <button
                key={i}
                onClick={() => toggleStep('C', i)}
                className={`h-5 border transition-colors cursor-pointer rounded-none ${
                  active
                    ? 'bg-amber-500 border-amber-300 shadow-[0_0_4px_#f59e0b]'
                    : 'bg-black border-zinc-800 hover:border-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
