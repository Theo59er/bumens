import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  Unlock, 
  AlertCircle,
  Binary,
  Layers,
  ChevronRight
} from 'lucide-react';
import { URBPacket } from '../types/protocol';

interface PacketTableProps {
  packets: URBPacket[];
  selectedPacket: URBPacket | null;
  onSelectPacket: (packet: URBPacket) => void;
}

export const PacketTable: React.FC<PacketTableProps> = ({
  packets,
  selectedPacket,
  onSelectPacket,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const tableBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new packets arrive
  useEffect(() => {
    if (autoScroll && tableBottomRef.current) {
      tableBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packets.length, autoScroll]);

  const filteredPackets = useMemo(() => {
    return packets.filter((p) => {
      // Direction filter
      if (directionFilter === 'IN' && p.direction !== 'DEVICE_TO_HOST') return false;
      if (directionFilter === 'OUT' && p.direction !== 'HOST_TO_DEVICE') return false;

      // Tag filter
      if (tagFilter !== 'ALL') {
        if (tagFilter === 'SECURITY' && !p.protocolTag?.includes('0x27') && !p.protocolTag?.includes('0x67')) return false;
        if (tagFilter === 'SESSION' && !p.protocolTag?.includes('0x10') && !p.protocolTag?.includes('0x50')) return false;
        if (tagFilter === 'FLASH' && !p.protocolTag?.includes('0x34') && !p.protocolTag?.includes('0x36') && !p.protocolTag?.includes('0x74') && !p.protocolTag?.includes('0x76')) return false;
        if (tagFilter === 'IDENT' && !p.protocolTag?.includes('0x1A') && !p.protocolTag?.includes('0x5A') && !p.protocolTag?.includes('0x22') && !p.protocolTag?.includes('0x62')) return false;
        if (tagFilter === 'ERRORS' && !p.isError && !p.protocolTag?.includes('0x7F')) return false;
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().replace(/\s+/g, '');
        const hex = p.hexString.toLowerCase().replace(/\s+/g, '');
        const ascii = p.asciiString.toLowerCase();
        const tag = (p.protocolTag || '').toLowerCase();
        const summary = (p.decodedSummary || '').toLowerCase();

        return (
          hex.includes(term) ||
          ascii.includes(term) ||
          tag.includes(term) ||
          summary.includes(term) ||
          p.packetNumber.toString().includes(term)
        );
      }

      return true;
    });
  }, [packets, directionFilter, tagFilter, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Table Toolbar */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Hex, ASCII, Dienst oder Text suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5">
          {/* Direction Filter */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setDirectionFilter('ALL')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                directionFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Alle ({packets.length})
            </button>
            <button
              onClick={() => setDirectionFilter('OUT')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                directionFilter === 'OUT'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-3 h-3 text-cyan-400" />
              <span>OUT (Host)</span>
            </button>
            <button
              onClick={() => setDirectionFilter('IN')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                directionFilter === 'IN'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
              <span>IN (ECU)</span>
            </button>
          </div>

          {/* Service Filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 text-[11px] focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Dienste: Alle</option>
            <option value="SECURITY">0x27 SecurityAccess (Seed/Key)</option>
            <option value="SESSION">0x10 DiagnosticSession</option>
            <option value="IDENT">0x1A/0x22 Identifikation</option>
            <option value="FLASH">0x34/0x36 Flash-Download</option>
            <option value="ERRORS">Fehler / NRC 0x7F</option>
          </select>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer ${
              autoScroll
                ? 'bg-slate-800 border-slate-700 text-cyan-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={autoScroll ? 'Auto-Scroll aktiv' : 'Auto-Scroll pausiert'}
          >
            {autoScroll ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 text-slate-400 text-[11px] sticky top-0 z-10 border-b border-slate-800 select-none">
            <tr>
              <th className="py-2 px-3 w-12 text-slate-500 font-semibold">#</th>
              <th className="py-2 px-3 w-28 text-slate-500 font-semibold">Zeit (Delta)</th>
              <th className="py-2 px-3 w-28 text-slate-500 font-semibold">Richtung</th>
              <th className="py-2 px-3 w-24 text-slate-500 font-semibold">Endpunkt</th>
              <th className="py-2 px-2 w-14 text-slate-500 font-semibold text-right">Bytes</th>
              <th className="py-2 px-3 w-40 text-slate-500 font-semibold">Dienst / Tag</th>
              <th className="py-2 px-3 font-semibold text-slate-400">Hex-Datenstrom</th>
              <th className="py-2 px-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredPackets.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Binary className="w-8 h-8 text-slate-600 stroke-1" />
                    <span>Keine Pakete im Puffer oder Filter schließt alle aus.</span>
                    <span className="text-[11px] text-slate-600">
                      Verbinde ein USB-Gerät oder lade einen Beispiel-Trace.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPackets.map((pkt) => {
                const isSelected = selectedPacket?.id === pkt.id;
                const isHost = pkt.direction === 'HOST_TO_DEVICE';

                return (
                  <tr
                    key={pkt.id}
                    onClick={() => onSelectPacket(pkt)}
                    className={`cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-cyan-950/70 border-l-4 border-cyan-400 text-white'
                        : pkt.isError
                        ? 'bg-rose-950/20 hover:bg-rose-950/40 text-rose-200'
                        : isHost
                        ? 'hover:bg-slate-800/60 text-slate-200'
                        : 'hover:bg-emerald-950/20 text-slate-200'
                    }`}
                  >
                    {/* Index */}
                    <td className="py-1.5 px-3 text-slate-500 text-[11px]">
                      {pkt.packetNumber}
                    </td>

                    {/* Timestamp & Delta */}
                    <td className="py-1.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                      <span className="text-slate-300">
                        {new Date(pkt.timestamp).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <span className="text-slate-500 ml-1">
                        (+{pkt.deltaMs}ms)
                      </span>
                    </td>

                    {/* Direction Badge */}
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      {isHost ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                          <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                          <span>HOST &rarr; DEV</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                          <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                          <span>DEV &rarr; HOST</span>
                        </span>
                      )}
                    </td>

                    {/* Endpoint */}
                    <td className="py-1.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {pkt.endpoint}
                    </td>

                    {/* Length */}
                    <td className="py-1.5 px-2 text-right text-slate-400 font-semibold text-[11px]">
                      {pkt.byteCount}
                    </td>

                    {/* Protocol Tag */}
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      {pkt.protocolTag ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            pkt.protocolTag.includes('0x27') || pkt.protocolTag.includes('0x67')
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                              : pkt.protocolTag.includes('0x10') || pkt.protocolTag.includes('0x50')
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/80'
                              : pkt.protocolTag.includes('Flash') || pkt.protocolTag.includes('0x36')
                              ? 'bg-purple-950 text-purple-300 border border-purple-800/80'
                              : pkt.isError
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/80'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {pkt.protocolTag}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Hex Stream & Summary */}
                    <td className="py-1.5 px-3 overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className="text-cyan-300 font-medium tracking-wide">
                        {pkt.hexString.length > 40
                          ? pkt.hexString.substring(0, 40) + ' ...'
                          : pkt.hexString}
                      </span>
                      {pkt.decodedSummary && (
                        <span className="text-slate-400 font-sans ml-2 text-[11px]">
                          &mdash; {pkt.decodedSummary}
                        </span>
                      )}
                    </td>

                    {/* Chevron */}
                    <td className="py-1.5 px-3 text-right">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div ref={tableBottomRef} />
      </div>

      {/* Footer Status Bar */}
      <div className="px-4 py-2 bg-slate-950 text-slate-400 text-[11px] border-t border-slate-800 flex items-center justify-between">
        <div>
          <span>{filteredPackets.length} von {packets.length} Paketen angezeigt</span>
          {searchTerm && <span className="text-cyan-400 ml-2">(Gefiltert nach "{searchTerm}")</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span> Host OUT
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Device IN
          </span>
        </div>
      </div>
    </div>
  );
};
