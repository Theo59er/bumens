import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PacketTable } from './components/PacketTable';
import { PacketInspector } from './components/PacketInspector';
import { InteractiveConsole } from './components/InteractiveConsole';
import { DeviceConnectorModal } from './components/DeviceConnectorModal';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { DriverGeneratorModal } from './components/DriverGeneratorModal';
import { SeedKeyModal } from './components/SeedKeyModal';
import { ServerStubModal } from './components/ServerStubModal';
import { LmStudioModal } from './components/LmStudioModal';
import { SerialBridgeModal } from './components/SerialBridgeModal';
import { URBPacket, ConnectedDeviceInfo, UserActionAnnotation } from './types/protocol';
import { hardwareManager } from './utils/hardwareManager';
import { getSampleMotorcycleEcuTrace, parseHexInput } from './utils/protocolDecoders';
import { Server, Activity, ShieldCheck, Cpu, Bot, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [packets, setPackets] = useState<URBPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<URBPacket | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<ConnectedDeviceInfo | null>(null);
  const [isCapturing, setIsCapturing] = useState(true);

  // User Action Timeline annotations (correlates human actions with USB packets)
  const [userAnnotations, setUserAnnotations] = useState<UserActionAnnotation[]>([
    {
      id: 'act_1',
      timestamp: Date.now() - 5000,
      label: 'Zündung eingeschaltet & KWP2000 FastInit gestartet',
      category: 'IDENT',
      packetNumberAtAction: 1,
    },
    {
      id: 'act_2',
      timestamp: Date.now() - 3500,
      label: 'Diagnosemodus "Programmierung" (0x10 0x86) aktiviert',
      category: 'USER_CLICK',
      packetNumberAtAction: 3,
    },
    {
      id: 'act_3',
      timestamp: Date.now() - 2000,
      label: '"Kennfeld Schreiben" geklickt -> Software fordert Seed an',
      category: 'WRITE',
      packetNumberAtAction: 8,
    },
    {
      id: 'act_4',
      timestamp: Date.now() - 1500,
      label: 'Bestätigungsdialog "Steuergerät entsperren" mit JA bestätigt',
      category: 'CONFIRM_DIALOG',
      packetNumberAtAction: 10,
    },
  ]);

  const handleAddAnnotation = (ann: UserActionAnnotation) => {
    setUserAnnotations((prev) => [...prev, ann]);
  };

  const handleDeleteAnnotation = (id: string) => {
    setUserAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  // Modals state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [isSeedKeyModalOpen, setIsSeedKeyModalOpen] = useState(false);
  const [isServerStubModalOpen, setIsServerStubModalOpen] = useState(false);
  const [isLmStudioModalOpen, setIsLmStudioModalOpen] = useState(false);
  const [isSerialBridgeModalOpen, setIsSerialBridgeModalOpen] = useState(false);
  const [seedKeyInitHex, setSeedKeyInitHex] = useState<string>('4A 7E 19 B2');
  const [lastRemoteAction, setLastRemoteAction] = useState<string | null>(null);

  // Synchronize packets to backend memory store for Python / MCP / LM Studio access
  useEffect(() => {
    if (packets.length > 0) {
      fetch('/api/packets/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packets }),
      }).catch((err) => console.warn('Sync packets error:', err));
    }
  }, [packets.length]);

  // Remote Control Polling loop: Listens for commands from LM Studio / Python Agent / MCP
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/control/pending');
        if (!res.ok) return;
        const data = await res.json();
        if (data.pending && data.pending.length > 0) {
          for (const cmd of data.pending) {
            let result: any = 'OK';
            try {
              if (cmd.command === 'inject_packet' && cmd.params?.hex) {
                const bytes = parseHexInput(cmd.params.hex);
                await hardwareManager.sendPacket(bytes);
                setLastRemoteAction(`LM Studio hat Paket eingespeist: ${cmd.params.hex}`);
              } else if (cmd.command === 'request_seed') {
                await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x27, 0x01, 0xAC]);
                setLastRemoteAction('LM Studio hat Seed-Anforderung (0x27 0x01) ausgelöst');
              } else if (cmd.command === 'send_key') {
                const seed = hardwareManager.getCurrentSimulatorSeed();
                const key = hardwareManager.calculateExpectedKey(seed);
                const packet = [0x80, 0x11, 0xF1, 0x06, 0x27, 0x02, ...key];
                let sum = 0;
                for (const b of packet) sum = (sum + b) & 0xff;
                packet.push(sum);
                await hardwareManager.sendPacket(packet);
                setLastRemoteAction('LM Studio hat berechneten Key übertragen & ECU entsperrt');
              } else if (cmd.command === 'clear') {
                setPackets([]);
                setSelectedPacket(null);
                setLastRemoteAction('LM Studio hat den Paket-Puffer zurückgesetzt');
              } else if (cmd.command === 'annotate' && cmd.params?.label) {
                handleAddAnnotation({
                  id: `act_${Date.now()}`,
                  timestamp: Date.now(),
                  label: cmd.params.label,
                  category: cmd.params.category || 'USER_CLICK',
                  packetNumberAtAction: packets.length,
                });
                setLastRemoteAction(`LM Studio hat Marker gesetzt: "${cmd.params.label}"`);
              }
            } catch (err: any) {
              result = { error: err.message };
            }

            await fetch('/api/control/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: cmd.id, result }),
            }).catch(() => {});
          }
        }
      } catch {
        // Ignore network errors in background poll
      }
    }, 700);

    return () => clearInterval(interval);
  }, [packets.length]);

  // Initialize hardware manager callbacks and pre-load realistic sample trace
  useEffect(() => {
    hardwareManager.setCallbacks(
      (newPacket: URBPacket) => {
        if (!isCapturing) return;
        setPackets((prev) => [...prev, newPacket]);
      },
      (newDeviceInfo: ConnectedDeviceInfo | null) => {
        setDeviceInfo(newDeviceInfo);
      }
    );

    // Pre-populate with realistic motorcycle ECU flash session
    const samplePackets = getSampleMotorcycleEcuTrace();
    setPackets(samplePackets);
    if (samplePackets.length > 0) {
      setSelectedPacket(samplePackets[7]); // Select Seed Request packet by default
    }

    // Default simulator status
    const simInfo = hardwareManager.startSimulator('Motorrad ECU (BMS-K1200 K-Line)');
    setDeviceInfo(simInfo);
  }, []);

  const handleToggleCapture = () => {
    setIsCapturing(!isCapturing);
  };

  const handleClearPackets = () => {
    setPackets([]);
    setSelectedPacket(null);
  };

  const handleLoadSampleTrace = () => {
    const samples = getSampleMotorcycleEcuTrace();
    setPackets(samples);
    setSelectedPacket(samples[0]);
  };

  const handleExportTrace = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      deviceInfo,
      packetCount: packets.length,
      packets,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usb_trace_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTrace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.packets)) {
          setPackets(parsed.packets);
          if (parsed.packets.length > 0) setSelectedPacket(parsed.packets[0]);
        } else if (Array.isArray(parsed)) {
          setPackets(parsed);
          if (parsed.length > 0) setSelectedPacket(parsed[0]);
        }
      } catch (err) {
        alert('Ungültiges Trace-Dateiformat.');
      }
    };
    reader.readAsText(file);
  };

  const handleSendToSeedKey = (hexString: string) => {
    setSeedKeyInitHex(hexString);
    setIsSeedKeyModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Navigation */}
      <Header
        deviceInfo={deviceInfo}
        packetCount={packets.length}
        isCapturing={isCapturing}
        onToggleCapture={handleToggleCapture}
        onClearPackets={handleClearPackets}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenDriverModal={() => setIsDriverModalOpen(true)}
        onOpenSeedKeyModal={() => setIsSeedKeyModalOpen(true)}
        onOpenLmStudioModal={() => setIsLmStudioModalOpen(true)}
        onOpenSerialBridgeModal={() => setIsSerialBridgeModalOpen(true)}
        onLoadSampleTrace={handleLoadSampleTrace}
        onExportTrace={handleExportTrace}
        onImportTrace={handleImportTrace}
      />

      {/* Legacy Emulation / Professor Banner Shortcut */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-950 border-b border-indigo-900/60 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="font-semibold text-indigo-300">
            Archivierungs- &amp; Legacy-Projekt:
          </span>
          <span className="text-slate-300 hidden md:inline">
            Entkoppelung von Hersteller-Servern mittels Loopback-Adapter, REST-Stubbing &amp; lokaler Emulationsschicht.
          </span>
        </div>

        <button
          onClick={() => setIsServerStubModalOpen(true)}
          className="px-3 py-1 rounded-md bg-indigo-600/90 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <Server className="w-3.5 h-3.5" />
          <span>Server-Emulations-Architektur öffnen</span>
        </button>
      </div>

      {/* Live Remote Control Activity Toast / Notification */}
      {lastRemoteAction && (
        <div className="bg-emerald-950/90 border-b border-emerald-700/80 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <span className="font-semibold text-white">LM Studio Fernsteuerung aktiv:</span>
            <span>{lastRemoteAction}</span>
          </div>
          <button
            onClick={() => setLastRemoteAction(null)}
            className="text-emerald-400 hover:text-white px-2 py-0.5 rounded hover:bg-emerald-900/60 transition text-[11px]"
          >
            Ausblenden
          </button>
        </div>
      )}

      {/* Main Workbench Layout */}
      <main className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-hidden">
        {/* Upper Split Area: Packet Table & Packet Inspector */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-3">
          {/* Left: Packet Stream Table (70% width on large screens) */}
          <div className="flex-1 min-w-0 h-full flex flex-col">
            <PacketTable
              packets={packets}
              selectedPacket={selectedPacket}
              onSelectPacket={(pkt) => setSelectedPacket(pkt)}
            />
          </div>

          {/* Right: Deep Packet Inspector & Checksum Solver (30% width on large screens) */}
          <div className="w-full lg:w-[420px] shrink-0 h-full flex flex-col">
            <PacketInspector
              packet={selectedPacket}
              onSendToSeedKey={handleSendToSeedKey}
            />
          </div>
        </div>

        {/* Lower Area: Diagnostic Macros & Raw Transmission Console */}
        <div className="shrink-0">
          <InteractiveConsole
            deviceInfo={deviceInfo}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        </div>
      </main>

      {/* Modals */}
      <DeviceConnectorModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        deviceInfo={deviceInfo}
        onDeviceConnected={(info) => setDeviceInfo(info)}
      />

      <AiAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        packets={packets}
        deviceInfo={deviceInfo}
      />

      <DriverGeneratorModal
        isOpen={isDriverModalOpen}
        onClose={() => setIsDriverModalOpen(false)}
        deviceInfo={deviceInfo}
      />

      <SeedKeyModal
        isOpen={isSeedKeyModalOpen}
        onClose={() => setIsSeedKeyModalOpen(false)}
        packets={packets}
        initialHex={seedKeyInitHex}
        userAnnotations={userAnnotations}
        onAddAnnotation={handleAddAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
      />

      <ServerStubModal
        isOpen={isServerStubModalOpen}
        onClose={() => setIsServerStubModalOpen(false)}
      />

      <LmStudioModal
        isOpen={isLmStudioModalOpen}
        onClose={() => setIsLmStudioModalOpen(false)}
        packetCount={packets.length}
      />

      <SerialBridgeModal
        isOpen={isSerialBridgeModalOpen}
        onClose={() => setIsSerialBridgeModalOpen(false)}
      />
    </div>
  );
}
