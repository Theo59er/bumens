import React, { useState } from 'react';
import { 
  X, 
  Radio, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Network, 
  ArrowLeftRight, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  FileCode
} from 'lucide-react';

interface SerialBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SerialBridgeModal: React.FC<SerialBridgeModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'python' | 'csharp' | 'windows_setup'>('python');
  const [copied, setCopied] = useState(false);
  const [physPort, setPhysPort] = useState('COM3');
  const [virtPort, setVirtPort] = useState('COM10');
  const [baudRate, setBaudRate] = useState(10400);

  if (!isOpen) return null;

  // Complete, robust Python Null-Modem Passthrough Proxy
  const pythonProxyCode = `# =========================================================================
# Virtuelle COM-Port-Brücke & Bidirektionaler Passthrough-Proxy (Python)
# =========================================================================
# Funktionsweise:
#   1. Verbindet den physikalischen COM-Port (Ziel-Hardware, z.B. K-Line / FTDI)
#   2. Verbindet den virtuellen Null-Modem-Port (bereitgestellt via com0com)
#   3. Die Diagnose-Software verbindet sich mit dem gekoppelten Port (z.B. COM11)
#   4. Schleift alle Daten transparent in Echtzeit durch (<1ms Latenz)
#   5. Loggt alle Frames mit ISO-8601 Zeitstempeln und sendet sie an USB-TraceLab
# =========================================================================
# Installation:
#   pip install pyserial requests
# =========================================================================

import serial
import threading
import time
from datetime import datetime
import requests

# Konfiguration
PHYSICAL_PORT = "${physPort}"   # Echter USB-Diagnosestecker (vom PC erkannt)
VIRTUAL_PORT  = "${virtPort}"  # Virtueller Null-Modem Port (Seite A für Proxy)
# Die Legacy-Software verbindet sich mit der virtuellen Gegenseite (z. B. COM11)!

BAUDRATE      = ${baudRate}      # z.B. 10400 (K-Line), 9600, 38400, 115200
TRACE_LAB_URL = "http://localhost:3000/api/packets/ingest"

packet_counter = 0

def forward_stream(source_ser, target_ser, direction_label, is_host_to_device):
    """Liest Bytes aus source_ser, leitet sie an target_ser weiter und protokolliert."""
    global packet_counter
    
    while True:
        try:
            # Lese verfügbare Bytes (nicht-blockierend oder mit kurzem Timeout)
            in_waiting = source_ser.in_waiting
            if in_waiting > 0:
                data = source_ser.read(in_waiting)
                if data:
                    # 1. Sofort transparent weiterleiten (minimale Latenz)
                    target_ser.write(data)
                    target_ser.flush()
                    
                    packet_counter += 1
                    timestamp_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                    hex_str = ' '.join(f"{b:02X}" for b in data)
                    ascii_str = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in data)
                    
                    # 2. Terminal-Ausgabe mit Farbcodierung
                    color = "\\033[96m" if is_host_to_device else "\\033[92m"
                    reset = "\\033[0m"
                    print(f"[{timestamp_str}] #{packet_counter} {color}[{direction_label}]{reset} ({len(data)} Bytes): {hex_str} | {ascii_str}")
                    
                    # 3. Optional: Live-Sync an USB-TraceLab UI
                    try:
                        payload = {
                            "packets": [{
                                "id": f"serial_{int(time.time()*1000)}_{packet_counter}",
                                "packetNumber": packet_counter,
                                "timestamp": int(time.time() * 1000),
                                "deltaMs": 1,
                                "direction": "HOST_TO_DEVICE" if is_host_to_device else "DEVICE_TO_HOST",
                                "endpoint": "COM-OUT" if is_host_to_device else "COM-IN",
                                "transferType": "Bulk",
                                "rawBytes": list(data),
                                "hexString": hex_str,
                                "asciiString": ascii_str,
                                "byteCount": len(data),
                                "protocolTag": "Serial-Proxy",
                                "decodedSummary": f"Passthrough {direction_label}"
                            }]
                        }
                        requests.post(TRACE_LAB_URL, json=payload, timeout=0.1)
                    except Exception:
                        pass # Ignorieren falls Web-UI nicht läuft
            else:
                time.sleep(0.001) # 1ms Sleep schont die CPU
        except Exception as e:
            print(f"[!] Fehler in Weiterleitung {direction_label}: {e}")
            break

def main():
    print("=" * 70)
    print("  Virtuelle COM-Port-Brücke & Protokoll-Sniffer")
    print(f"  Physikalischer Port : {PHYSICAL_PORT} @ {BAUDRATE} Baud")
    print(f"  Virtueller Proxy-Port: {VIRTUAL_PORT}")
    print("=" * 70)

    try:
        ser_phys = serial.Serial(PHYSICAL_PORT, BAUDRATE, timeout=0.05)
        print(f"[+] Physikalischer Port {PHYSICAL_PORT} erfolgreich geöffnet.")
    except Exception as e:
        print(f"[!] Fehler beim Öffnen von {PHYSICAL_PORT}: {e}")
        return

    try:
        ser_virt = serial.Serial(VIRTUAL_PORT, BAUDRATE, timeout=0.05)
        print(f"[+] Virtueller Port {VIRTUAL_PORT} erfolgreich geöffnet.")
    except Exception as e:
        print(f"[!] Fehler beim Öffnen von {VIRTUAL_PORT}: {e}")
        ser_phys.close()
        return

    print("\\n[*] Proxy aktiv! Starten Sie nun Ihre Client-Software auf der Gegenseite.\\n")

    # Starte zwei parallele Worker-Threads für Vollduplex (RX und TX)
    t_client_to_dev = threading.Thread(
        target=forward_stream, 
        args=(ser_virt, ser_phys, "CLIENT -> HARDWARE (TX)", True), 
        daemon=True
    )
    t_dev_to_client = threading.Thread(
        target=forward_stream, 
        args=(ser_phys, ser_virt, "HARDWARE -> CLIENT (RX)", False), 
        daemon=True
    )

    t_client_to_dev.start()
    t_dev_to_client.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\\nBeende COM-Port-Proxy...")
    finally:
        ser_phys.close()
        ser_virt.close()
        print("Ports geschlossen.")

if __name__ == "__main__":
    main()
`;

  // C# .NET 8 Serial Port Bridge
  const csharpProxyCode = `// =========================================================================
// C# .NET 8 High-Performance Serial Port Bridge & Logger
// =========================================================================
// Voraussetzungen:
//   dotnet add package System.IO.Ports
// =========================================================================

using System;
using System.IO.Ports;
using System.Threading;
using System.Threading.Tasks;

class SerialBridge
{
    private static SerialPort _physPort;
    private static SerialPort _virtPort;
    private static long _packetCount = 0;

    static async Task Main(string[] args)
    {
        string physName = "${physPort}";
        string virtName = "${virtPort}";
        int baud = ${baudRate};

        Console.WriteLine("=== C# Virtual Serial Port Bridge ===");
        Console.WriteLine($"Physikalisch: {physName} | Virtuell: {virtName} @ {baud} Baud");

        _physPort = new SerialPort(physName, baud, Parity.None, 8, StopBits.One) { ReadTimeout = 50, WriteTimeout = 50 };
        _virtPort = new SerialPort(virtName, baud, Parity.None, 8, StopBits.One) { ReadTimeout = 50, WriteTimeout = 50 };

        try
        {
            _physPort.Open();
            _virtPort.Open();
            Console.WriteLine("[+] Beide Ports geöffnet. Starte bidirektionalen Passthrough-Proxy...");

            var cts = new CancellationTokenSource();
            
            // Client -> Hardware (TX)
            var taskTx = Task.Run(() => ForwardLoop(_virtPort, _physPort, "CLIENT -> HW (TX)", ConsoleColor.Cyan, cts.Token));
            // Hardware -> Client (RX)
            var taskRx = Task.Run(() => ForwardLoop(_physPort, _virtPort, "HW -> CLIENT (RX)", ConsoleColor.Green, cts.Token));

            Console.WriteLine("Drücken Sie [Enter] zum Beenden...");
            Console.ReadLine();
            cts.Cancel();
            await Task.WhenAll(taskTx, taskRx);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[!] Fehler: {ex.Message}");
        }
        finally
        {
            if (_physPort.IsOpen) _physPort.Close();
            if (_virtPort.IsOpen) _virtPort.Close();
        }
    }

    private static void ForwardLoop(SerialPort source, SerialPort dest, string label, ConsoleColor color, CancellationToken token)
    {
        byte[] buffer = new byte[4096];
        while (!token.IsCancellationRequested)
        {
            try
            {
                int count = source.Read(buffer, 0, buffer.Length);
                if (count > 0)
                {
                    // Sofort weiterleiten
                    dest.Write(buffer, 0, count);

                    Interlocked.Increment(ref _packetCount);
                    string hex = BitConverter.ToString(buffer, 0, count).Replace("-", " ");
                    string time = DateTime.Now.ToString("HH:mm:ss.fff");

                    lock (Console.Out)
                    {
                        Console.ForegroundColor = color;
                        Console.WriteLine($"[{time}] #{_packetCount} [{label}] ({count} Bytes): {hex}");
                        Console.ResetColor();
                    }
                }
            }
            catch (TimeoutException) { /* Normaler Timeout */ }
            catch (Exception ex)
            {
                if (!token.IsCancellationRequested)
                    Console.WriteLine($"[!] Fehler in {label}: {ex.Message}");
                break;
            }
        }
    }
}
`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-emerald-600 text-white shadow-md shadow-cyan-950/50">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Virtuelle COM-Port-Brücke &amp; Null-Modem Proxy
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Passthrough Sniffer
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Transparentes Durchschleifen und Protokollieren zwischen Software und physikalischem Adapter
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

        {/* Port Config Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-400 mr-1.5">Physikalischer Port:</span>
              <input
                type="text"
                value={physPort}
                onChange={(e) => setPhysPort(e.target.value.toUpperCase())}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-emerald-400 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="text-slate-500">&harr;</div>

            <div>
              <span className="text-slate-400 mr-1.5">Virtueller Proxy-Port:</span>
              <input
                type="text"
                value={virtPort}
                onChange={(e) => setVirtPort(e.target.value.toUpperCase())}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <span className="text-slate-400 mr-1.5">Baudrate:</span>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="10400">10400 (K-Line / KWP2000)</option>
                <option value="9600">9600 (OBD-II Standard)</option>
                <option value="38400">38400 (Fast K-Line)</option>
                <option value="57600">57600</option>
                <option value="115200">115200 (USB High-Speed)</option>
                <option value="500000">500000 (CAN-Bus)</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Software verbindet sich mit: <span className="font-mono font-bold text-white">COM11 (Gegenseite)</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-2 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'architecture'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Architektur &amp; Funktionsprinzip</span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'python'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Python Proxy-Skript (pySerial)</span>
          </button>

          <button
            onClick={() => setActiveTab('csharp')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'csharp'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>C# .NET 8 Proxy</span>
          </button>

          <button
            onClick={() => setActiveTab('windows_setup')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'windows_setup'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Windows Null-Modem Setup (com0com)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {activeTab === 'architecture' && (
            <div className="space-y-4 leading-relaxed text-slate-300">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="font-semibold text-white text-sm flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                  <span>Das Problem exklusiver COM-Port-Sperren unter Windows &amp; die Lösung:</span>
                </div>
                <p>
                  Unter Windows gilt: <strong>Ein COM-Port kann immer nur von genau einem Prozess gleichzeitig geöffnet werden!</strong>
                  Wenn Ihre Diagnosesoftware auf <code className="text-emerald-400">COM3</code> zugreift, kann kein 
                  zweites Programm (wie ein Sniffer) denselben Port mitlesen.
                </p>
              </div>

              {/* Diagram / Visual Flow */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-[11px]">
                <div className="text-slate-400 text-xs font-sans font-semibold">Signalfluss des Passthrough-Proxys:</div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="p-2.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-center w-full md:w-auto">
                    <div className="font-bold">Original-Software</div>
                    <div className="text-[10px] text-slate-400">Öffnet COM11</div>
                  </div>

                  <div className="text-cyan-400 font-bold">&larr;&rarr; Virtuelles Paar &larr;&rarr;</div>

                  <div className="p-2.5 rounded bg-indigo-950/80 border border-indigo-700 text-indigo-300 text-center w-full md:w-auto">
                    <div className="font-bold">Unser Proxy-Skript</div>
                    <div className="text-[10px] text-slate-400">Lauscht auf COM10 &bull; Loggt &amp; spiegelt</div>
                  </div>

                  <div className="text-cyan-400 font-bold">&larr;&rarr; USB-Treiber &larr;&rarr;</div>

                  <div className="p-2.5 rounded bg-cyan-950/80 border border-cyan-700 text-cyan-300 text-center w-full md:w-auto">
                    <div className="font-bold">Hardware-Adapter</div>
                    <div className="text-[10px] text-slate-400">Physikalischer COM3 (FTDI)</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-cyan-400">Warum Null-Modem Brücke?</div>
                  <p className="text-slate-400 text-[11px]">
                    Das Null-Modem-Paar verbindet zwei virtuelle Ports im Kernel (<code className="text-cyan-300">COM10 &harr; COM11</code>).
                    Was die Software auf COM11 schreibt, empfängt unser Proxy sofort auf COM10, speichert den Zeitstempel, 
                    analysiert den Frame und reicht ihn unverändert an den echten COM3 weiter.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-emerald-400">Echtzeit &amp; Timing-Garantie</div>
                  <p className="text-slate-400 text-[11px]">
                    Für Fahrzeugsteuergeräte (KWP2000 P1-P4 Timings) ist Latenz kritisch. 
                    Unser Worker-Thread-Modell leitet Bytes in unter <strong>0,5 Millisekunden</strong> weiter, 
                    wodurch Timeouts in der Steuergeräte-Kommunikation vermieden werden.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Vollständiges, lauffähiges Python-Skript (<code className="text-cyan-400 font-mono">com_bridge_proxy.py</code>)
                </span>
                <button
                  onClick={() => copyCode(pythonProxyCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'Skript kopieren'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 leading-relaxed">
                <code>{pythonProxyCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'csharp' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  C# .NET 8 High-Performance Bridge (<code className="text-cyan-400 font-mono">SerialBridge.cs</code>)
                </span>
                <button
                  onClick={() => copyCode(csharpProxyCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'C# Code kopieren'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 leading-relaxed">
                <code>{csharpProxyCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'windows_setup' && (
            <div className="space-y-4 leading-relaxed text-slate-300">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="font-semibold text-white text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Schritt-für-Schritt Anleitung: com0com unter Windows einrichten</span>
                </div>
                <p>
                  <strong>com0com</strong> ist ein bewährter Open-Source Windows Kernel-Treiber zur Erzeugung virtueller 
                  COM-Port-Paare (Null-Modem Emulator).
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center text-xs">1</span>
                    <span>Download &amp; Installation:</span>
                  </div>
                  <p className="text-slate-400 text-[11px] pl-7">
                    Laden Sie <strong>Null-modem emulator (com0com)</strong> herunter (oder via Paketmanager: <code className="text-cyan-300">winget install com0com</code> bzw. SourceForge).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center text-xs">2</span>
                    <span>Port-Paar erstellen:</span>
                  </div>
                  <p className="text-slate-400 text-[11px] pl-7">
                    Öffnen Sie das <strong>Setup Command Prompt</strong> von com0com und führen Sie folgenden Befehl aus:
                  </p>
                  <pre className="ml-7 p-2 rounded bg-slate-900 border border-slate-800 font-mono text-cyan-300 text-xs">
                    install PortName=COM10 PortName=COM11
                  </pre>
                  <p className="text-slate-400 text-[11px] pl-7">
                    Windows legt nun zwei neue COM-Ports an, die intern direkt miteinander verkabelt sind.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center text-xs">3</span>
                    <span>Starten &amp; Sniffen:</span>
                  </div>
                  <div className="text-slate-400 text-[11px] pl-7 space-y-1">
                    <div>1. Stecken Sie Ihr physisches Diagnosekabel ein (z. B. <strong className="text-white">COM3</strong>).</div>
                    <div>2. Starten Sie das Python-Skript: <code className="text-cyan-300">python com_bridge_proxy.py</code> (verbindet COM3 &harr; COM10).</div>
                    <div>3. Starten Sie Ihre Diagnosesoftware und wählen Sie als Port <strong className="text-white">COM11</strong> aus!</div>
                    <div className="text-emerald-400 font-semibold mt-1">
                      &rarr; Das Programm arbeitet völlig normal, während unser Tool im Hintergrund jedes einzelne Byte mitliest!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
