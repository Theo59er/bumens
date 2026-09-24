import React, { useState } from 'react';
import { 
  X, 
  Usb, 
  Radio, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  PowerOff,
  Sliders,
  ShieldCheck,
  Zap,
  HelpCircle
} from 'lucide-react';
import { ConnectedDeviceInfo } from '../types/protocol';
import { hardwareManager } from '../utils/hardwareManager';

interface DeviceConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo: ConnectedDeviceInfo | null;
  onDeviceConnected: (info: ConnectedDeviceInfo | null) => void;
}

export const DeviceConnectorModal: React.FC<DeviceConnectorModalProps> = ({
  isOpen,
  onClose,
  deviceInfo,
  onDeviceConnected,
}) => {
  const [activeTab, setActiveTab] = useState<'webusb' | 'webserial' | 'simulator'>('simulator');
  const [baudRate, setBaudRate] = useState<number>(10400); // Default K-Line baud
  const [simPreset, setSimPreset] = useState<string>('Motorrad ECU (BMS-K1200 K-Line)');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const hasWebUsb = 'usb' in navigator;
  const hasWebSerial = 'serial' in navigator;

  const handleConnectWebUsb = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const info = await hardwareManager.connectWebUSB();
      onDeviceConnected(info);
      setStatusMessage({ type: 'success', text: `USB-Gerät erfolgreich verbunden: ${info.name}` });
      setTimeout(onClose, 800);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Verbindung zum USB-Gerät fehlgeschlagen.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectWebSerial = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const info = await hardwareManager.connectWebSerial(baudRate);
      onDeviceConnected(info);
      setStatusMessage({ type: 'success', text: `Serieller Port mit ${baudRate} Baud verbunden.` });
      setTimeout(onClose, 800);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Verbindung zum seriellen Port fehlgeschlagen.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartSimulator = () => {
    const info = hardwareManager.startSimulator(simPreset);
    onDeviceConnected(info);
    setStatusMessage({ type: 'success', text: `Simulator "${simPreset}" aktiv!` });
    setTimeout(onClose, 600);
  };

  const handleDisconnect = () => {
    hardwareManager.disconnect();
    onDeviceConnected(null);
    setStatusMessage({ type: 'success', text: 'Gerät getrennt.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800/80 text-cyan-400">
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Hardware &amp; Schnittstellen-Manager</h2>
              <p className="text-xs text-slate-400">Wähle eine Verbindungsmethode für die USB-URB-Erfassung</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Banner */}
        {deviceInfo && (
          <div className="px-6 py-3 bg-emerald-950/40 border-b border-emerald-900/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <span className="text-emerald-300 font-medium">Verbunden: </span>
                <span className="text-white font-mono">{deviceInfo.name}</span>
                {deviceInfo.vendorId && (
                  <span className="text-emerald-400 ml-1">({deviceInfo.vendorId}:{deviceInfo.productId})</span>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center gap-1 transition"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Trennen</span>
            </button>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-2 bg-slate-950/30">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`pb-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'simulator'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>ECU Simulator &amp; Testbench</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
              Empfohlen
            </span>
          </button>

          <button
            onClick={() => setActiveTab('webusb')}
            className={`pb-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'webusb'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Usb className="w-4 h-4" />
            <span>Direktes WebUSB</span>
          </button>

          <button
            onClick={() => setActiveTab('webserial')}
            className={`pb-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'webserial'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Virtueller COM-Port</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4">
          {/* Tab: Simulator */}
          {activeTab === 'simulator' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-300 font-semibold text-sm">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Autarke Testumgebung (Offline &amp; Risikofrei)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Simuliert die vollständige Kommunikationskette eines echten Motorrad-Steuergeräts inklusive 
                  Baudraten-Initialisierung, KWP2000 / UDS Sessions, Identifikation, 
                  <strong> Seed-Key Authentifizierung (SecurityAccess 0x27)</strong> und Flash-Datenblöcken.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Steuergeräte-Preset auswählen:
                </label>
                <select
                  value={simPreset}
                  onChange={(e) => setSimPreset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-cyan-500"
                >
                  <option value="Motorrad ECU (BMS-K1200 K-Line)">
                    Motorrad ECU (BMS-K1200GS K-Line / KWP2000 @ 10400 Baud)
                  </option>
                  <option value="Bosch ME7 / EDC15 K-Line">
                    Bosch ME7 / EDC15 K-Line (Seed-Key 4-Byte Standard)
                  </option>
                  <option value="CAN-Bus UDS (ISO 14229 / ISO-TP 500k)">
                    CAN-Bus UDS (ISO 14229 / ISO-TP mit Block-Flashing)
                  </option>
                  <option value="FTDI Raw Loopback Interface">
                    FTDI FT232R USB-Serial Loopback Adapter
                  </option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartSimulator}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Simulator starten &amp; verbinden</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab: WebUSB */}
          {activeTab === 'webusb' && (
            <div className="space-y-4 text-xs">
              {!hasWebUsb ? (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-300 flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">WebUSB nicht verfügbar</div>
                    <div>Dieser Browser unterstützt kein WebUSB. Bitte nutzen Sie Chrome, Chromium oder Edge.</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                    <div className="flex items-center space-x-2 text-cyan-300 font-semibold text-sm">
                      <Usb className="w-4 h-4" />
                      <span>Echtes USB-Gerät direkt im Browser ansprechen</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Ermöglicht den direkten Zugriff auf USB-Interfaces (z. B. FTDI FT232R, STM32, Kvaser, ELM327 USB).
                      Beim Klick auf Verbinden öffnet Ihr Browser das native Geräteauswahl-Menü.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div className="text-slate-300 font-medium">Hinweis zu Windows-Treibern:</div>
                    <div>
                      Wenn Windows bereits einen proprietären Kernel-Treiber an das Gerät gebunden hat, 
                      erfordert WebUSB möglicherweise den generischen <code className="text-cyan-400">WinUSB</code>-Treiber 
                      (installierbar via <em className="text-slate-200">Zadig</em>).
                    </div>
                  </div>

                  <button
                    onClick={handleConnectWebUsb}
                    disabled={isConnecting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
                  >
                    <Usb className="w-4 h-4" />
                    <span>{isConnecting ? 'Verbinde...' : 'USB-Gerät auswählen & verbinden'}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: Web Serial */}
          {activeTab === 'webserial' && (
            <div className="space-y-4 text-xs">
              {!hasWebSerial ? (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-300 flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Web Serial nicht verfügbar</div>
                    <div>Dieser Browser unterstützt kein Web Serial. Bitte nutzen Sie Chrome, Chromium oder Edge.</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                    <div className="flex items-center space-x-2 text-cyan-300 font-semibold text-sm">
                      <Radio className="w-4 h-4" />
                      <span>Virtueller COM-Port / USB-zu-Seriell Adapter</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Die meisten Motorrad- und Fahrzeugdiagnosekabel (K-Line, FTDI, CP2102, CH340, OBDLink) 
                      erscheinen in Windows als virtueller COM-Port.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">
                      Baudrate (Übertragungsgeschwindigkeit):
                    </label>
                    <select
                      value={baudRate}
                      onChange={(e) => setBaudRate(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
                    >
                      <option value="10400">10400 Baud (Standard Motorrad K-Line / KWP2000)</option>
                      <option value="9600">9600 Baud (Standard OBD-II K-Line / VAG)</option>
                      <option value="38400">38400 Baud (Fast K-Line / ELM327)</option>
                      <option value="57600">57600 Baud</option>
                      <option value="115200">115200 Baud (High-Speed OBD / USB-CAN)</option>
                      <option value="500000">500000 Baud (CAN-Bus SLCAN Lawicel)</option>
                      <option value="1000000">1000000 Baud (1 MBit/s)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleConnectWebSerial}
                    disabled={isConnecting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 transition cursor-pointer disabled:opacity-50"
                  >
                    <Radio className="w-4 h-4" />
                    <span>{isConnecting ? 'Öffne Port...' : 'COM-Port auswählen & verbinden'}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
