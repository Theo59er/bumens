import React from 'react';
import { 
  Usb, 
  Activity, 
  Sparkles, 
  FileCode, 
  KeyRound, 
  Download, 
  Upload, 
  Play, 
  Pause, 
  Trash2,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Bot,
  ArrowLeftRight
} from 'lucide-react';
import { ConnectedDeviceInfo } from '../types/protocol';

interface HeaderProps {
  deviceInfo: ConnectedDeviceInfo | null;
  packetCount: number;
  isCapturing: boolean;
  onToggleCapture: () => void;
  onClearPackets: () => void;
  onOpenConnectModal: () => void;
  onOpenAiModal: () => void;
  onOpenDriverModal: () => void;
  onOpenSeedKeyModal: () => void;
  onOpenLmStudioModal: () => void;
  onOpenSerialBridgeModal: () => void;
  onLoadSampleTrace: () => void;
  onExportTrace: () => void;
  onImportTrace: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  deviceInfo,
  packetCount,
  isCapturing,
  onToggleCapture,
  onClearPackets,
  onOpenConnectModal,
  onOpenAiModal,
  onOpenDriverModal,
  onOpenSeedKeyModal,
  onOpenLmStudioModal,
  onOpenSerialBridgeModal,
  onLoadSampleTrace,
  onExportTrace,
  onImportTrace,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 select-none">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-emerald-500 p-0.5 shadow-lg shadow-cyan-950/50">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Usb className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                USB-TraceLab
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                  ECU & URB Inspector
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Protokollanalyse, URB-Sniffer &amp; Treiber-Entwicklung für Fahrzeugsteuergeräte
            </p>
          </div>
        </div>

        {/* Hardware Status Pill */}
        <div className="flex items-center gap-2">
          {deviceInfo ? (
            <div 
              onClick={onOpenConnectModal}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 cursor-pointer hover:bg-emerald-900/40 transition"
              title="Klicken für Gerätedetails"
            >
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white">{deviceInfo.name}</span>
                {deviceInfo.vendorId && (
                  <span className="text-emerald-400/90 ml-1.5 text-[11px] font-mono">
                    [{deviceInfo.vendorId}:{deviceInfo.productId}]
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenConnectModal}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              <Usb className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hardware / Adapter verbinden</span>
            </button>
          )}

          {/* Capture Controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={onToggleCapture}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                isCapturing
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              }`}
              title={isCapturing ? 'Aufzeichnung anhalten' : 'Aufzeichnung starten'}
            >
              {isCapturing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isCapturing ? 'Pause' : 'Sniffing'}</span>
            </button>

            <button
              onClick={onClearPackets}
              disabled={packetCount === 0}
              className="p-1.5 text-slate-400 hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Paketpuffer leeren"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <button
            onClick={onLoadSampleTrace}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Lade realistischen Motorrad-ECU Flashing-Trace"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Beispiel-Trace</span>
          </button>

          <button
            onClick={onOpenSeedKeyModal}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Seed-Key Challenge-Response Algorithmus-Sandbox"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Seed-Key Lab</span>
          </button>

          <button
            onClick={onOpenLmStudioModal}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-200 flex items-center gap-1.5 transition cursor-pointer"
            title="LM Studio & MCP Schnittstelle konfigurieren"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>LM Studio (MCP)</span>
          </button>

          <button
            onClick={onOpenSerialBridgeModal}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Virtuelle COM-Port-Brücke & Passthrough-Proxy für Windows"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>COM-Proxy (Brücke)</span>
          </button>

          <button
            onClick={onOpenDriverModal}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Generiere C# / C++ Open-Source Treibercode"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Treiber generieren</span>
          </button>

          <button
            onClick={onOpenAiModal}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-purple-950/40 transition cursor-pointer"
            title="KI-Analyse mit Gemini starten"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>KI-Protokollanalyse</span>
          </button>

          {/* Export / Import */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
            <button
              onClick={onExportTrace}
              disabled={packetCount === 0}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition cursor-pointer"
              title="Trace exportieren (JSON/PCAP)"
            >
              <Download className="w-4 h-4" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onImportTrace} 
              accept=".json,.txt" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Trace importieren"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
