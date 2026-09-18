import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Copy,
  Check,
  AlertTriangle,
  FileCode,
  Save,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import { LightbarConfig } from '../types';
import {
  validateLightbarConfig,
  getJsonSchemaDefinition,
  ValidationResult,
  SCHEMA_VERSION,
} from '../utils/schemaValidator';

interface ImportExportPanelProps {
  currentConfig: LightbarConfig;
  onApplyConfig: (config: LightbarConfig) => void;
}

const STORAGE_KEY = 'emergency_lightbar_user_presets';

interface SavedPresetItem {
  id: string;
  name: string;
  savedAt: string;
  config: LightbarConfig;
}

export const ImportExportPanel: React.FC<ImportExportPanelProps> = ({
  currentConfig,
  onApplyConfig,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'import' | 'presets' | 'schema'>('export');
  const [copied, setCopied] = useState<boolean>(false);
  const [rawJsonInput, setRawJsonInput] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [presetNameInput, setPresetNameInput] = useState<string>(currentConfig.name);
  const [savedPresets, setSavedPresets] = useState<SavedPresetItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Prepare Export JSON string
  const exportPayload = {
    schemaVersion: SCHEMA_VERSION,
    ...currentConfig,
  };
  const exportJsonStr = JSON.stringify(exportPayload, null, 2);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportJsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportJsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = currentConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    link.download = `lightbar_${safeName}_${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateRawInput = (text: string) => {
    setRawJsonInput(text);
    if (!text.trim()) {
      setValidationResult(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const res = validateLightbarConfig(parsed);
      setValidationResult(res);
    } catch (err: unknown) {
      setValidationResult({
        valid: false,
        errors: [
          {
            path: '$',
            message: `JSON Syntax Error: ${err instanceof Error ? err.message : 'Invalid JSON format'}`,
          },
        ],
        warnings: [],
        sanitizedConfig: null,
        summary: {
          name: 'Invalid',
          era: 'Invalid',
          structureType: 'Invalid',
          domesCount: 0,
          elementsCount: 0,
          schemaVersion: SCHEMA_VERSION,
        },
      });
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleValidateRawInput(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleApplyImported = () => {
    if (!validationResult) return;
    if (validationResult.valid && validationResult.sanitizedConfig) {
      onApplyConfig(validationResult.sanitizedConfig);
      alert(`Applied configuration: "${validationResult.sanitizedConfig.name}"`);
    } else if (validationResult.sanitizedConfig) {
      // Allow applying sanitized version with warning
      onApplyConfig(validationResult.sanitizedConfig);
      alert(`Applied auto-sanitized configuration: "${validationResult.sanitizedConfig.name}"`);
    }
  };

  const handleSaveToLocal = () => {
    const name = presetNameInput.trim() || currentConfig.name;
    const newPreset: SavedPresetItem = {
      id: `preset_${Date.now()}`,
      name,
      savedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      config: { ...currentConfig, name },
    };
    const updated = [newPreset, ...savedPresets.filter((p) => p.name !== name)];
    setSavedPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // LocalStorage error
    }
  };

  const handleDeleteSavedPreset = (id: string) => {
    const updated = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // LocalStorage error
    }
  };

  return (
    <div id="import-export-panel" className="space-y-2 text-xs font-mono select-none">
      {/* Sub-tabs header */}
      <div className="flex items-center border border-zinc-800 bg-zinc-950 p-0.5 gap-0.5">
        {[
          { id: 'export', label: 'EXPORT JSON', icon: Download },
          { id: 'import', label: 'IMPORT CONFIG', icon: Upload },
          { id: 'presets', label: `SAVED (${savedPresets.length})`, icon: Save },
          { id: 'schema', label: 'SCHEMA SPEC', icon: FileCode },
        ].map((tab) => {
          const active = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`subtab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 font-mono text-[11px] font-bold border transition-colors cursor-pointer rounded-none ${
                active
                  ? 'bg-zinc-800 text-white border-zinc-600 shadow-xs'
                  : 'bg-zinc-950 text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. EXPORT SUBTAB */}
      {activeSubTab === 'export' && (
        <div className="space-y-2 border border-zinc-800 bg-zinc-950 p-2.5">
          {/* Quick Metrics Line */}
          <div className="flex items-center justify-between text-[11px] border-b border-zinc-800 pb-1.5 text-zinc-400">
            <div>
              <span className="text-zinc-500">CONFIG: </span>
              <span className="text-zinc-200 font-bold">{currentConfig.name}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span>DOMES: {currentConfig.domes.length}</span>
              <span>EMITTERS: {currentConfig.elements.length}</span>
              <span>SCHEMA: v{SCHEMA_VERSION}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="btn-download-json"
              onClick={handleDownloadExport}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-xs border border-amber-400 cursor-pointer rounded-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD .JSON FILE</span>
            </button>

            <button
              id="btn-copy-json"
              onClick={handleCopyExport}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 font-mono font-bold text-xs border border-zinc-700 cursor-pointer rounded-none"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>

          {/* Raw JSON Preview */}
          <div className="relative border border-zinc-800 bg-black p-2 max-h-72 overflow-y-auto font-mono text-[10px] text-zinc-300 leading-relaxed">
            <pre>{exportJsonStr}</pre>
          </div>
        </div>
      )}

      {/* 2. IMPORT SUBTAB */}
      {activeSubTab === 'import' && (
        <div className="space-y-2 border border-zinc-800 bg-zinc-950 p-2.5">
          {/* File Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-3 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 text-zinc-400'
            }`}
          >
            <Upload className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
            <div className="font-bold text-[11px] text-zinc-200">DROP .JSON FILE HERE OR CLICK TO BROWSE</div>
            <div className="text-[10px] text-zinc-500">Validates against schema v{SCHEMA_VERSION}</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Paste JSON Textarea */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">OR PASTE JSON CONFIGURATION:</span>
              {rawJsonInput && (
                <button
                  onClick={() => handleValidateRawInput('')}
                  className="text-zinc-500 hover:text-zinc-300 text-[10px] underline"
                >
                  CLEAR
                </button>
              )}
            </div>
            <textarea
              id="import-json-textarea"
              rows={6}
              value={rawJsonInput}
              onChange={(e) => handleValidateRawInput(e.target.value)}
              placeholder='Paste JSON here, e.g. { "name": "Highway Patrol", "structure": { ... }, "domes": [...], "elements": [...] }'
              className="w-full bg-black border border-zinc-800 p-2 font-mono text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500 resize-y rounded-none"
            />
          </div>

          {/* Validation Status & Diagnostic Output */}
          {validationResult && (
            <div
              className={`border p-2 space-y-1.5 ${
                validationResult.valid
                  ? 'border-emerald-700/80 bg-emerald-950/40 text-emerald-300'
                  : validationResult.sanitizedConfig
                  ? 'border-amber-700/80 bg-amber-950/40 text-amber-300'
                  : 'border-red-700/80 bg-red-950/40 text-red-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[11px]">
                <div className="flex items-center gap-1.5">
                  {validationResult.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : validationResult.sanitizedConfig ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span>
                    {validationResult.valid
                      ? 'SCHEMA VALIDATION: PASSED'
                      : validationResult.sanitizedConfig
                      ? `SCHEMA ISSUES DETECTED (${validationResult.errors.length} ERRORS, REPAIRABLE)`
                      : 'SCHEMA VALIDATION: FAILED'}
                  </span>
                </div>

                <span className="font-mono text-[10px]">
                  {validationResult.summary.domesCount} DOMES | {validationResult.summary.elementsCount} EMITTERS
                </span>
              </div>

              {/* Error list */}
              {validationResult.errors.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] border-t border-zinc-800/80 pt-1">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="text-red-400 flex items-start gap-1 font-mono">
                      <span className="text-red-600">•</span>
                      <span className="font-bold">{err.path}:</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings list */}
              {validationResult.warnings.length > 0 && (
                <div className="max-h-20 overflow-y-auto space-y-0.5 text-[10px] text-amber-400/90 font-mono">
                  {validationResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-amber-600">⚠</span>
                      <span className="font-bold">{w.path}:</span>
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Apply Button */}
              <div className="pt-1">
                <button
                  id="btn-apply-imported-config"
                  onClick={handleApplyImported}
                  disabled={!validationResult.sanitizedConfig}
                  className={`w-full py-1.5 font-mono font-bold text-xs border rounded-none cursor-pointer transition-colors ${
                    validationResult.valid
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                      : validationResult.sanitizedConfig
                      ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                  }`}
                >
                  {validationResult.valid
                    ? 'APPLY TO SIMULATOR'
                    : 'AUTO-REPAIR & APPLY TO SIMULATOR'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. USER SAVED PRESETS */}
      {activeSubTab === 'presets' && (
        <div className="space-y-2 border border-zinc-800 bg-zinc-950 p-2.5">
          {/* Save Current as New Preset */}
          <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="Preset Name..."
              className="flex-1 bg-black border border-zinc-700 px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500 rounded-none"
            />
            <button
              id="btn-save-custom-preset"
              onClick={handleSaveToLocal}
              className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-xs border border-amber-400 cursor-pointer rounded-none"
            >
              <Save className="w-3.5 h-3.5" />
              <span>SAVE TO VAULT</span>
            </button>
          </div>

          {/* List of Saved Presets */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {savedPresets.length === 0 ? (
              <div className="text-center py-6 text-zinc-600 text-[11px]">
                NO USER PRESETS SAVED IN LOCAL STORAGE
              </div>
            ) : (
              savedPresets.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 border border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-zinc-200 text-[11px]">{item.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {item.config.era} • {item.config.structure.type} • {item.savedAt}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        onApplyConfig(item.config);
                        alert(`Loaded preset "${item.name}"`);
                      }}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 font-mono text-[10px] font-bold rounded-none cursor-pointer"
                    >
                      LOAD
                    </button>
                    <button
                      onClick={() => handleDeleteSavedPreset(item.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 border border-transparent hover:border-zinc-700 rounded-none cursor-pointer"
                      title="Delete preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. FORMAL JSON SCHEMA SPECIFICATION */}
      {activeSubTab === 'schema' && (
        <div className="space-y-2 border border-zinc-800 bg-zinc-950 p-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
            <span className="text-[11px] font-bold text-zinc-200">
              FORMAL JSON-SCHEMA DRAFT-07 SPECIFICATION
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(getJsonSchemaDefinition(), null, 2));
                alert('Schema definition copied to clipboard');
              }}
              className="px-2 py-0.5 bg-zinc-900 text-zinc-300 border border-zinc-700 hover:text-white text-[10px] font-mono cursor-pointer rounded-none"
            >
              COPY SPEC
            </button>
          </div>

          <div className="border border-zinc-800 bg-black p-2 max-h-72 overflow-y-auto text-[10px] text-zinc-400 leading-relaxed font-mono">
            <pre>{JSON.stringify(getJsonSchemaDefinition(), null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
