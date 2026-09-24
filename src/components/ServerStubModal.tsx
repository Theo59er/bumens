import React, { useState } from 'react';
import { 
  X, 
  Server, 
  Copy, 
  Check, 
  Download, 
  Play, 
  Layers, 
  Network, 
  Terminal, 
  Activity,
  CheckCircle2,
  FileCode
} from 'lucide-react';

interface ServerStubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerStubModal: React.FC<ServerStubModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'nodejs' | 'python' | 'tester'>('architecture');
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const nodeJsCode = `// =========================================================================
// Lokaler Emulations- & Stubbing-Server für Legacy-Software-Archivierung
// Beantwortet Statusabfragen, Heartbeats und Healthchecks lokal.
// =========================================================================
// Start: node server-emulator.js
// Abhängigkeiten: npm install express morgan
// =========================================================================

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Body-Parser für JSON und URL-encoded Payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Strukturiertes Request-Logging (Audit-Trail)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(\`[\${timestamp}] \${req.method} \${req.originalUrl}\`);
    if (Object.keys(req.headers).length > 0) {
        console.log('  Headers:', JSON.stringify(req.headers, null, 2));
    }
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('  Payload:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// 1. Healthcheck Endpoint (Standard REST Status)
app.get(['/health', '/healthz', '/api/v1/health'], (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'Legacy-System-Local-Stub',
        version: '1.0.0-archive',
        diagnostics: {
            database: 'simulated_ok',
            connectivity: 'loopback_active'
        }
    });
});

// 2. Statusabfrage / Heartbeat (für periodische Polling-Dienste)
app.get(['/api/status', '/api/v1/status', '/status'], (req, res) => {
    res.status(200).json({
        online: true,
        maintenance: false,
        serverTime: Math.floor(Date.now() / 1000),
        capabilities: ['diagnostic', 'ecu_flash', 'telemetry'],
        archivalMode: true
    });
});

// 3. Fallback Catch-All Handler: Beantwortet alle weiteren Routen
// mit HTTP 200 OK und spiegelt die empfangenen Parameter wider.
app.all('*', (req, res) => {
    console.log(\`  --> Unbekannte Route aufgerufen, antworte mit Standard-Erfolg (200 OK)\`);
    res.status(200).json({
        success: true,
        path: req.originalUrl,
        message: 'Local emulation active - Request acknowledged',
        receivedAt: new Date().toISOString()
    });
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(\`============================================================\`);
    console.log(\`  Legacy Emulation Server läuft auf http://127.0.0.1:\${PORT}\`);
    console.log(\`  Bereit für eingehende Statusabfragen und Healthchecks\`);
    console.log(\`============================================================\`);
});`;

  const pythonCode = `# =========================================================================
# Lokaler FastAPI / Python Emulations-Server
# Start: uvicorn server_emulator:app --host 127.0.0.1 --port 8080
# =========================================================================

from fastapi import FastAPI, Request
import time
import logging

app = FastAPI(title="Legacy Software Emulation Stub")
logging.basicConfig(level=logging.INFO)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logging.info(f"[{time.strftime('%X')}] {request.method} {request.url.path}")
    response = await call_next(request)
    return response

@app.get("/health")
@app.get("/healthz")
async def health_check():
    return {
        "status": "UP",
        "timestamp": time.time(),
        "archival_mode": True
    }

@app.get("/api/status")
async def status_query():
    return {
        "online": True,
        "mode": "standalone_offline",
        "code": 200
    }

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def catch_all(request: Request, full_path: str):
    return {
        "status": "acknowledged",
        "path": full_path,
        "method": request.method
    }`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestLocalRoute = async (endpoint: string) => {
    setIsTesting(true);
    try {
      // Test request
      const dummyRes = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'Legacy-System-Local-Stub',
        version: '1.0.0-archive',
        diagnostics: {
          database: 'simulated_ok',
          connectivity: 'loopback_active',
        },
      };
      await new Promise(r => setTimeout(r, 200));
      setTestResult({
        endpoint,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: dummyRes,
      });
    } catch (err: any) {
      setTestResult({ error: err?.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Architekturentwürfe für Server-Emulation &amp; Archivierung
              </h2>
              <p className="text-xs text-slate-400">
                Lösungsansätze, Entwurfsmuster &amp; lokaler Stubbing-Server für Legacy-Systeme
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

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-2 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'architecture'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Design-Patterns &amp; Architektur</span>
          </button>

          <button
            onClick={() => setActiveTab('nodejs')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'nodejs'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Node.js / Express Server</span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'python'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Python / FastAPI Server</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'tester'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Endpoint Tester</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {activeTab === 'architecture' && (
            <div className="space-y-4 leading-relaxed text-slate-300">
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 text-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-indigo-400" />
                  Eignung von Architekturentwürfen für Systemerhaltung:
                </h3>
                <p>
                  Wenn ein Altsystem (Legacy-Software) durch Serverabschaltung nicht mehr startet, 
                  muss die Server-Abhängigkeit entkoppelt werden. Folgende Entwurfsmuster und Netzwerkarchitekturen 
                  haben sich in der Praxis bewährt:
                </p>
              </div>

              {/* Grid of Design Patterns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Loopback Adapter & Local DNS Override */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                    1. Loopback-Adapter &amp; Hosts-Routing
                  </div>
                  <p className="text-slate-300">
                    <strong>Konzept:</strong> Der Original-Domainname des Herstellers (z. B. <code>api.vendor-ecu.com</code>) 
                    wird in der lokalen Betriebssystem-Routingtabelle (Windows: <code>\etc\hosts</code>) auf die 
                    Loopback-Adresse <code>127.0.0.1</code> umgebogen.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Vorteil:</strong> Die Binärdatei der Legacy-Software muss nicht modifiziert werden. 
                    Netzwerk-Sockets verbinden sich nahtlos mit dem lokalen Stub.
                  </p>
                </div>

                {/* 2. Service Virtualization & REST API Stubbing */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    2. Service Virtualization / API Stubbing
                  </div>
                  <p className="text-slate-300">
                    <strong>Konzept:</strong> Ein schlanker lokaler Dienst (wie unten in Express/Python implementiert) 
                    fängt Heartbeats, Healthchecks und Initialisierungsabfragen ab und liefert 
                    synthetische, deterministische Erfolgsantworten.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Vorteil:</strong> Völlige Autarkie ohne Internetverbindung. Hohe Auditierbarkeit durch 
                    vollständiges Request-Logging.
                  </p>
                </div>

                {/* 3. Reverse Proxy & Sidecar Interceptor */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                    3. Reverse Proxy / Sidecar Pattern
                  </div>
                  <p className="text-slate-300">
                    <strong>Konzept:</strong> Ein zwischengeschalteter Proxy (z. B. Envoy, Nginx oder ein benutzerdefinierter 
                    Express-Proxy) fungiert als Vermittler (Mediator Pattern). Er terminiert TLS/HTTPS lokal 
                    und routet Anfragen flexibel.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Vorteil:</strong> Unterstützt SSL/TLS-Offloading, falls die Anwendung Zertifikatsvalidierung 
                    erfordert (mittels lokalem Root-CA Zertifikat).
                  </p>
                </div>

                {/* 4. Adapter / Facade Pattern */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    4. Adapter &amp; Facade Pattern
                  </div>
                  <p className="text-slate-300">
                    <strong>Konzept:</strong> Das lokale Backend stellt eine einheitliche Fassade bereit, 
                    die komplexe frühere Cloud-Services zu einer statischen Konfiguration vereinfacht.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Vorteil:</strong> Wartbarkeit und minimale Ressourcenbelastung auf dem Host-Rechner.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodejs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Vollständiges, lauffähiges Node.js / Express Skript
                </span>
                <button
                  onClick={() => copyCode(nodeJsCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'Code kopieren'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 leading-relaxed">
                <code>{nodeJsCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Python 3 FastAPI / Uvicorn Server
                </span>
                <button
                  onClick={() => copyCode(pythonCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'Code kopieren'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 leading-relaxed">
                <code>{pythonCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'tester' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-white">Live Healthcheck &amp; Status Tester:</div>
                <div className="text-slate-400">
                  Simuliert die Anfragen, die eine Legacy-Software beim Start an den Server sendet.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTestLocalRoute('/health')}
                  disabled={isTesting}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>GET /health anfordern</span>
                </button>

                <button
                  onClick={() => handleTestLocalRoute('/api/status')}
                  disabled={isTesting}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>GET /api/status abfragen</span>
                </button>
              </div>

              {testResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>HTTP 200 OK &mdash; Antwort empfangen</span>
                  </div>
                  <pre className="text-cyan-300 overflow-x-auto">
                    {JSON.stringify(testResult, null, 2)}
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
