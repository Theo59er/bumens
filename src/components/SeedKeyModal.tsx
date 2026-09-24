import React, { useState, useMemo } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Search, 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Clock, 
  Tag, 
  FileText, 
  Copy, 
  Check, 
  Zap, 
  Cpu, 
  AlertTriangle,
  Flame,
  Download,
  Upload
} from 'lucide-react';
import { URBPacket, UserActionAnnotation } from '../types/protocol';
import { 
  KNOWN_SEED_KEY_PATTERNS, 
  matchSeedKeyAgainstKnownPatterns, 
  analyzeReadWriteSessions 
} from '../utils/knownPatterns';
import { parseHexInput, bytesToHex } from '../utils/protocolDecoders';
import { hardwareManager } from '../utils/hardwareManager';

interface SeedKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  packets: URBPacket[];
  initialHex?: string;
  userAnnotations: UserActionAnnotation[];
  onAddAnnotation: (annotation: UserActionAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
}

export const SeedKeyModal: React.FC<SeedKeyModalProps> = ({
  isOpen,
  onClose,
  packets,
  initialHex = '4A 7E 19 B2',
  userAnnotations,
  onAddAnnotation,
  onDeleteAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState<'patterns' | 'read_write' | 'timeline' | 'lm_studio'>('read_write');
  const [seedInput, setSeedInput] = useState<string>(initialHex);
  const [keyInput, setKeyInput] = useState<string>('9B 21 CE 5D');
  const [newActionLabel, setNewActionLabel] = useState<string>('');
  const [newActionCategory, setNewActionCategory] = useState<UserActionAnnotation['category']>('USER_CLICK');
  const [copied, setCopied] = useState(false);

  // Analyze the live packets for Flash Read/Write and SecurityAccess
  const flashSession = useMemo(() => analyzeReadWriteSessions(packets), [packets]);

  // If trace has detected seed and key, auto-populate inputs
  React.useEffect(() => {
    if (flashSession.securityState.seedBytes) {
      setSeedInput(bytesToHex(flashSession.securityState.seedBytes));
    }
    if (flashSession.securityState.keyBytes) {
      setKeyInput(bytesToHex(flashSession.securityState.keyBytes));
    }
  }, [flashSession]);

  // Match current seed and key against known patterns
  const patternMatches = useMemo(() => {
    const s = parseHexInput(seedInput);
    const k = parseHexInput(keyInput);
    return matchSeedKeyAgainstKnownPatterns(s, k);
  }, [seedInput, keyInput]);

  if (!isOpen) return null;

  const handleAddAnnotation = () => {
    if (!newActionLabel.trim()) return;
    const latestPacketNumber = packets.length > 0 ? packets[packets.length - 1].packetNumber : 0;
    const annotation: UserActionAnnotation = {
      id: `act_${Date.now()}`,
      timestamp: Date.now(),
      label: newActionLabel.trim(),
      category: newActionCategory,
      packetNumberAtAction: latestPacketNumber,
    };
    onAddAnnotation(annotation);
    setNewActionLabel('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate enriched prompt for LM Studio including user action context
  const getEnrichedLmStudioPrompt = () => {
    const s = parseHexInput(seedInput);
    const k = parseHexInput(keyInput);

    return `Du bist ein Reverse-Engineering- und Protokoll-Experte für Motorrad- und Fahrzeugsteuergeräte (KWP2000 / UDS ISO 14229).

=== BEOBACHTETE BENUTZER-AKTIONEN IM DIAGNOSE-PROGRAMM ===
${userAnnotations.length > 0 
  ? userAnnotations.map(a => `- Bei Paket #${a.packetNumberAtAction}: [${a.category}] ${a.label}`).join('\n')
  : '- (Keine manuellen Klick-Marker gesetzt; Standard Lese/Schreib-Ablauf)'}

=== ERMITTELTE SICHERHEITS-PARAMETER (SECURITYACCESS 0x27) ===
- Beobachteter Seed (vom Steuergerät gesendet): 0x${seedInput.replace(/\s+/g, '')}
- Beobachteter Key (vom Programm berechnet & gesendet): 0x${keyInput.replace(/\s+/g, '')}
- Entsperrung durch Steuergerät: ${flashSession.securityState.unlockConfirmed ? 'ERFOLGREICH (0x67 0x02 erhalten)' : 'Noch unbestätigt'}

=== LESE- UND SCHREIBVORGÄNGE (FLASH AUDIT) ===
- Gelesene Datenblöcke: ${flashSession.readOperations.dataBlockCount} (${flashSession.readOperations.totalBytesRead} Bytes)
- Geschriebene Datenblöcke: ${flashSession.writeOperations.dataBlockCount} (${flashSession.writeOperations.totalBytesWritten} Bytes)
- Startadresse: ${flashSession.writeOperations.startAddress || flashSession.readOperations.startAddress || '0x00440000'}

=== AUFTRAG AN DAS LOKALE MODELL ===
1. Korreliere die Benutzeraktionen mit den USB-Datenpaketen: Welcher Klick im Programm hat welche Übertragung ausgelöst?
2. Welches bekannte mathematische Muster (BMS-K Bit-Rotation, Bosch Endian-Swap, Siemens Additive Mask) passt zu diesem Seed-Key-Paar?
3. Schreibe eine verifizierte Python-Funktion 'calculate_key(seed: bytes) -> bytes', die für ${seedInput} exakt ${keyInput} zurückgibt.`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white shadow-md shadow-amber-950/50">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Seed-Key Lab: Lese-/Schreibanalyse &amp; Muster-Erkennung
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  UDS &amp; KWP2000
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Analyse von Lese- und Schreibvorgängen, bekannte Algorithmen &amp; Nutzer-Timeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-2 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('read_write')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'read_write'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Lese- &amp; Schreib-Audit</span>
            {flashSession.writeOperations.dataBlockCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[10px]">
                Flash aktiv
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('patterns')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'patterns'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Bekannte Muster-Datenbank</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
              {KNOWN_SEED_KEY_PATTERNS.length} Algorithmen
            </span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Nutzer-Aktions-Timeline ({userAnnotations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lm_studio')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'lm_studio'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>LM Studio Evaluierungs-Prompt</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {/* TAB 1: Lese- und Schreibvorgänge */}
          {activeTab === 'read_write' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Lese- und Schreibvorgangs-Inspektor</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {packets.length} Pakete im Puffer analysiert
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Steuergeräte erfordern vor dem Auslesen (Upload) oder Beschreiben (Download) zwingend eine erfolgreiche 
                  Seed-Key Freischaltung über den UDS Dienst <code className="text-amber-300 font-mono">0x27 SecurityAccess</code>.
                  Hier wird der gesamte Ablauf chronologisch aufgeschlüsselt.
                </p>
              </div>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Security Access Status */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                  flashSession.securityState.unlockConfirmed
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : flashSession.securityState.seedPacket
                    ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>1. SecurityAccess (0x27)</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {flashSession.securityState.unlockConfirmed
                      ? 'Freigeschaltet (0x67 OK)'
                      : flashSession.securityState.seedPacket
                      ? 'Seed angefordert'
                      : 'Nicht initiiert'}
                  </div>
                  <div className="text-[11px]">
                    Seed: <span className="font-mono text-cyan-300">{seedInput}</span> &bull; 
                    Key: <span className="font-mono text-emerald-300">{keyInput}</span>
                  </div>
                </div>

                {/* Read Operation Status */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>2. Lese-Vorgang (Upload)</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {flashSession.readOperations.dataBlockCount > 0
                      ? `${flashSession.readOperations.dataBlockCount} Blöcke empfangen`
                      : 'Kein Upload aktiv'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Gesamt: {flashSession.readOperations.totalBytesRead} Bytes ausgelesen
                  </div>
                </div>

                {/* Write Operation Status */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    <span>3. Schreib-Vorgang (Download)</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {flashSession.writeOperations.dataBlockCount > 0
                      ? `${flashSession.writeOperations.dataBlockCount} Blöcke geschrieben`
                      : 'Kein Download aktiv'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Adresse: <span className="font-mono text-purple-300">{flashSession.writeOperations.startAddress || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Detected Protocol Services in this session */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>In diesem Mitschnitt identifizierte UDS/KWP-Dienste:</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {flashSession.detectedServices.map((srv, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[11px]"
                    >
                      {srv}
                    </span>
                  ))}
                  {flashSession.detectedServices.length === 0 && (
                    <span className="text-slate-500 text-[11px]">Keine standardisierten Dienste erkannt.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Bekannte Muster & Algorithmen */}
          {activeTab === 'patterns' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Automatische Erkennung gegen bekannte Steuergeräte-Algorithmen</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Vergleicht den im USB-Mitschnitt beobachteten Seed mit dem gesendeten Key gegen bekannte 
                  Hersteller-Verfahren (BMW BMS-K, Bosch ME7/EDC15, Magneti Marelli, Siemens SIMOS, Keihin/Denso).
                </p>
              </div>

              {/* Inputs for Seed and Key */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ECU Seed (vom Steuergerät):
                  </label>
                  <input
                    type="text"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-cyan-300 focus:outline-none focus:border-amber-500"
                    placeholder="4A 7E 19 B2"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Erwarteter / Beobachteter Key (vom Programm gesendet):
                  </label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-emerald-300 focus:outline-none focus:border-amber-500"
                    placeholder="9B 21 CE 5D"
                  />
                </div>
              </div>

              {/* Pattern Matching Results List */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Ergebnis des Pattern-Matchers:
                </div>

                {patternMatches.map((m) => (
                  <div
                    key={m.pattern.id}
                    className={`p-3.5 rounded-xl border transition space-y-1.5 ${
                      m.isExactMatch
                        ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200 shadow-lg shadow-emerald-950/30'
                        : m.matchingByteCount > 0
                        ? 'bg-amber-950/20 border-amber-800/80 text-amber-200'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.isExactMatch ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 text-[11px] font-bold border border-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            100% EXAKTER TREFFER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {m.matchingByteCount} von 4 Bytes passend
                          </span>
                        )}
                        <span className="font-bold text-white text-xs">{m.pattern.name}</span>
                      </div>
                      <span className="font-mono text-xs">
                        Errechnet: <strong className="text-white">{bytesToHex(m.calculatedKey)}</strong>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">{m.pattern.description}</div>
                    <div className="p-2 rounded bg-slate-900/90 font-mono text-[11px] text-cyan-300 border border-slate-800">
                      Formel: {m.pattern.formulaDescription}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Nutzer-Aktions-Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Aktions-Marker: „Wann hast du was im Programm gedrückt?“</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Markieren Sie, welche Taste oder Aktion Sie in der Original-Software ausgeführt haben 
                  (z.B. „Zündung Ein“, „Steuergerät lesen“, „Schreiben bestätigen“). 
                  Dadurch kann das lokale KI-Modell die USB-Pakete den genauen Schritten des Anwenders zuordnen!
                </p>
              </div>

              {/* Add New Annotation Bar */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-white">Neue Benutzeraktion protokollieren:</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newActionLabel}
                    onChange={(e) => setNewActionLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAnnotation()}
                    placeholder="z. B. 'Kennfeld Schreiben' geklickt oder 'Bestätigungsdialog mit OK beantwortet'"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />

                  <select
                    value={newActionCategory}
                    onChange={(e) => setNewActionCategory(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="USER_CLICK">Klick im Programm</option>
                    <option value="READ">Lese-Vorgang starten</option>
                    <option value="WRITE">Schreib-Vorgang starten</option>
                    <option value="CONFIRM_DIALOG">Bestätigungs-Dialog</option>
                    <option value="SECURITY">Seed-Key Moment</option>
                    <option value="IDENT">Fahrzeug wählen</option>
                  </select>

                  <button
                    onClick={handleAddAnnotation}
                    disabled={!newActionLabel.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold transition cursor-pointer"
                  >
                    Marker setzen
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                  <span className="text-slate-500">Schnellauswahl:</span>
                  {[
                    '1. Zündung EIN geschaltet',
                    '2. Modell ausgewählt',
                    '3. "ECU Identifikation" geklickt',
                    '4. "Flash Lesen" gestartet',
                    '5. "Flash Schreiben" gestartet',
                    '6. "Sind Sie sicher?" mit JA bestätigt',
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setNewActionLabel(preset)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Annotation Timeline List */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Protokollierte Aktionen ({userAnnotations.length}):
                </div>

                {userAnnotations.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    Noch keine Aktionen protokolliert. Setzen Sie oben einen Marker während Sie das Programm bedienen.
                  </div>
                ) : (
                  userAnnotations.map((ann, idx) => (
                    <div
                      key={ann.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-950 text-amber-300 border border-amber-800 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{ann.label}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-cyan-300 border border-slate-700">
                              Paket #{ann.packetNumberAtAction}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(ann.timestamp).toLocaleTimeString('de-DE')} &bull; Kategorie: {ann.category}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteAnnotation(ann.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition"
                        title="Marker löschen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LM Studio Auswertungs-Prompt */}
          {activeTab === 'lm_studio' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="font-semibold text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-cyan-400" />
                    <span>Aufbereiteter Prompt mit Nutzer-Aktionen &amp; USB-Bytes</span>
                  </div>
                  <button
                    onClick={() => handleCopy(getEnrichedLmStudioPrompt())}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Kopiert' : 'Für LM Studio kopieren'}</span>
                  </button>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Dieser Prompt enthält sowohl die <strong>Hex-Transfers der USB-Schnittstelle</strong> als auch Ihre 
                  <strong> Benutzer-Klicks</strong>. Das lokale Modell kann so exakt verstehen, welcher Dialog welche 
                  Anfrage ausgelöst hat und wie der Seed-Key Algorithmus arbeitet.
                </p>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 leading-relaxed">
                <code>{getEnrichedLmStudioPrompt()}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
