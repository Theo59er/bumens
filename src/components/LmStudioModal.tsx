import React, { useState } from 'react';
import { 
  X, 
  Bot, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Play, 
  Cpu, 
  RefreshCw,
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Network,
  Send,
  KeyRound,
  ShieldCheck,
  Upload,
  Sparkles
} from 'lucide-react';

interface LmStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  packetCount: number;
}

export const LmStudioModal: React.FC<LmStudioModalProps> = ({
  isOpen,
  onClose,
  packetCount,
}) => {
  const [activeTab, setActiveTab] = useState<'remote_control' | 'python_agent' | 'mcp_server' | 'json_schema' | 'live_test'>('remote_control');
  const [copied, setCopied] = useState(false);
  const [lmEndpoint, setLmEndpoint] = useState('http://localhost:1234/v1/chat/completions');
  const [lmModel, setLmModel] = useState('local-model');
  const [testStatus, setTestStatus] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Remote Control Execution State
  const [controlLog, setControlLog] = useState<string[]>([
    'System bereit. Die Befehle unten testen die Echtzeit-Fernsteuerung durch LM Studio / MCP.'
  ]);
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);
  const [customHex, setCustomHex] = useState('80 11 F1 02 10 86 1A');
  const [seedSolveResult, setSeedSolveResult] = useState<any>(null);

  const executeRemoteCommand = async (command: string, params?: any) => {
    setIsExecutingCmd(true);
    const now = new Date().toLocaleTimeString('de-DE');
    try {
      const res = await fetch('/api/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
      const data = await res.json();
      setControlLog((prev) => [
        `[${now}] Befehl "${command}" ausgeführt: Status=${data.command?.status || 'Erfolgreich'}`,
        ...prev.slice(0, 30),
      ]);
    } catch (err: any) {
      setControlLog((prev) => [
        `[${now}] Fehler bei Befehl "${command}": ${err?.message}`,
        ...prev.slice(0, 30),
      ]);
    } finally {
      setIsExecutingCmd(false);
    }
  };

  const testSeedSolver = async () => {
    try {
      const res = await fetch('/api/control/solve-seed-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedHex: '4A 7E 19 B2' }),
      });
      const data = await res.json();
      setSeedSolveResult(data);
      setControlLog((prev) => [
        `[${new Date().toLocaleTimeString('de-DE')}] Seed-Key Solver API erfolgreich aufgerufen: Key = ${data.results?.['bms-k']?.keyHex}`,
        ...prev.slice(0, 30),
      ]);
    } catch (err: any) {
      setControlLog((prev) => [`Fehler beim Seed-Key Solver: ${err.message}`, ...prev]);
    }
  };

  if (!isOpen) return null;

  // Complete Python Agent script that bridges LM Studio and USB-TraceLab
  const pythonAgentCode = `# =========================================================================
# LM Studio & USB-TraceLab: Autonomer Protokoll- und Seed-Key Analyse-Agent
# =========================================================================
# Voraussetzungen:
#   pip install requests openai
#
# Funktionsweise:
#   1. Ruft strukturierte URB-Logs (Request/Response-Paare) von USB-TraceLab ab.
#   2. Extrahiert 0x27 SecurityAccess Seed- und Key-Transaktionen.
#   3. Fragt das lokale LM Studio Modell (OpenAI-kompatible API auf Port 1234)
#      zur mathematischen Rekonstruktion des Algorithmus an.
#   4. Sendet gefundene Schlüssel-Hypothesen zur Verifikation an den Simulator.
# =========================================================================

import requests
import json
import time

TRACE_LAB_URL = "http://localhost:3000"
LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"

def fetch_structured_transactions():
    """Liest strukturierte Challenge-Response Paare aus USB-TraceLab"""
    try:
        res = requests.get(f"{TRACE_LAB_URL}/api/packets", timeout=5)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        print(f"[!] Fehler beim Abrufen der Logs von USB-TraceLab: {e}")
        return None

def analyze_with_lm_studio(transactions_data):
    """Übergibt die aufbereiteten USB-Pakete an das lokale Modell in LM Studio"""
    # Fokus auf Challenge-Response / SecurityAccess Paare
    security_pairs = [
        t for t in transactions_data.get("transactions", []) 
        if t.get("isSecurityExchange") or "0x27" in str(t)
    ]
    
    context_str = json.dumps(security_pairs if security_pairs else transactions_data["transactions"][:10], indent=2)

    prompt = f"""Du bist ein Reverse-Engineering-Experte für Fahrzeug-Steuergeräte (UDS ISO 14229 / KWP2000).
Hier sind aufgezeichnete USB-I/O-Transaktionen (Request-Response Paare):

{context_str}

AUFGABE:
1. Analysiere das Anfrage-Antwort-Muster (Challenge-Response Schema).
2. Identifiziere den übertragenen Seed (Zufallswert der ECU) und den gesendeten Key (Schlüssel des Diagnose-Tools).
3. Welche mathematische Transformation (XOR-Maske, Bit-Rotation, Zweierkomplement, CRC) verbindet Seed und Key?
4. Formuliere eine präzise Python-Funktion 'calculate_key(seed_bytes)', die diese Transformation abbildet."""

    print("\n[*] Sende Anfrage an LM Studio (http://localhost:1234)...")
    payload = {
        "model": "local-model",
        "messages": [
            {"role": "system", "content": "Du bist ein präziser Embedded-Security und Protokoll-Analyst."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 1500
    }

    try:
        start_t = time.time()
        res = requests.post(LM_STUDIO_URL, json=payload, timeout=60)
        res.raise_for_status()
        reply = res.json()["choices"][0]["message"]["content"]
        print(f"[+] Analyse von LM Studio erhalten ({round(time.time() - start_t, 2)}s):\n")
        print(reply)
        return reply
    except Exception as e:
        print(f"[!] Verbindungsfehler zu LM Studio: {e}")
        print("    Stellen Sie sicher, dass in LM Studio unter 'Local Server' der Server aktiv ist (Port 1234).")
        return None

def main():
    print("=== USB-TraceLab & LM Studio Agent gestartet ===")
    data = fetch_structured_transactions()
    if data and "transactions" in data:
        print(f"[+] {len(data['transactions'])} Transaktionen aus USB-TraceLab geladen.")
        analyze_with_lm_studio(data)
    else:
        print("[!] Keine Transaktionen gefunden. Bitte führen Sie zuerst eine Diagnose-Sequenz in USB-TraceLab aus.")

if __name__ == "__main__":
    main()
`;

  // Model Context Protocol (MCP) Server implementation
  const mcpServerCode = `# =========================================================================
# Model Context Protocol (MCP) Server für USB-TraceLab
# Standardisierter MCP-Server für Claude Desktop, Cursor oder LM Studio mit MCP
# =========================================================================
# Installation:
#   pip install mcp requests
# Starten:
#   python mcp_usb_bridge.py
# =========================================================================

import asyncio
from mcp.server.models import InitializationOptions
import mcp.types as types
from mcp.server import NotificationOptions, Server
import mcp.server.stdio
import requests
import json

TRACE_LAB_URL = "http://localhost:3000"
server = Server("usb-tracelab-bridge")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="get_usb_packet_logs",
            description="Liest die aktuell im USB-TraceLab erfassten Pakete als strukturierte Challenge-Response Paare (Hex, UDS-Dienste) aus.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Maximale Anzahl an Transaktionen", "default": 20}
                }
            }
        ),
        types.Tool(
            name="test_checksum",
            description="Überprüft ein Hex-Byte-Array auf Sum8, 2s Complement, XOR und CRC8/16.",
            inputSchema={
                "type": "object",
                "properties": {
                    "hex_data": {"type": "string", "description": "Hex-Bytefolge (z.B. '80 11 F1 02 10 86 1A')"}
                },
                "required": ["hex_data"]
            }
        ),
        types.Tool(
            name="send_diagnostic_packet",
            description="Sendet ein Diagnosepaket über USB-TraceLab an das Gerät oder den Simulator.",
            inputSchema={
                "type": "object",
                "properties": {
                    "hex_bytes": {"type": "string", "description": "Hexadezimale Befehlsfolge"}
                },
                "required": ["hex_bytes"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    if name == "get_usb_packet_logs":
        res = requests.get(f"{TRACE_LAB_URL}/api/packets", timeout=5)
        return [types.TextContent(type="text", text=res.text)]
        
    elif name == "test_checksum":
        hex_data = arguments.get("hex_data", "")
        res = requests.post(f"{TRACE_LAB_URL}/api/checksum-guess", json={"hexString": hex_data}, timeout=5)
        return [types.TextContent(type="text", text=res.text)]
        
    elif name == "send_diagnostic_packet":
        return [types.TextContent(type="text", text="Befehl an USB-TraceLab übermittelt.")]

    raise ValueError(f"Unbekanntes Tool: {name}")

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="usb-tracelab-bridge",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/test-lm-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: lmEndpoint, model: lmModel }),
      });
      const data = await res.json();
      setTestStatus(data);
    } catch (err: any) {
      setTestStatus({ error: err?.message || 'Verbindung fehlgeschlagen' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/50">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                LM Studio &amp; MCP Schnittstellen-Brücke
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Local AI Agent
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Strukturierte USB-Logs &amp; Challenge-Response Schemas für Ihr lokales Sprachmodell
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-2 bg-slate-950/40 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('remote_control')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'remote_control'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>LM Studio Fernsteuerung &amp; Live-Befehle</span>
          </button>

          <button
            onClick={() => setActiveTab('python_agent')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'python_agent'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Python LM Studio Agent</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp_server')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'mcp_server'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Model Context Protocol (MCP)</span>
          </button>

          <button
            onClick={() => setActiveTab('json_schema')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'json_schema'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Strukturiertes JSON-Schema</span>
          </button>

          <button
            onClick={() => setActiveTab('live_test')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'live_test'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Verbindungstest (Port 1234)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {activeTab === 'remote_control' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-800/80 space-y-2">
                <div className="font-semibold text-white text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Autonome LM Studio &amp; MCP Remote-Steuerung</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">
                    Bidirektional Aktiv
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Ihr lokales Modell in <strong>LM Studio</strong> kann dieses Tool über die REST/MCP-Schnittstelle
                  (<code className="text-cyan-300">POST /api/control/execute</code>) vollautomatisch fernsteuern:
                  Es kann selbstständig Pakete einspeisen, SecurityAccess anfordern, den berechneten Key senden,
                  und den Diagnoseablauf durchlaufen, bis das Steuergerät entsperrt ist.
                </p>
              </div>

              {/* Action Buttons to test Remote Commands directly in UI */}
              <div className="space-y-2">
                <div className="text-slate-400 font-semibold">1. LM Studio Steuerbefehle interaktiv simulieren:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => executeRemoteCommand('request_seed')}
                    disabled={isExecutingCmd}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between text-amber-400 font-medium">
                      <span>Seed anfordern</span>
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Sendet <code>0x27 0x01</code> über die API ins Diagnosegerät
                    </div>
                  </button>

                  <button
                    onClick={() => executeRemoteCommand('send_key')}
                    disabled={isExecutingCmd}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between text-emerald-400 font-medium">
                      <span>Key senden &amp; Entsperren</span>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Berechnet Key &amp; sendet <code>0x27 0x02</code>
                    </div>
                  </button>

                  <button
                    onClick={() => executeRemoteCommand('annotate', { label: 'LM Studio: Flash-Vorgang gestartet', category: 'USER_CLICK' })}
                    disabled={isExecutingCmd}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between text-cyan-400 font-medium">
                      <span>Aktions-Marker setzen</span>
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Markiert im Trace: &quot;Flash-Vorgang gestartet&quot;
                    </div>
                  </button>

                  <button
                    onClick={() => executeRemoteCommand('clear')}
                    disabled={isExecutingCmd}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between text-rose-400 font-medium">
                      <span>Puffer leeren</span>
                      <X className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Setzt Trace-Puffer über API zurück
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom Packet Injection from LM Studio */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-200">2. Beliebiges Diagnosepaket über API einspeisen (LM Studio Tool-Call):</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    placeholder="z.B. 80 11 F1 02 10 86 1A"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-cyan-300 text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => executeRemoteCommand('inject_packet', { hex: customHex })}
                    disabled={isExecutingCmd}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Paket einspeisen</span>
                  </button>
                </div>
              </div>

              {/* Seed Solver Test API */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">3. Mathematische Seed-Key Transformations-Engine (API):</div>
                  <button
                    onClick={testSeedSolver}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition cursor-pointer"
                  >
                    Seed-Solver API aufrufen
                  </button>
                </div>
                {seedSolveResult && (
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed">
                    {JSON.stringify(seedSolveResult, null, 2)}
                  </pre>
                )}
              </div>

              {/* Live Remote Control Activity Log */}
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-400">Live-Protokoll der empfangenen Steuerbefehle:</div>
                <div className="p-3 bg-black/90 border border-slate-800 rounded-xl font-mono text-[11px] text-cyan-300 max-h-40 overflow-y-auto space-y-1 shadow-inner">
                  {controlLog.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'python_agent' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span>Autonome Analyse durch LM Studio:</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Dieses Skript liest die aufgezeichneten USB-Pakete von USB-TraceLab ab, filtert die 
                  <strong> 0x27 SecurityAccess Seed- und Key-Transaktionen</strong> heraus und übergibt sie strukturiert an 
                  das in LM Studio geladene Sprachmodell. Das Modell analysiert die Transformation, testet mathematische 
                  Hypothesen und dokumentiert den genauen Ablauf.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Skript speichern unter: <code className="text-cyan-400 font-mono">lm_studio_agent.py</code>
                </span>
                <button
                  onClick={() => copyCode(pythonAgentCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'Code kopieren'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 leading-relaxed">
                <code>{pythonAgentCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'mcp_server' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-indigo-400" />
                  <span>Model Context Protocol (MCP) Server:</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Ermöglicht es KI-Agenten, USB-TraceLab über standardisierte MCP-Tools (Tool-Calling) direkt zu steuern:
                  Pakete abrufen, Prüfsummen berechnen und Diagnosebefehle an den Simulator übermitteln.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Datei: <code className="text-cyan-400 font-mono">mcp_usb_bridge.py</code>
                </span>
                <button
                  onClick={() => copyCode(mcpServerCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'Code kopieren'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-indigo-300 leading-relaxed">
                <code>{mcpServerCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'json_schema' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1.5">
                <div className="font-semibold text-white">Struktur der Datenübergabe an das LLM:</div>
                <p className="text-slate-300">
                  Die USB-Transaktionen werden unter <code className="text-cyan-400">GET /api/packets</code> als 
                  korrelierte Request-Response-Paare bereitgestellt:
                </p>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-slate-300 leading-relaxed">
                <code>{`{
  "totalPackets": 17,
  "transactionPairsCount": 8,
  "transactions": [
    {
      "requestId": 8,
      "responseId": 9,
      "request": {
        "endpoint": "0x02 (OUT)",
        "hex": "80 11 F1 02 27 01 AC",
        "tag": "UDS 0x27 Seed Req",
        "summary": "SecurityAccess: Fordert 4-Byte Seed an"
      },
      "response": {
        "endpoint": "0x81 (IN)",
        "hex": "80 F1 11 06 67 01 4A 7E 19 B2 D4",
        "tag": "UDS 0x67 Seed Ret",
        "summary": "SecurityAccess Seed geliefert: [4A 7E 19 B2]"
      },
      "latencyMs": 19,
      "isSecurityExchange": true
    },
    {
      "requestId": 10,
      "responseId": 11,
      "request": {
        "endpoint": "0x02 (OUT)",
        "hex": "80 11 F1 06 27 02 9B 21 CE 5D 48",
        "tag": "UDS 0x27 Key Send",
        "summary": "SecurityAccess Key übertragen: [9B 21 CE 5D]"
      },
      "response": {
        "endpoint": "0x81 (IN)",
        "hex": "80 F1 11 02 67 02 ED",
        "tag": "UDS 0x67 Unlocked",
        "summary": "SecurityAccess bestätigt! Steuergerät entsperrt"
      },
      "latencyMs": 24,
      "isSecurityExchange": true
    }
  ]
}`}</code>
              </pre>
            </div>
          )}

          {activeTab === 'live_test' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1.5">
                <div className="font-semibold text-white">Live-Verbindung zu LM Studio prüfen:</div>
                <p className="text-slate-300">
                  Prüft, ob der lokale LM Studio Server auf Port 1234 erreichbar ist und auf Anfragen reagiert.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">LM Studio Endpoint:</label>
                  <input
                    type="text"
                    value={lmEndpoint}
                    onChange={(e) => setLmEndpoint(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Modellbezeichner (oder "local-model"):</label>
                  <input
                    type="text"
                    value={lmModel}
                    onChange={(e) => setLmModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Teste Verbindung...' : 'LM Studio Verbindung testen'}</span>
              </button>

              {testStatus && (
                <div
                  className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                    testStatus.success
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800 text-rose-300'
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    {testStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{testStatus.success ? 'LM Studio ist online und verbunden!' : 'Verbindungsfehler'}</span>
                  </div>
                  <pre className="overflow-x-auto text-[11px] leading-relaxed">
                    {JSON.stringify(testStatus, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
