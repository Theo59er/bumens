import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  RotateCcw, 
  FileCode, 
  Cpu, 
  ShieldAlert, 
  Lightbulb,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { URBPacket, ConnectedDeviceInfo } from '../types/protocol';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  packets: URBPacket[];
  deviceInfo: ConnectedDeviceInfo | null;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  onClose,
  packets,
  deviceInfo,
}) => {
  const [analysisText, setAnalysisText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<string>('Motorrad Steuergerät (K-Line / KWP2000 / UDS Flashing-Protokoll)');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && !analysisText && packets.length > 0) {
      runAnalysis();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        packets: packets.slice(0, 35).map((p) => ({
          timestamp: p.deltaMs,
          direction: p.direction === 'HOST_TO_DEVICE' ? 'HOST->DEV (OUT)' : 'DEV->HOST (IN)',
          endpoint: p.endpoint,
          type: p.transferType,
          hexData: p.hexString,
          ascii: p.asciiString,
          dataLength: p.byteCount,
        })),
        targetContext: userContext,
        deviceDetails: deviceInfo
          ? `${deviceInfo.name} (${deviceInfo.vendorId || ''}:${deviceInfo.productId || ''})`
          : 'USB Diagnostic Adapter',
      };

      const res = await fetch('/api/analyze-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Serverfehler bei der Protokollanalyse');
      }

      setAnalysisText(data.analysis);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Abrufen der KI-Analyse');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAnalysis = () => {
    navigator.clipboard.writeText(analysisText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                KI-Protokollanalyse &amp; Reverse-Engineering
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Gemini Flash 3.8
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Automatische Erkennung von Framing, Kommandos, Seed-Key Mechanismen und Treibercode
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {analysisText && (
              <button
                onClick={copyAnalysis}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <span className="text-slate-400 whitespace-nowrap font-medium">Zielkontext:</span>
            <input
              type="text"
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="z.B. BMW Motorrad BMS-K1200 K-Line ECU"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">
              {packets.length} Pakete im Puffer ({Math.min(packets.length, 35)} übermittelt)
            </span>
            <button
              onClick={runAnalysis}
              disabled={isLoading || packets.length === 0}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analysiere...' : 'Neu analysieren'}</span>
            </button>
          </div>
        </div>

        {/* Analysis Body */}
        <div className="flex-1 overflow-y-auto p-6 font-sans text-sm leading-relaxed space-y-4">
          {isLoading && (
            <div className="h-64 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                <Sparkles className="w-5 h-5 text-purple-400 absolute inset-0 m-auto" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-200">Gemini analysiert USB-Paketstrom...</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Erkennung von Header-Strukturen, Service-IDs (UDS/KWP2000), Seed-Key-Transformationen und Prüfsummen.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Analysefehler</div>
                <p className="mt-1 text-rose-300/90">{error}</p>
                <button
                  onClick={runAnalysis}
                  className="mt-3 px-3 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-medium"
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && analysisText && (
            <div className="prose prose-invert prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 max-w-none text-slate-300 space-y-4 text-xs">
              {/* Render formatted markdown blocks */}
              {analysisText.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('```')) {
                  const cleanedCode = paragraph.replace(/```[a-z0-9]*\n?/gi, '').replace(/```$/g, '');
                  return (
                    <div key={idx} className="relative group my-3">
                      <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300">
                        <code>{cleanedCode}</code>
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cleanedCode);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 opacity-80 hover:opacity-100 transition"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Code kopieren</span>
                      </button>
                    </div>
                  );
                }

                if (paragraph.startsWith('### ') || paragraph.startsWith('## ') || paragraph.startsWith('# ')) {
                  const heading = paragraph.replace(/^#+\s*/, '');
                  return (
                    <h3 key={idx} className="text-sm font-bold text-white border-b border-slate-800 pb-1 mt-4 flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-purple-500 rounded-full inline-block" />
                      {heading}
                    </h3>
                  );
                }

                return (
                  <p key={idx} className="leading-relaxed text-slate-300 text-xs">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          )}

          {!isLoading && !error && !analysisText && packets.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
              <Cpu className="w-10 h-10 stroke-1 mb-2" />
              <p className="font-medium text-slate-400">Keine Pakete zur Analyse vorhanden</p>
              <p className="text-xs text-slate-600 mt-1">
                Laden Sie einen Beispiel-Trace oder zeichnen Sie Live-Pakete auf, um die KI-Auswertung zu starten.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
