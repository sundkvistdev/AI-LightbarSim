import React from 'react';
import {
  Lightbulb,
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Power,
  RotateCw,
  Zap,
} from 'lucide-react';
import {
  LightElement,
  ElementType,
  SyncGroup,
  RotatorConfig,
  HalogenFlasherConfig,
  XenonStrobeConfig,
  LedConfig,
} from '../types';

interface ElementEditorProps {
  elements: LightElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
  onUpdateElements: (elements: LightElement[]) => void;
}

export const ElementEditor: React.FC<ElementEditorProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElements,
}) => {
  const activeElement =
    elements.find((e) => e.id === selectedElementId) || elements[0];

  const handleUpdateActive = (updated: Partial<LightElement>) => {
    if (!activeElement) return;
    const newElements = elements.map((e) =>
      e.id === activeElement.id ? { ...e, ...updated } : e
    );
    onUpdateElements(newElements);
  };

  const handleAddElement = () => {
    const newId = `elem_${Date.now()}`;
    const newElement: LightElement = {
      id: newId,
      name: `Emitter ${elements.length + 1}`,
      type: 'rotating_halogen',
      xNorm: 0.5,
      yNorm: 0.0,
      subglassColor: null,
      brightness: 1.4,
      syncGroup: 'A',
      enabled: true,
      wear: { fadeWear: 0.05, reflectorTarnish: 0.05, jitter: 0.01 },
      rotator: {
        rpm: 90,
        beamSpreadDeg: 24,
        rotationDirection: 1,
        phaseOffsetDeg: 0,
        reflectorType: 'parabolic_dish',
        wattage: 55,
        filamentWarmth: 3000,
        reflectorFinish: 'chrome',
      },
    };
    onUpdateElements([...elements, newElement]);
    onSelectElement(newId);
  };

  const handleDuplicate = () => {
    if (!activeElement) return;
    const newId = `elem_${Date.now()}`;
    const duplicated: LightElement = {
      ...JSON.parse(JSON.stringify(activeElement)),
      id: newId,
      name: `${activeElement.name} (Copy)`,
      xNorm: Math.min(0.95, activeElement.xNorm + 0.06),
    };
    onUpdateElements([...elements, duplicated]);
    onSelectElement(newId);
  };

  const handleDelete = () => {
    if (!activeElement || elements.length <= 1) return;
    const filtered = elements.filter((e) => e.id !== activeElement.id);
    onUpdateElements(filtered);
    onSelectElement(filtered[0].id);
  };

  const handleMoveX = (delta: number) => {
    if (!activeElement) return;
    const newX = Math.max(0.02, Math.min(0.98, activeElement.xNorm + delta));
    handleUpdateActive({ xNorm: newX });
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
        filamentThermalRiseMs: 60,
        filamentThermalFallMs: 120,
        wattage: 55,
        bulbShape: 'h1',
      };
    } else if (newType === 'xenon_strobe' && !activeElement.strobe) {
      updated.strobe = {
        joules: 14,
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
    <div className="bg-zinc-950 border border-zinc-800 p-2.5 space-y-2 text-xs font-mono select-none rounded-none">
      {/* Header bar with count and actions */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-bold text-zinc-200 text-[11px]">
            LIGHT EMITTERS ({elements.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleAddElement}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-bold rounded-none cursor-pointer"
            title="Add emitter"
          >
            <Plus className="w-3 h-3" />
            <span>ADD</span>
          </button>
          <button
            onClick={handleDuplicate}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-bold rounded-none cursor-pointer"
            title="Duplicate emitter"
          >
            <Copy className="w-3 h-3" />
            <span>DUP</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={elements.length <= 1}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-700 text-[10px] font-bold disabled:opacity-30 rounded-none cursor-pointer"
            title="Delete emitter"
          >
            <Trash2 className="w-3 h-3" />
            <span>DEL</span>
          </button>
        </div>
      </div>

      {/* Elements Pill Strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {elements.map((elem) => {
          const isSelected = elem.id === activeElement.id;
          const typeDot =
            elem.type === 'rotating_halogen'
              ? 'bg-amber-400'
              : elem.type === 'xenon_strobe'
              ? 'bg-sky-400'
              : elem.type === 'static_halogen'
              ? 'bg-orange-500'
              : 'bg-emerald-400';
          return (
            <button
              key={elem.id}
              onClick={() => onSelectElement(elem.id)}
              className={`flex items-center gap-1.5 px-2 py-1 border text-[10px] font-mono whitespace-nowrap rounded-none cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-zinc-800 text-white border-zinc-500 font-bold'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <span className={`w-2 h-2 ${typeDot} ${!elem.enabled ? 'opacity-30' : ''}`} />
              <span>{elem.name}</span>
            </button>
          );
        })}
      </div>

      {/* Active Element Properties */}
      <div className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-2">
        {/* Row 1: Name, Type, Enable */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 sm:col-span-1">
            <span className="text-zinc-400 text-[10px] w-12 shrink-0">NAME:</span>
            <input
              type="text"
              value={activeElement.name}
              onChange={(e) => handleUpdateActive({ name: e.target.value })}
              className="flex-1 bg-black border border-zinc-700 px-1.5 py-0.5 text-zinc-200 text-xs font-mono focus:outline-none focus:border-amber-500 rounded-none"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:col-span-1">
            <span className="text-zinc-400 text-[10px] w-12 shrink-0">TYPE:</span>
            <select
              value={activeElement.type}
              onChange={(e) => handleTypeChange(e.target.value as ElementType)}
              className="flex-1 bg-black border border-zinc-700 px-1.5 py-0.5 text-zinc-200 text-[11px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
            >
              <option value="rotating_halogen">Rotating Halogen</option>
              <option value="static_halogen">Static Halogen Flasher</option>
              <option value="xenon_strobe">Xenon Strobe Tube</option>
              <option value="modern_led">Modern High-Output LED</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-1.5 sm:col-span-1">
            <button
              onClick={() => handleUpdateActive({ enabled: !activeElement.enabled })}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 border font-mono text-[10px] font-bold rounded-none cursor-pointer ${
                activeElement.enabled
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{activeElement.enabled ? 'POWER ON' : 'DISABLED'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Position (X & Y), Micro-nudge buttons */}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-1.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">HORIZONTAL X:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveX(-0.02)}
                  className="px-1 bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-[9px]"
                  title="Nudge Left"
                >
                  <ChevronLeft className="w-2.5 h-2.5" />
                </button>
                <span className="text-zinc-200 font-bold font-mono">
                  {(activeElement.xNorm * 100).toFixed(1)}%
                </span>
                <button
                  onClick={() => handleMoveX(0.02)}
                  className="px-1 bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-[9px]"
                  title="Nudge Right"
                >
                  <ChevronRight className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0.02}
              max={0.98}
              step={0.01}
              value={activeElement.xNorm}
              onChange={(e) => handleUpdateActive({ xNorm: parseFloat(e.target.value) })}
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">BRIGHTNESS:</span>
              <span className="text-zinc-200 font-bold font-mono">
                {activeElement.brightness.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={3.0}
              step={0.05}
              value={activeElement.brightness}
              onChange={(e) => handleUpdateActive({ brightness: parseFloat(e.target.value) })}
              className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
            />
          </div>
        </div>

        {/* Row 3: Sync Group & Subglass Color */}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-1.5">
          <div className="space-y-1">
            <span className="text-zinc-400 text-[10px]">SEQUENCER SYNC GROUP:</span>
            <div className="flex items-center gap-1">
              {(['A', 'B', 'C', 'STEADY', 'INDEPENDENT'] as SyncGroup[]).map((grp) => (
                <button
                  key={grp}
                  onClick={() => handleUpdateActive({ syncGroup: grp })}
                  className={`flex-1 py-0.5 border text-[9px] font-mono font-bold rounded-none cursor-pointer ${
                    activeElement.syncGroup === grp
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-black text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">SUBGLASS OPTIC INSERT:</span>
              {activeElement.subglassColor && (
                <button
                  onClick={() => handleUpdateActive({ subglassColor: null })}
                  className="text-zinc-500 hover:text-red-400 text-[9px] underline"
                >
                  REMOVE
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={activeElement.subglassColor || '#dc2626'}
                onChange={(e) => handleUpdateActive({ subglassColor: e.target.value })}
                className="w-4 h-4 border border-zinc-700 cursor-pointer bg-transparent rounded-none"
              />
              <input
                type="text"
                value={activeElement.subglassColor || 'NONE (RAW)'}
                onChange={(e) => handleUpdateActive({ subglassColor: e.target.value })}
                className="flex-1 bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500 rounded-none"
              />
            </div>
          </div>
        </div>

        {/* --- TYPE-SPECIFIC MODULES --- */}

        {/* 1. ROTATING HALOGEN CONFIG */}
        {activeElement.type === 'rotating_halogen' && activeElement.rotator && (
          <div className="border border-zinc-800 bg-black/60 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-400 border-b border-zinc-800 pb-1">
              <span className="flex items-center gap-1">
                <RotateCw className="w-3 h-3" />
                MECHANICAL ROTATOR MOTOR & REFLECTOR
              </span>
              <button
                onClick={() =>
                  handleUpdateActive({
                    rotator: {
                      ...activeElement.rotator!,
                      rotationDirection: activeElement.rotator!.rotationDirection === 1 ? -1 : 1,
                    },
                  })
                }
                className="px-1.5 py-0.2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-[9px] cursor-pointer"
              >
                DIR: {activeElement.rotator.rotationDirection === 1 ? 'CW' : 'CCW'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>RPM</span>
                  <span className="text-zinc-200 font-bold">{activeElement.rotator.rpm}</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={240}
                  step={5}
                  value={activeElement.rotator.rpm}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: { ...activeElement.rotator!, rpm: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>SPREAD</span>
                  <span className="text-zinc-200 font-bold">{activeElement.rotator.beamSpreadDeg}°</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={2}
                  value={activeElement.rotator.beamSpreadDeg}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: {
                        ...activeElement.rotator!,
                        beamSpreadDeg: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>PHASE</span>
                  <span className="text-zinc-200 font-bold">{activeElement.rotator.phaseOffsetDeg}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={355}
                  step={5}
                  value={activeElement.rotator.phaseOffsetDeg}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: {
                        ...activeElement.rotator!,
                        phaseOffsetDeg: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-amber-500 rounded-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[9px]">REFLECTOR DISH</span>
                <select
                  value={activeElement.rotator.reflectorType}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: {
                        ...activeElement.rotator!,
                        reflectorType: e.target.value as RotatorConfig['reflectorType'],
                      },
                    })
                  }
                  className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
                >
                  <option value="parabolic_dish">Parabolic Dish</option>
                  <option value="sealed_beam_par36">PAR-36 Sealed Beam</option>
                  <option value="par46">PAR-46 Heavy Dish</option>
                  <option value="dual_sided_mirror">Dual-Sided Mirror</option>
                </select>
              </div>

              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[9px]">FINISH</span>
                <select
                  value={activeElement.rotator.reflectorFinish}
                  onChange={(e) =>
                    handleUpdateActive({
                      rotator: {
                        ...activeElement.rotator!,
                        reflectorFinish: e.target.value as RotatorConfig['reflectorFinish'],
                      },
                    })
                  }
                  className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
                >
                  <option value="chrome">Mirror Chrome</option>
                  <option value="polished_aluminum">Polished Aluminum</option>
                  <option value="patina_aged">Aged Patina</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 2. STATIC HALOGEN FLASHER */}
        {activeElement.type === 'static_halogen' && activeElement.halogen && (
          <div className="border border-zinc-800 bg-black/60 p-2 space-y-1.5">
            <span className="text-[10px] font-bold text-orange-400 block border-b border-zinc-800 pb-1">
              FILAMENT THERMAL INERTIA
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>RISE TIME</span>
                  <span className="text-zinc-200">{activeElement.halogen.filamentThermalRiseMs}ms</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
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
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-orange-500 rounded-none"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>FALL TIME</span>
                  <span className="text-zinc-200">{activeElement.halogen.filamentThermalFallMs}ms</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={350}
                  step={5}
                  value={activeElement.halogen.filamentThermalFallMs}
                  onChange={(e) =>
                    handleUpdateActive({
                      halogen: {
                        ...activeElement.halogen!,
                        filamentThermalFallMs: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-orange-500 rounded-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. XENON STROBE TUBE */}
        {activeElement.type === 'xenon_strobe' && activeElement.strobe && (
          <div className="border border-zinc-800 bg-black/60 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-sky-400 border-b border-zinc-800 pb-1">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                XENON GAS DISCHARGE TUBE
              </span>
              <div className="flex items-center gap-1">
                {(['single', 'double', 'triple', 'quad'] as XenonStrobeConfig['burstPattern'][]).map(
                  (pat) => (
                    <button
                      key={pat}
                      onClick={() =>
                        handleUpdateActive({
                          strobe: { ...activeElement.strobe!, burstPattern: pat },
                        })
                      }
                      className={`px-1.5 py-0.2 border text-[9px] uppercase cursor-pointer ${
                        activeElement.strobe!.burstPattern === pat
                          ? 'bg-sky-500 text-black border-sky-400 font-bold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {pat}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>ENERGY (JOULES)</span>
                  <span className="text-zinc-200">{activeElement.strobe.joules}J</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={35}
                  step={1}
                  value={activeElement.strobe.joules}
                  onChange={(e) =>
                    handleUpdateActive({
                      strobe: { ...activeElement.strobe!, joules: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-sky-500 rounded-none"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>PULSE DURATION</span>
                  <span className="text-zinc-200">{activeElement.strobe.flashDurationMs}ms</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={25}
                  step={1}
                  value={activeElement.strobe.flashDurationMs}
                  onChange={(e) =>
                    handleUpdateActive({
                      strobe: {
                        ...activeElement.strobe!,
                        flashDurationMs: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-sky-500 rounded-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. MODERN LED */}
        {activeElement.type === 'modern_led' && activeElement.led && (
          <div className="border border-zinc-800 bg-black/60 p-2 space-y-1.5">
            <span className="text-[10px] font-bold text-emerald-400 block border-b border-zinc-800 pb-1">
              SOLID-STATE LED ARRAY
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>DIODE COUNT</span>
                  <span className="text-zinc-200">{activeElement.led.diodeCount}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={18}
                  step={1}
                  value={activeElement.led.diodeCount}
                  onChange={(e) =>
                    handleUpdateActive({
                      led: { ...activeElement.led!, diodeCount: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-emerald-500 rounded-none"
                />
              </div>

              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[9px]">OPTIC LENS</span>
                <select
                  value={activeElement.led.opticLens}
                  onChange={(e) =>
                    handleUpdateActive({
                      led: { ...activeElement.led!, opticLens: e.target.value as LedConfig['opticLens'] },
                    })
                  }
                  className="w-full bg-black border border-zinc-700 px-1 py-0.5 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500 cursor-pointer rounded-none"
                >
                  <option value="tir">TIR Directional Collimator</option>
                  <option value="linear">Linear Wide Angle</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
