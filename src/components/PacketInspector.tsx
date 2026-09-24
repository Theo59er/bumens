import React, { useState, useEffect } from 'react';
import { 
  Binary, 
  Copy, 
  Check, 
  KeyRound, 
  Calculator, 
  ShieldCheck, 
  Layers, 
  Clock, 
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { URBPacket, ChecksumMatch } from '../types/protocol';
import { decodeAutomotiveFrame, bytesToHex, bytesToAscii } from '../utils/protocolDecoders';

interface PacketInspectorProps {
  packet: URBPacket | null;
  onSendToSeedKey: (hexString: string) => void;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({
  packet,
  onSendToSeedKey,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [checksumMatches, setChecksumMatches] = useState<ChecksumMatch[]>([]);
  const [isTestingChecksum, setIsTestingChecksum] = useState(false);

  useEffect(() => {
    if (!packet || packet.rawBytes.length < 2) {
      setChecksumMatches([]);
      return;
    }

    // Call server checksum guesser
    const checkChecksum = async () => {
      setIsTestingChecksum(true);
      try {
        const res = await fetch('/api/checksum-guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hexString: packet.hexString }),
        });
        if (res.ok) {
          const data = await res.json();
          setChecksumMatches(data.matches || []);
        }
      } catch (err) {
        console.warn('Checksum check error:', err);
      } finally {
        setIsTestingChecksum(false);
      }
    };

    checkChecksum();
  }, [packet?.id]);

  if (!packet) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
        <Binary className="w-10 h-10 mb-2 stroke-1 text-slate-600" />
        <p className="text-sm font-medium text-slate-400">Kein Paket ausgewählt</p>
        <p className="text-xs text-slate-600 max-w-xs mt-1">
          Klicken Sie auf ein URB-Paket in der Tabelle, um Hex-Offsets, Diagnosefelder und Prüfsummen zu analysieren.
        </p>
      </div>
    );
  }

  const decoded = decodeAutomotiveFrame(packet.rawBytes);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  };

  const getCSharpByteArray = () => {
    return `new byte[] { ${packet.rawBytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ')} };`;
  };

  const getCppByteArray = () => {
    return `uint8_t buffer[${packet.rawBytes.length}] = { ${packet.rawBytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ')} };`;
  };

  // Group bytes into 16-byte rows for the hex dump view
  const rows: Array<{ offset: number; bytes: number[] }> = [];
  for (let i = 0; i < packet.rawBytes.length; i += 16) {
    rows.push({
      offset: i,
      bytes: packet.rawBytes.slice(i, i + 16),
    });
  }

  const isSeedOrKey =
    packet.protocolTag?.includes('0x27') ||
    packet.protocolTag?.includes('0x67') ||
    packet.decodedSummary?.includes('Seed') ||
    packet.decodedSummary?.includes('Key');

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg text-slate-200">
      {/* Inspector Header */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            Paket #{packet.packetNumber} Detailanalyse
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            ({packet.byteCount} Bytes)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isSeedOrKey && (
            <button
              onClick={() => onSendToSeedKey(packet.hexString)}
              className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              title="Daten in die Seed-Key Sandbox übertragen"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>In Seed-Key Lab</span>
            </button>
          )}

          <button
            onClick={() => copyToClipboard(packet.hexString, 'hex')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Hex kopieren"
          >
            {copiedType === 'hex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Protocol Overview Banner */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-300">{decoded.tag}</span>
            <span className="font-mono text-[11px] text-slate-500">
              Endpunkt: {packet.endpoint} &bull; {packet.transferType}
            </span>
          </div>
          <p className="text-slate-300 leading-snug">{decoded.summary}</p>

          {decoded.isNegativeResponse && (
            <div className="mt-2 p-2 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Fehlercode 0x7F: {decoded.nrcDescription}</span>
            </div>
          )}
        </div>

        {/* 16-Byte Hex Dump Grid */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-slate-400 text-[11px] font-mono">
            <span>HEX DUMP (Offset / Hex / ASCII)</span>
            <span>16 Bytes / Zeile</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-x-auto space-y-1">
            {rows.map((row) => {
              const hexPart = row.bytes
                .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');
              const padding = '   '.repeat(16 - row.bytes.length);
              const asciiPart = bytesToAscii(row.bytes);

              return (
                <div key={row.offset} className="flex gap-4">
                  <span className="text-slate-600 select-none">
                    {row.offset.toString(16).padStart(4, '0').toUpperCase()}:
                  </span>
                  <span className="text-cyan-300 tracking-wider">
                    {hexPart}
                    {padding}
                  </span>
                  <span className="text-slate-400 border-l border-slate-800 pl-3 select-none">
                    {asciiPart}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checksum Analysis Box */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-indigo-400" />
              Prüfsummen-Detektor (Checksum Solver)
            </span>
            {isTestingChecksum && (
              <span className="text-[11px] text-slate-500 animate-pulse">Analysiere...</span>
            )}
          </div>

          {checksumMatches.length > 0 ? (
            <div className="space-y-1.5">
              {checksumMatches.map((m, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-emerald-950/40 border border-emerald-800/80 text-[11px] text-emerald-300 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">
                      {m.name} &mdash; Byte an Index [{m.byteIndex}] = {m.expected}
                    </div>
                    <div className="text-emerald-400/90 text-[10px] mt-0.5">{m.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              Keine Standard-Prüfsumme (Sum8, 2s-Complement, XOR, CRC8/16) am Frame-Ende gefunden.
            </div>
          )}
        </div>

        {/* Code Snippet Export Shortcuts */}
        <div className="space-y-1.5 pt-1">
          <div className="text-slate-400 text-[11px] font-medium">Als Quellcode-Array kopieren:</div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(getCSharpByteArray(), 'csharp')}
              className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copiedType === 'csharp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>C# Byte[]</span>
            </button>

            <button
              onClick={() => copyToClipboard(getCppByteArray(), 'cpp')}
              className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copiedType === 'cpp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>C++ uint8_t[]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
