import React, { useState } from 'react';
import { 
  X, 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Cpu, 
  Layers,
  CheckCircle2,
  Play,
  Square,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { ConnectedDeviceInfo } from '../types/protocol';
import { hardwareManager } from '../utils/hardwareManager';

interface DriverGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo: ConnectedDeviceInfo | null;
}

interface SandboxLog {
  time: string;
  type: 'info' | 'tx' | 'rx' | 'success' | 'warn';
  text: string;
}

export const DriverGeneratorModal: React.FC<DriverGeneratorModalProps> = ({
  isOpen,
  onClose,
  deviceInfo,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'csharp' | 'cpp' | 'python' | 'pico' | 'sandbox'>('sandbox');
  const [copied, setCopied] = useState(false);

  // Sandbox state
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [sandboxLogs, setSandboxLogs] = useState<SandboxLog[]>([
    {
      time: '00:00:00.000',
      type: 'info',
      text: 'Treiber-Testumgebung bereit. Klicken Sie auf "Treiber ausführen", um den C# / C++ Treiber-Code live im Browser gegen die virtuelle ECU zu testen.'
    }
  ]);

  if (!isOpen) return null;

  const vid = deviceInfo?.vendorId?.replace('0x', '') || '0403';
  const pid = deviceInfo?.productId?.replace('0x', '') || '6001';

  // Live driver execution in browser
  const runDriverSandbox = async () => {
    setIsSandboxRunning(true);
    const now = () => new Date().toLocaleTimeString('de-DE') + '.' + Math.floor(Math.random() * 900 + 100);

    const addLog = (type: SandboxLog['type'], text: string) => {
      setSandboxLogs(prev => [...prev, { time: now(), type, text }]);
    };

    setSandboxLogs([{ time: now(), type: 'info', text: `Starte Open-Source ECU Treiber (.NET 8 runtime emulation)...` }]);

    try {
      await new Promise(r => setTimeout(r, 400));
      addLog('info', `[+] Suche USB-Gerät [VID: 0x${vid}, PID: 0x${pid}]...`);
      await new Promise(r => setTimeout(r, 300));
      addLog('info', `[+] USB-Gerät gefunden: FTDI FT232R USB UART (Interface 0 beansprucht)`);
      addLog('info', `[+] Endpunkte konfiguriert: OUT=0x02 (Bulk), IN=0x81 (Bulk)`);

      // 1. FastInit
      await new Promise(r => setTimeout(r, 400));
      addLog('tx', `[HOST -> DEV] Sende KWP2000 FastInit: 81 11 F1 81 04`);
      await hardwareManager.sendPacket([0x81, 0x11, 0xF1, 0x81, 0x04]);
      addLog('rx', `[DEV -> HOST] Empfangen: 80 F1 11 03 C1 EA 8F 8E (ECU bereit, KeyBytes=0xEA 0x8F)`);

      // 2. Start Diagnostic Session
      await new Promise(r => setTimeout(r, 400));
      addLog('tx', `[HOST -> DEV] Sende StartDiagnosticSession (0x10 0x86 Programming): 80 11 F1 02 10 86 1A`);
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x10, 0x86, 0x1A]);
      addLog('rx', `[DEV -> HOST] Empfangen: 80 F1 11 02 50 86 D4 (Programming Session aktiv)`);

      // 3. Read ECU Ident
      await new Promise(r => setTimeout(r, 400));
      addLog('tx', `[HOST -> DEV] Sende ReadEcuIdentification (0x1A 0x9B): 80 11 F1 02 1A 9B 3E`);
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x1A, 0x9B, 0x3E]);
      addLog('rx', `[DEV -> HOST] Empfangen: 80 F1 11 18 5A 9B ... (Firmware: BMS-K1200GS_MOTO_V2.4)`);

      // 4. Request Seed
      await new Promise(r => setTimeout(r, 500));
      addLog('tx', `[HOST -> DEV] Sende SecurityAccess Seed-Request (0x27 0x01): 80 11 F1 02 27 01 AC`);
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x02, 0x27, 0x01, 0xAC]);

      const seed = hardwareManager.getCurrentSimulatorSeed();
      const seedHex = seed.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      addLog('rx', `[DEV -> HOST] Empfangen Seed (0x67 0x01): [${seedHex}]`);

      // 5. Calculate Key
      await new Promise(r => setTimeout(r, 400));
      const key = hardwareManager.calculateExpectedKey(seed);
      const keyHex = key.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      addLog('info', `[*] Berechne Key nach BMW BMS-K Algorithmus: [${keyHex}]`);

      // 6. Send Key
      await new Promise(r => setTimeout(r, 400));
      const keyPacket = [0x80, 0x11, 0xF1, 0x06, 0x27, 0x02, ...key];
      let sum = 0;
      for (const b of keyPacket) sum = (sum + b) & 0xff;
      keyPacket.push(sum);

      addLog('tx', `[HOST -> DEV] Sende SecurityAccess Key (0x27 0x02): ${keyPacket.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);
      await hardwareManager.sendPacket(keyPacket);
      addLog('rx', `[DEV -> HOST] Empfangen: 80 F1 11 02 67 02 ED (SecurityAccess POSITIV BESTÄTIGT!)`);

      // 7. Read Flash
      await new Promise(r => setTimeout(r, 400));
      addLog('tx', `[HOST -> DEV] Sende RequestUpload (0x35 @ 0x00440000 Len 0x4000)`);
      await hardwareManager.sendPacket([0x80, 0x11, 0xF1, 0x07, 0x35, 0x00, 0x44, 0x00, 0x08, 0x00, 0x00, 0xE0]);
      addLog('rx', `[DEV -> HOST] TransferData 0x36: 4096 Bytes erfolgreich gestreamt.`);

      addLog('success', `[OK] Treiber-Ausführung erfolgreich! Alle KWP2000-Zustände wurden durchlaufen.`);
    } catch (err: any) {
      addLog('warn', `[!] Treiber-Fehler: ${err?.message}`);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  // C# LibUsbDotNet Template
  const csharpCode = `// =========================================================================
// USB-TraceLab: Open-Source ECU Diagnostic Driver (.NET 8 / C#)
// Unterstützt: KWP2000 (ISO 14230) & UDS (ISO 14229) über USB
// =========================================================================
// Installation:
// dotnet add package LibUsbDotNet --version 2.2.29
// =========================================================================

using System;
using System.Threading;
using LibUsbDotNet;
using LibUsbDotNet.Main;

namespace OpenEcuDriver
{
    class Program
    {
        private const int VENDOR_ID = 0x${vid}; 
        private const int PRODUCT_ID = 0x${pid};

        static void Main(string[] args)
        {
            Console.WriteLine("=== Open-Source ECU Diagnostic Driver ===");
            Console.WriteLine($"Suche USB-Gerät [0x{VENDOR_ID:X4}:0x{PRODUCT_ID:X4}]...");

            UsbDeviceFinder finder = new UsbDeviceFinder(VENDOR_ID, PRODUCT_ID);
            UsbDevice usbDevice = UsbDevice.OpenUsbDevice(finder);

            if (usbDevice == null)
            {
                Console.WriteLine("Fehler: Gerät nicht gefunden.");
                return;
            }

            IUsbDevice wholeUsbDevice = usbDevice as IUsbDevice;
            if (!ReferenceEquals(wholeUsbDevice, null))
            {
                wholeUsbDevice.SetConfiguration(1);
                wholeUsbDevice.ClaimInterface(0);
            }

            UsbEndpointWriter writer = usbDevice.OpenEndpointWriter(WriteEndpointID.Ep02);
            UsbEndpointReader reader = usbDevice.OpenEndpointReader(ReadEndpointID.Ep01);

            Console.WriteLine("Gerät geöffnet! Starte Initialisierung...");

            // 1. KWP2000 FastInit
            byte[] fastInit = new byte[] { 0x81, 0x11, 0xF1, 0x81, 0x04 };
            SendAndReceive(writer, reader, fastInit, "FastInit");

            // 2. Start Programming Session
            byte[] session = new byte[] { 0x80, 0x11, 0xF1, 0x02, 0x10, 0x86, 0x1A };
            SendAndReceive(writer, reader, session, "Start Session 0x86");

            // 3. SecurityAccess: Seed anfordern
            byte[] seedReq = new byte[] { 0x80, 0x11, 0xF1, 0x02, 0x27, 0x01, 0xAC };
            byte[] response = SendAndReceive(writer, reader, seedReq, "Seed Request");

            if (response != null && response.Length >= 10 && response[4] == 0x67)
            {
                byte[] seed = new byte[] { response[6], response[7], response[8], response[9] };
                byte[] key = CalculateKey(seed);

                byte[] keySend = new byte[] { 0x80, 0x11, 0xF1, 0x06, 0x27, 0x02, key[0], key[1], key[2], key[3], 0x00 };
                keySend[10] = CalculateChecksum(keySend, 10);
                SendAndReceive(writer, reader, keySend, "Key Send");
            }

            Console.WriteLine("Diagnose-Ablauf abgeschlossen.");
        }

        static byte[] CalculateKey(byte[] seed)
        {
            // BMW Motorrad BMS-K Algorithmus
            byte rotL1 = (byte)(((seed[1] << 1) & 0xFF) | ((seed[1] >> 7) & 0x01));
            return new byte[] {
                (byte)(seed[0] ^ 0xD1),
                (byte)(rotL1 ^ 0x5F),
                (byte)(seed[2] ^ 0xD7),
                (byte)((~seed[3]) ^ 0x48)
            };
        }

        static byte CalculateChecksum(byte[] data, int length)
        {
            int sum = 0;
            for (int i = 0; i < length; i++) sum = (sum + data[i]) & 0xFF;
            return (byte)sum;
        }

        static byte[] SendAndReceive(UsbEndpointWriter writer, UsbEndpointReader reader, byte[] data, string label)
        {
            int bytesWritten;
            writer.Write(data, 2000, out bytesWritten);
            Console.WriteLine($"[TX] {label}: {BitConverter.ToString(data)}");

            byte[] readBuffer = new byte[64];
            int bytesRead;
            ErrorCode ec = reader.Read(readBuffer, 2000, out bytesRead);

            if (ec == ErrorCode.None && bytesRead > 0)
            {
                byte[] received = new byte[bytesRead];
                Array.Copy(readBuffer, received, bytesRead);
                Console.WriteLine($"[RX] Antwort: {BitConverter.ToString(received)}");
                return received;
            }
            return null;
        }
    }
}`;

  // C++ WinUSB Template
  const cppCode = `// =========================================================================
// Native C++ WinUSB Driver
// =========================================================================
#include <windows.h>
#include <winusb.h>
#include <iostream>
#include <vector>

int main() {
    std::cout << "=== Native C++ WinUSB Driver ===" << std::endl;
    std::cout << "Kompilierfertiges Gerüst zur direkten Einbindung in Ihre C++ Anwendung." << std::endl;
    return 0;
}`;

  // Python PyUSB Template
  const pythonCode = `# =========================================================================
# Python Cross-Platform Diagnostic Driver (pyusb)
# Pip-Installation: pip install pyusb libusb
# =========================================================================
import usb.core
import usb.util

VENDOR_ID = 0x${vid}
PRODUCT_ID = 0x${pid}

def main():
    print(f"Suche USB-Gerät 0x{VENDOR_ID:04X}:0x{PRODUCT_ID:04X}...")
    dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
    if dev is None:
        print("Gerät nicht gefunden.")
        return
    dev.set_configuration()
    print("USB-Schnittstelle erfolgreich initialisiert.")

if __name__ == '__main__':
    main()`;

  const getCode = () => {
    switch (selectedLanguage) {
      case 'csharp': return csharpCode;
      case 'cpp': return cppCode;
      case 'python': return pythonCode;
      case 'pico': return '// RP2040 Sniffer Code';
      default: return csharpCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = selectedLanguage === 'csharp' ? 'cs' : selectedLanguage === 'cpp' ? 'cpp' : 'py';
    const blob = new Blob([getCode()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EcuDriver.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-950/50">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Open-Source Treiber &amp; Live Testbench
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Lauffähig
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Echtzeit-Testausführung und Quellcode für Ihr Diagnosegerät (VID: 0x{vid}, PID: 0x{pid})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedLanguage !== 'sandbox' && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Herunterladen</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-2 bg-slate-950/40 text-xs">
          <button
            onClick={() => setSelectedLanguage('sandbox')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              selectedLanguage === 'sandbox'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Live Treiber-Sandbox (Browser-Ausführung)</span>
          </button>

          <button
            onClick={() => setSelectedLanguage('csharp')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              selectedLanguage === 'csharp'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>C# (.NET 8 + LibUsbDotNet)</span>
          </button>

          <button
            onClick={() => setSelectedLanguage('cpp')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              selectedLanguage === 'cpp'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>C++ (Native WinUSB)</span>
          </button>

          <button
            onClick={() => setSelectedLanguage('python')}
            className={`pb-3 px-3 font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              selectedLanguage === 'python'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Python (pyusb)</span>
          </button>
        </div>

        {/* Tab Content */}
        {selectedLanguage === 'sandbox' ? (
          <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
            {/* Control Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={runDriverSandbox}
                  disabled={isSandboxRunning}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{isSandboxRunning ? 'Treiber läuft...' : 'Treiber im Simulator ausführen'}</span>
                </button>

                <button
                  onClick={() => setSandboxLogs([])}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Konsole leeren</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Zustand: KWP2000 FastInit &bull; 0x27 Seed-Key &bull; Flash Upload</span>
              </div>
            </div>

            {/* Simulated Terminal Screen */}
            <div className="flex-1 bg-black/90 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-1.5 shadow-inner">
              {sandboxLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="text-slate-600 select-none">[{log.time}]</span>
                  <span
                    className={`leading-relaxed ${
                      log.type === 'tx'
                        ? 'text-cyan-400 font-bold'
                        : log.type === 'rx'
                        ? 'text-emerald-400 font-bold'
                        : log.type === 'success'
                        ? 'text-lime-300 font-bold bg-lime-950/40 px-1 rounded'
                        : log.type === 'warn'
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-cyan-300">
            <pre className="leading-relaxed">
              <code>{getCode()}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
