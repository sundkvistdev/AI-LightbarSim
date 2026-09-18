import React, { useState } from 'react';
import { Layers, Lightbulb, Activity, Box, Download, FileCode, RotateCcw } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { SimulatorCanvas } from './components/SimulatorCanvas';
import { SirenController } from './components/SirenController';
import { DomeGlassEditor } from './components/DomeGlassEditor';
import { ElementEditor } from './components/ElementEditor';
import { SequencerControls } from './components/SequencerControls';
import { StructureSettings } from './components/StructureSettings';
import { ImportExportPanel } from './components/ImportExportPanel';
import { LightbarConfig, RenderSettings, SequencerState } from './types';
import presetsData from './data/lightbarPresets.json';
import patternsData from './data/sequencePatterns.json';

type SidebarTab = 'elements' | 'domes' | 'cadence' | 'chassis' | 'io';

export default function App() {
  const initialConfig = (presetsData.presets[0] as unknown) as LightbarConfig;
  const initialPattern = patternsData.patterns[0];

  const [config, setConfig] = useState<LightbarConfig>(initialConfig);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    initialConfig.elements[0]?.id || null
  );
  const [activeTab, setActiveTab] = useState<SidebarTab>('elements');
  const [fps, setFps] = useState<number>(60);

  // Sequencer state
  const [sequencer, setSequencer] = useState<SequencerState>({
    bpm: initialPattern.defaultBpm,
    rotatorSpeedMultiplier: 1.0,
    activePatternId: initialPattern.id,
    customStepsA: [...initialPattern.stepsA, ...initialPattern.stepsA].slice(0, 16),
    customStepsB: [...initialPattern.stepsB, ...initialPattern.stepsB].slice(0, 16),
    customStepsC: [...initialPattern.stepsC, ...initialPattern.stepsC].slice(0, 16),
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
      // Snapshot fallback
    }
  };

  const handleResetCurrentPreset = () => {
    const found = (presetsData.presets as unknown as LightbarConfig[]).find(
      (p) => p.id === config.id
    );
    if (found) {
      setConfig(JSON.parse(JSON.stringify(found)));
      setSelectedElementId(found.elements[0]?.id || null);
    }
  };

  // Estimate total system wattage
  const totalWatts = config.elements.reduce((acc, elem) => {
    if (!elem.enabled) return acc;
    if (elem.type === 'rotating_halogen' && elem.rotator) return acc + (elem.rotator.wattage || 55);
    if (elem.type === 'static_halogen' && elem.halogen) return acc + (elem.halogen.wattage || 55);
    if (elem.type === 'xenon_strobe' && elem.strobe) return acc + Math.round((elem.strobe.joules || 14) * 2.2);
    if (elem.type === 'modern_led' && elem.led) return acc + (elem.led.diodeCount || 6) * 3;
    return acc + 30;
  }, 0);

  return (
    <div className="h-screen w-screen bg-black text-zinc-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Top Header Bar */}
      <HeaderBar
        currentConfig={config}
        onSelectPreset={handleSelectPreset}
        renderSettings={renderSettings}
        onUpdateSettings={handleUpdateSettings}
        onTakeSnapshot={handleTakeSnapshot}
        fps={fps}
      />

      {/* Main Workspace: Left Stage + Right Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Column: Canvas Viewport & Tactile Siren Controller */}
        <div className="flex-1 flex flex-col min-w-0 bg-black border-r border-zinc-800 overflow-y-auto lg:overflow-hidden">
          {/* Visual Simulator Canvas Area */}
          <div className="flex-1 min-h-[360px] lg:min-h-0 relative flex flex-col bg-zinc-950">
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
          </div>

          {/* Siren Controller Console (Anchored to bottom of simulation stage) */}
          <div className="shrink-0 border-t border-zinc-800">
            <SirenController />
          </div>

          {/* Compact Telemetry & Hardware Spec Status Bar */}
          <div className="shrink-0 bg-zinc-950 border-t border-zinc-800 px-3 py-1 flex flex-wrap items-center justify-between text-[10px] text-zinc-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-bold">{config.name}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-400">{config.era}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300 uppercase">{config.structure.type.replace(/_/g, ' ')}</span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span>DIM: {config.structure.widthMm}×{config.structure.heightMm}mm</span>
              <span>DOMES: {config.domes.length}</span>
              <span>EMITTERS: {config.elements.length}</span>
              <span className="text-amber-400 font-bold">EST. DRAW: {totalWatts}W</span>
              <span>BPM: {sequencer.bpm}</span>
            </div>
          </div>
        </div>

        {/* Right Column: High-Density Sidebar Editor */}
        <aside
          id="editor-sidebar"
          className="w-full lg:w-[480px] xl:w-[520px] 2xl:w-[560px] shrink-0 bg-zinc-950 flex flex-col border-t lg:border-t-0 border-zinc-800 min-h-0"
        >
          {/* Proper Tabs Header */}
          <div className="shrink-0 flex items-stretch border-b border-zinc-800 bg-zinc-900">
            {[
              { id: 'elements', label: 'EMITTERS', icon: Lightbulb, count: config.elements.length },
              { id: 'domes', label: 'DOMES', icon: Layers, count: config.domes.length },
              { id: 'cadence', label: 'CADENCE', icon: Activity, count: `${sequencer.bpm}` },
              { id: 'chassis', label: 'CHASSIS', icon: Box },
              { id: 'io', label: 'I/O & SCHEMA', icon: FileCode },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`sidebar-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as SidebarTab)}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 text-[11px] font-mono font-bold tracking-wider border-r border-zinc-800 transition-colors cursor-pointer rounded-none ${
                    active
                      ? 'bg-zinc-950 text-amber-400 border-b-2 border-b-amber-400 shadow-inner'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-none ${
                        active ? 'bg-amber-500/20 text-amber-300' : 'bg-black text-zinc-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content Panel (Scrollable, 0 wasted space) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {activeTab === 'elements' && (
              <ElementEditor
                elements={config.elements}
                onUpdateElements={(elements) => setConfig((prev) => ({ ...prev, elements }))}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
              />
            )}

            {activeTab === 'domes' && (
              <DomeGlassEditor
                domes={config.domes}
                onUpdateDomes={(domes) => setConfig((prev) => ({ ...prev, domes }))}
              />
            )}

            {activeTab === 'cadence' && (
              <SequencerControls
                sequencer={sequencer}
                onUpdateSequencer={handleUpdateSequencer}
              />
            )}

            {activeTab === 'chassis' && (
              <StructureSettings
                config={config}
                onUpdateStructure={(structure) => setConfig((prev) => ({ ...prev, structure }))}
                renderSettings={renderSettings}
                onUpdateRenderSettings={handleUpdateSettings}
              />
            )}

            {activeTab === 'io' && (
              <ImportExportPanel
                currentConfig={config}
                onApplyConfig={(newConfig) => {
                  setConfig(newConfig);
                  setSelectedElementId(newConfig.elements[0]?.id || null);
                }}
              />
            )}
          </div>

          {/* Quick Footer Action Toolbar */}
          <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-1.5 flex items-center justify-between gap-1 text-[10px]">
            <button
              onClick={handleResetCurrentPreset}
              className="flex items-center gap-1 px-2 py-1 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold rounded-none cursor-pointer"
              title="Reset configuration to factory preset defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET DEFAULTS</span>
            </button>

            <button
              onClick={() => setActiveTab('io')}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold border border-amber-400 rounded-none cursor-pointer"
              title="Open Import/Export & Schema Manager"
            >
              <Download className="w-3 h-3" />
              <span>EXPORT / IMPORT</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
