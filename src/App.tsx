import React, { useState } from 'react';
import { Layers, Lightbulb, Activity, Box, Sparkles, AlertCircle } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { SimulatorCanvas } from './components/SimulatorCanvas';
import { DomeGlassEditor } from './components/DomeGlassEditor';
import { ElementEditor } from './components/ElementEditor';
import { SequencerControls } from './components/SequencerControls';
import { StructureSettings } from './components/StructureSettings';
import { LightbarConfig, RenderSettings, SequencerState } from './types';
import presetsData from './data/lightbarPresets.json';
import patternsData from './data/sequencePatterns.json';

type ActiveTab = 'glass' | 'elements' | 'sequencer' | 'structure';

export default function App() {
  // Initial config from first preset
  const initialConfig = (presetsData.presets[0] as unknown) as LightbarConfig;
  const initialPattern = patternsData.patterns[0];

  const [config, setConfig] = useState<LightbarConfig>(initialConfig);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    initialConfig.elements[0]?.id || null
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('glass');
  const [fps, setFps] = useState<number>(60);

  // Sequencer state
  const [sequencer, setSequencer] = useState<SequencerState>({
    bpm: initialPattern.defaultBpm,
    rotatorSpeedMultiplier: 1.0,
    activePatternId: initialPattern.id,
    customStepsA: [
      ...initialPattern.stepsA,
      ...initialPattern.stepsA,
    ].slice(0, 16),
    customStepsB: [
      ...initialPattern.stepsB,
      ...initialPattern.stepsB,
    ].slice(0, 16),
    customStepsC: [
      ...initialPattern.stepsC,
      ...initialPattern.stepsC,
    ].slice(0, 16),
  });

  // Render & Atmosphere settings
  const [renderSettings, setRenderSettings] = useState<RenderSettings>({
    enableHalos: true,
    enableLensFlares: false,
    coronaIntensity: 1.2,
    bloomRadius: 1.0,
    refractionStrength: 1.0,
    lensDirt: false,
    atmosphere: 'night_street',
    viewAngle: 'front',
    roofReflection: false,
    showBeamsInAir: false,
    audioEnabled: false,
    audioVolume: 0.35,
  });

  const handleUpdateSettings = (updated: Partial<RenderSettings>) => {
    setRenderSettings((prev) => ({ ...prev, ...updated }));
  };

  const handleUpdateSequencer = (updated: Partial<SequencerState>) => {
    setSequencer((prev) => ({ ...prev, ...updated }));
  };

  const handleSelectPreset = (preset: LightbarConfig) => {
    setConfig(preset);
    setSelectedElementId(preset.elements[0]?.id || null);
  };

  const handleTakeSnapshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `lightbar-sim-${config.id}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Snapshot download fallback
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <HeaderBar
        currentConfig={config}
        onSelectPreset={handleSelectPreset}
        renderSettings={renderSettings}
        onUpdateSettings={handleUpdateSettings}
        onTakeSnapshot={handleTakeSnapshot}
        fps={fps}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 space-y-5">
        {/* Canvas Display Viewport */}
        <SimulatorCanvas
          config={config}
          settings={renderSettings}
          sequencer={sequencer}
          onUpdateSettings={handleUpdateSettings}
          selectedElementId={selectedElementId}
          onSelectElement={(id) => {
            setSelectedElementId(id);
            setActiveTab('elements');
          }}
          setFps={setFps}
        />

        {/* Era & Preset Details Info Bar */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-zinc-200">{config.name}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400 font-mono text-[11px]">{config.era}</span>
          </div>
          <p className="text-zinc-400 max-w-2xl text-[11px] truncate">{config.description}</p>
        </div>

        {/* Navigation Tabs for Editors */}
        <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 overflow-x-auto">
          {[
            { id: 'glass', label: 'Outer Glass & Domes', icon: Layers, count: `${config.domes.length} sections` },
            { id: 'elements', label: 'Light Elements & Emitters', icon: Lightbulb, count: `${config.elements.length} active` },
            { id: 'sequencer', label: 'Sequencer & Flash Timing', icon: Activity, count: `${sequencer.bpm} BPM` },
            { id: 'structure', label: 'Structure & Optical Corona', icon: Box, count: config.structure.type },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-red-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    active ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-900 text-zinc-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div>
          {activeTab === 'glass' && (
            <DomeGlassEditor
              domes={config.domes}
              onUpdateDomes={(domes) => setConfig((prev) => ({ ...prev, domes }))}
            />
          )}

          {activeTab === 'elements' && (
            <ElementEditor
              elements={config.elements}
              onUpdateElements={(elements) => setConfig((prev) => ({ ...prev, elements }))}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
            />
          )}

          {activeTab === 'sequencer' && (
            <SequencerControls
              sequencer={sequencer}
              onUpdateSequencer={handleUpdateSequencer}
            />
          )}

          {activeTab === 'structure' && (
            <StructureSettings
              config={config}
              onUpdateStructure={(structure) => setConfig((prev) => ({ ...prev, structure }))}
              renderSettings={renderSettings}
              onUpdateRenderSettings={handleUpdateSettings}
            />
          )}
        </div>
      </main>
    </div>
  );
}
