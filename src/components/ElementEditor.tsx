import React from 'react';
import {
  Lightbulb,
  Plus,
  Trash2,
  Copy,
  Flame,
  Zap,
  RotateCw,
  Gauge,
  Thermometer,
  Shield,
  Palette,
} from 'lucide-react';
import { ElementType, LightElement, SyncGroup } from '../types';

interface ElementEditorProps {
  elements: LightElement[];
  onUpdateElements: (elements: LightElement[]) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
}

export const ElementEditor: React.FC<ElementEditorProps> = ({
  elements,
  onUpdateElements,
  selectedElementId,
  onSelectElement,
}) => {
  const activeElement =
    elements.find((e) => e.id === selectedElementId) || elements[0] || null;

  const handleUpdateActive = (updated: Partial<LightElement>) => {
    if (!activeElement) return;
    const next = elements.map((e) => (e.id === activeElement.id ? { ...e, ...updated } : e));
    onUpdateElements(next);
  };

  const handleAddElement = () => {
    const newId = `elem_${Date.now()}`;
    const newElem: LightElement = {
      id: newId,
      name: `Rotator ${elements.length + 1}`,
      type: 'rotating_halogen',
      xNorm: 0.5,
      yNorm: 0.0,
      subglassColor: null,
      brightness: 1.4,
      wear: {
        fadeWear: 0.1,
        reflectorTarnish: 0.1,
        jitter: 0.01,
      },
      syncGroup: 'A',
      enabled: true,
      rotator: {
        rpm: 90,
        beamSpreadDeg: 26,
        rotationDirection: 1,
        phaseOffsetDeg: 0,
        reflectorType: 'parabolic_dish',
        wattage: 55,
        filamentWarmth: 3000,
        reflectorFinish: 'chrome',
      },
    };
    onUpdateElements([...elements, newElem]);
    onSelectElement(newId);
  };

  const handleDuplicate = () => {
    if (!activeElement) return;
    const newId = `elem_${Date.now()}`;
    const duplicated: LightElement = {
      ...JSON.parse(JSON.stringify(activeElement)),
      id: newId,
      name: `${activeElement.name} (Copy)`,
      xNorm: Math.min(0.95, activeElement.xNorm + 0.08),
    };
    onUpdateElements([...elements, duplicated]);
    onSelectElement(newId);
  };

  const handleDelete = () => {
    if (!activeElement || elements.length <= 1) return;
    const next = elements.filter((e) => e.id !== activeElement.id);
    onUpdateElements(next);
    onSelectElement(next[0].id);
  };

  const handleTypeChange = (newType: ElementType) => {
    if (!activeElement) return;
    const updated: Partial<LightElement> = { type: newType };

    if (newType === 'rotating_halogen' && !activeElement.rotator) {
      updated.rotator = {
        rpm: 90,
        beamSpreadDeg: 24,
        rotationDirection: 1,
        phaseOffsetDeg: 0,
        reflectorType: 'parabolic_dish',
        wattage: 55,
        filamentWarmth: 3000,
        reflectorFinish: 'chrome',
      };
    } else if (newType === 'static_halogen' && !activeElement.halogen) {
      updated.halogen = {
        filamentThermalRiseMs: 70,
        filamentThermalFallMs: 140,
        wattage: 55,
        bulbShape: 'h1',
      };
    } else if (newType === 'xenon_strobe' && !activeElement.strobe) {
      updated.strobe = {
        joules: 15,
        flashDurationMs: 8,
        burstPattern: 'double',
        gasTint: '#e0f2fe',
      };
    } else if (newType === 'modern_led' && !activeElement.led) {
      updated.led = {
        diodeCount: 6,
        opticLens: 'tir',
      };
    }

    handleUpdateActive(updated);
  };

  if (!activeElement) return null;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header with list & actions */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-100">
            Internal Light Elements & Emitters
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-add-element"
            onClick={handleAddElement}
            className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-2.5 py-1 rounded-lg transition-colors"
            title="Add New Emitter"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
          <button
            id="btn-duplicate-element"
            onClick={handleDuplicate}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            title="Duplicate Selected"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-delete-element"
            onClick={handleDelete}
            disabled={elements.length <= 1}
            className="p-1.5 bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 rounded-lg transition-colors disabled:opacity-40"
            title="Delete Emitter"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Elements Pill Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {elements.map((elem) => {
          const isSelected = elem.id === activeElement.id;
          return (
            <button
              key={elem.id}
              id={`elem-tab-${elem.id}`}
              onClick={() => onSelectElement(elem.id)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all flex items-center gap-2 border ${
                isSelected
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-xs'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  elem.type === 'rotating_halogen'
                    ? 'bg-amber-400'
                    : elem.type === 'xenon_strobe'
                    ? 'bg-cyan-300 shadow-xs shadow-cyan-400'
                    : elem.type === 'static_halogen'
                    ? 'bg-orange-500'
                    : 'bg-emerald-400'
                }`}
              />
              <span>{elem.name}</span>
            </button>
          );
        })}
      </div>

      {/* Element Inspector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Card: General Element Parameters */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-3">
          {/* Element Name & Type */}
          <div className="flex items-center gap-2">
            <input
              id="element-name-input"
              type="text"
              value={activeElement.name}
              onChange={(e) => handleUpdateActive({ name: e.target.value })}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-amber-500"
            />
            <select
              id="element-type-select"
              value={activeElement.type}
              onChange={(e) => handleTypeChange(e.target.value as ElementType)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="rotating_halogen">Rotating Halogen</option>
              <option value="static_halogen">Static Halogen Flasher</option>
              <option value="xenon_strobe">Xenon Strobe Tube</option>
              <option value="modern_led">Modern High-Output LED</option>
            </select>
          </div>

          {/* Position X Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Horizontal Position (X)</span>
              <span className="font-mono text-zinc-300">
                {Math.round(activeElement.xNorm * 100)}%
              </span>
            </div>
            <input
              id="element-x-slider"
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={activeElement.xNorm}
              onChange={(e) => handleUpdateActive({ xNorm: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Brightness Multiplier */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Brightness Multiplier</span>
              <span className="font-mono text-amber-400 font-bold">
                {activeElement.brightness.toFixed(1)}x
              </span>
            </div>
            <input
              id="element-brightness-slider"
              type="range"
              min={0.2}
              max={2.5}
              step={0.1}
              value={activeElement.brightness}
              onChange={(e) => handleUpdateActive({ brightness: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Subglass Color Filter (Capsule over bulb) */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
            <span className="text-zinc-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-zinc-400" />
              Bulb Subglass Filter:
            </span>
            <div className="flex items-center gap-2">
              <button
                id="btn-subglass-clear"
                onClick={() => handleUpdateActive({ subglassColor: null })}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  activeElement.subglassColor === null
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Clear
              </button>
              <input
                id="element-subglass-color-picker"
                type="color"
                value={activeElement.subglassColor || '#ef4444'}
                onChange={(e) => handleUpdateActive({ subglassColor: e.target.value })}
                className="w-5 h-5 rounded border border-zinc-700 cursor-pointer bg-transparent"
                title="Colored subglass bulb envelope"
              />
            </div>
          </div>

          {/* Sync Group Assignment */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
            <span className="text-zinc-300">Sequencer Sync Group:</span>
            <div className="flex items-center gap-1">
              {(['A', 'B', 'C', 'STEADY'] as SyncGroup[]).map((grp) => (
                <button
                  key={grp}
                  id={`sync-group-btn-${grp}`}
                  onClick={() => handleUpdateActive({ syncGroup: grp })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    activeElement.syncGroup === grp
                      ? grp === 'A'
                        ? 'bg-red-600 text-white'
                        : grp === 'B'
                        ? 'bg-blue-600 text-white'
                        : grp === 'C'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: Type Specific Physics & Wear Parameters */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-3">
          {activeElement.type === 'rotating_halogen' && activeElement.rotator && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  Rotator Mechanics
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {activeElement.rotator.rpm} RPM
                </span>
              </div>

              {/* RPM Slider */}
              <div className="space-y-1">
                <input
                  id="rotator-rpm-slider"
                  type="range"
                  min={40}
                  max={200}
                  step={5}
                  value={activeElement.rotator.rpm}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: {
                        ...activeElement.rotator!,
                        rpm: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Beam Spread Cone Angle */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">Beam Spread Angle</span>
                  <span className="font-mono text-zinc-300">
                    {activeElement.rotator.beamSpreadDeg}°
                  </span>
                </div>
                <input
                  id="rotator-beam-spread-slider"
                  type="range"
                  min={14}
                  max={45}
                  step={1}
                  value={activeElement.rotator.beamSpreadDeg}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: {
                        ...activeElement.rotator!,
                        beamSpreadDeg: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                />
              </div>

              {/* Phase Offset & Direction */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-1">
                    Phase: {activeElement.rotator.phaseOffsetDeg}°
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={activeElement.rotator.phaseOffsetDeg}
                    onChange={(e) =>
                      handleUpdateActive({
                        rotator: {
                          ...activeElement.rotator!,
                          phaseOffsetDeg: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>
                <div>
                  <span className="text-zinc-400 block mb-1">Reflector Dish</span>
                  <select
                    value={activeElement.rotator.reflectorType}
                    onChange={(e) =>
                      handleUpdateActive({
                        rotator: {
                          ...activeElement.rotator!,
                          reflectorType: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-[11px] text-zinc-200 cursor-pointer"
                  >
                    <option value="parabolic_dish">Parabolic Dish</option>
                    <option value="sealed_beam_par36">Sealed Beam PAR36</option>
                    <option value="par46">Heavy PAR46</option>
                    <option value="dual_sided_mirror">Dual-Sided Mirror</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeElement.type === 'static_halogen' && activeElement.halogen && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Incandescent Thermal Inertia
                </span>
                <span className="font-mono text-orange-400 font-bold">
                  {activeElement.halogen.wattage}W
                </span>
              </div>

              {/* Thermal Rise (Warm up ms) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">Filament Thermal Rise</span>
                  <span className="font-mono text-zinc-300">
                    {activeElement.halogen.filamentThermalRiseMs} ms
                  </span>
                </div>
                <input
                  id="filament-rise-slider"
                  type="range"
                  min={30}
                  max={150}
                  step={5}
                  value={activeElement.halogen.filamentThermalRiseMs}
                  onChange={(e) =>
                    handleUpdateActive({
                      halogen: {
                        ...activeElement.halogen!,
                        filamentThermalRiseMs: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              {/* Thermal Fall (Cool down fade ms) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">Cool-down Ember Fade (Fall)</span>
                  <span className="font-mono text-zinc-300">
                    {activeElement.halogen.filamentThermalFallMs} ms
                  </span>
                </div>
                <input
                  id="filament-fall-slider"
                  type="range"
                  min={60}
                  max={250}
                  step={10}
                  value={activeElement.halogen.filamentThermalFallMs}
                  onChange={(e) =>
                    handleUpdateActive({
                      halogen: {
                        ...activeElement.halogen!,
                        filamentThermalFallMs: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </>
          )}

          {activeElement.type === 'xenon_strobe' && activeElement.strobe && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-300" />
                  Xenon Discharge Tube
                </span>
                <span className="font-mono text-cyan-300 font-bold">
                  {activeElement.strobe.joules} Joules
                </span>
              </div>

              {/* Joules Discharge Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">Capacitor Stored Energy</span>
                  <span className="font-mono text-zinc-300">
                    {activeElement.strobe.joules} J
                  </span>
                </div>
                <input
                  id="strobe-joules-slider"
                  type="range"
                  min={5}
                  max={25}
                  step={1}
                  value={activeElement.strobe.joules}
                  onChange={(e) =>
                    handleUpdateActive({
                      strobe: {
                        ...activeElement.strobe!,
                        joules: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Burst Pattern */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-300">Burst Discharge Mode:</span>
                <select
                  value={activeElement.strobe.burstPattern}
                  onChange={(e) =>
                    handleUpdateActive({
                      strobe: {
                        ...activeElement.strobe!,
                        burstPattern: e.target.value as any,
                      },
                    })
                  }
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 cursor-pointer"
                >
                  <option value="single">Single Pop</option>
                  <option value="double">Double Flash</option>
                  <option value="triple">Triple Pop</option>
                  <option value="quad">Quad Burst</option>
                </select>
              </div>
            </>
          )}

          {/* Wear & Aging Parameters (Applies to all elements) */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              Element Aging & Wear
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-400 block mb-1">
                  Filament Wear: {Math.round(activeElement.wear.fadeWear * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={activeElement.wear.fadeWear}
                  onChange={(e) =>
                    handleUpdateActive({
                      wear: {
                        ...activeElement.wear,
                        fadeWear: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-400"
                />
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">
                  Dish Tarnish: {Math.round(activeElement.wear.reflectorTarnish * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={activeElement.wear.reflectorTarnish}
                  onChange={(e) =>
                    handleUpdateActive({
                      wear: {
                        ...activeElement.wear,
                        reflectorTarnish: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
