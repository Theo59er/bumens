import React, { useState } from 'react';
import { 
  Send, 
  Play, 
  FastForward, 
  KeyRound, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Check, 
  AlertCircle,
  Upload,
  Download
} from 'lucide-react';
import { hardwareManager } from '../utils/hardwareManager';
import { parseHexInput, bytesToHex } from '../utils/protocolDecoders';
import { ConnectedDeviceInfo } from '../types/protocol';

interface InteractiveConsoleProps {
  deviceInfo: ConnectedDeviceInfo | null;
  onOpenConnectModal: () => void;
}

export const InteractiveConsole: React.FC<InteractiveConsoleProps> = ({
  deviceInfo,
  onOpenConnectModal,
}) => {
  const [hexInput, setHexInput] = useState('');
  const [autoChecksum, setAutoChecksum] = useState(false);
  const [isAutomating, setIsAutomating] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const handleSend = async (bytesToSend?: number[]) => {
    let raw = bytesToSend || parseHexInput(hexInput);
    if (raw.length === 0) return;

    if (autoChecksum && !bytesToSend) {
      let sum = 0;
      for (const b of raw) sum = (sum + b) & 0xff;
      raw = [...raw, sum];
    }

    try {
      await hardwareManager.sendPacket(raw);
      if (!bytesToSend) setHexInput('');
    } catch (err: any) {
      setStatusText(err?.message || 'Senden fehlgeschlagen');
      setTimeout(() => setStatusText(null), 3000);
    }
  };

  // Automated motorcycle ECU sequence runner
  const runAutomatedSequence = async () => {
    if (!deviceInfo) {
      onOpenConnectModal();
      return;
    }
    setIsAutomating(true);
    setStatusText('Sequenz läuft: Initialisierung...');

    try {
      // Step 1: FastInit
      await hardwareManager.sendPacket([0x81, 0x11, 0xF1, 0x81, 0x04]);
      await new Promise(r => setTimeout(r, 250));

      // Step 2: Start Programming Session (0x10 0x86)
      setStatusText('Sequenz läuft: DiagnosticSession Programming (0x10 0x86)...');
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x10, 0x86, 0x1A]);
      await new Promise(r => setTimeout(r, 250));

      // Step 3: Read ECU Identification (0x1A 0x9B)
      setStatusText('Sequenz läuft: ECU Identifikation lesen...');
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x1A, 0x9B, 0x3E]);
      await new Promise(r => setTimeout(r, 300));

      // Step 4: Request SecurityAccess Seed (0x27 0x01)
      setStatusText('Sequenz läuft: SecurityAccess Seed anfordern...');
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x27, 0x01, 0xAC]);
      await new Promise(r => setTimeout(r, 350));

      // Step 5: Calculate Key from active seed and send it!
      setStatusText('Sequenz läuft: Seed-Key berechnen & Freischaltung übertragen...');
      const seed = hardwareManager.getCurrentSimulatorSeed();
      const expectedKey = hardwareManager.calculateExpectedKey(seed);

      const keyPacket = [0x80, 0x11, 0xF1, 0x06, 0x27, 0x02, ...expectedKey];
      let sum = 0;
      for (const b of keyPacket) sum = (sum + b) & 0xff;
      keyPacket.push(sum);

      await hardwareManager.sendPacket(keyPacket);
      await new Promise(r => setTimeout(r, 300));

      // Step 6: Request Download (0x34)
      setStatusText('Sequenz läuft: RequestDownload (Flash Vorbereitung)...');
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x07, 0x34, 0x00, 0x44, 0x00, 0x08, 0x00, 0x00, 0xDF]);
      await new Promise(r => setTimeout(r, 250));

      // Step 7: TransferData Block #1 (0x36)
      setStatusText('Sequenz läuft: TransferData Flash-Block schreiben...');
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x0A, 0x36, 0x01, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x12, 0x34, 0x69]);
      await new Promise(r => setTimeout(r, 250));

      // Step 8: TesterPresent (0x3E)
      setStatusText('Sequenz abgeschlossen! Steuergerät erfolgreich ausgelesen.');
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x3E, 0x80, 0x42]);
      setTimeout(() => setStatusText(null), 4000);
    } catch (err: any) {
      setStatusText(`Fehler in Sequenz: ${err?.message}`);
      setTimeout(() => setStatusText(null), 4000);
    } finally {
      setIsAutomating(false);
    }
  };

  const handleSendKeyShortcut = () => {
    const seed = hardwareManager.getCurrentSimulatorSeed();
    const key = hardwareManager.calculateExpectedKey(seed);
    const packet = [0x80, 0x11, 0xF1, 0x06, 0x27, 0x02, ...key];
    let sum = 0;
    for (const b of packet) sum = (sum + b) & 0xff;
    packet.push(sum);
    handleSend(packet);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg text-slate-200">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Quick Diagnostic Macro Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 w-full lg:w-auto text-xs">
          <button
            onClick={() => handleSend([0x81, 0x11, 0xF1, 0x81, 0x04])}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition cursor-pointer"
            title="KWP2000 5-Baud / Fast Init"
          >
            FastInit (0x81)
          </button>

          <button
            onClick={() => handleSend([0x80, 0x11, 0xF1, 0x02, 0x10, 0x86, 0x1A])}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800 text-indigo-200 font-medium transition cursor-pointer"
            title="DiagnosticSession Programming Mode"
          >
            Session 0x86
          </button>

          <button
            onClick={() => handleSend([0x80, 0x11, 0xF1, 0x02, 0x1A, 0x9B, 0x3E])}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition cursor-pointer"
            title="Read ECU Identification (Software-Stand)"
          >
            Read Ident (0x1A)
          </button>

          <button
            onClick={() => handleSend([0x80, 0x11, 0xF1, 0x02, 0x27, 0x01, 0xAC])}
            className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-800 text-amber-200 font-medium transition cursor-pointer flex items-center gap-1"
            title="SecurityAccess: Seed von Steuergerät anfordern"
          >
            <KeyRound className="w-3 h-3 text-amber-400" />
            <span>Seed anfordern (0x27 0x01)</span>
          </button>

          <button
            onClick={handleSendKeyShortcut}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 font-medium transition cursor-pointer flex items-center gap-1"
            title="Berechnet Key für aktiven Seed und sendet 0x27 0x02"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Key berechnen &amp; senden</span>
          </button>

          <button
            onClick={() => handleSend([0x80, 0x11, 0xF1, 0x07, 0x35, 0x00, 0x44, 0x00, 0x08, 0x00, 0x00, 0xE0])}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 font-medium transition cursor-pointer flex items-center gap-1"
            title="RequestUpload: Flash Speicher auslesen (0x35)"
          >
            <Upload className="w-3 h-3 text-cyan-400" />
            <span>Flash Lesen (0x35)</span>
          </button>

          <button
            onClick={() => handleSend([0x80, 0x11, 0xF1, 0x07, 0x34, 0x00, 0x44, 0x00, 0x08, 0x00, 0x00, 0xDF])}
            className="px-2.5 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900 border border-purple-800 text-purple-200 font-medium transition cursor-pointer flex items-center gap-1"
            title="RequestDownload: Flash Speicher beschreiben (0x34)"
          >
            <Download className="w-3 h-3 text-purple-400" />
            <span>Flash Schreiben (0x34)</span>
          </button>

          {/* Automated Full Session */}
          <button
            onClick={runAutomatedSequence}
            disabled={isAutomating}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Führt vollständige Lese/Schreib-Sequenz automatisiert durch"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{isAutomating ? 'Läuft...' : 'Auto-Flash Session'}</span>
          </button>
        </div>

        {/* Manual Byte Transmission Input */}
        <div className="flex items-center gap-2 w-full lg:w-auto flex-1 max-w-xl">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Hex-Bytes eingeben (z. B. 80 11 F1 02 10 86 1A)"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <label className="flex items-center gap-1 text-[11px] text-slate-400 select-none cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={autoChecksum}
              onChange={(e) => setAutoChecksum(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500"
            />
            <span>+Sum8</span>
          </label>

          <button
            onClick={() => handleSend()}
            disabled={hexInput.trim() === ''}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Senden</span>
          </button>
        </div>
      </div>

      {statusText && (
        <div className="mt-2 text-xs font-medium text-cyan-400 bg-slate-950/80 px-3 py-1 rounded border border-slate-800 flex items-center gap-1.5 animate-in fade-in">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>{statusText}</span>
        </div>
      )}
    </div>
  );
};
