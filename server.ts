import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI with recommended telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper: Checksum guessing engine
function testChecksumAlgorithms(hexStr: string) {
  const cleanHex = hexStr.replace(/[^0-9A-Fa-f]/g, '');
  if (cleanHex.length < 4 || cleanHex.length % 2 !== 0) {
    return { matches: [] };
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }

  const matches: Array<{
    name: string;
    description: string;
    expected: string;
    calculated: string;
    byteIndex: number;
  }> = [];

  if (bytes.length >= 2) {
    // Test 1-byte checksums on bytes[0 ... len-2] with target = bytes[len-1]
    const data1 = bytes.slice(0, bytes.length - 1);
    const target1 = bytes[bytes.length - 1];

    // 1. Modulo 256 Sum
    let sum = 0;
    for (const b of data1) sum = (sum + b) & 0xff;
    if (sum === target1) {
      matches.push({
        name: 'Sum8 (Modulo 256)',
        description: 'Einfache 8-Bit-Summe über alle vorherigen Datenbytes (Mod 256).',
        expected: `0x${target1.toString(16).padStart(2, '0').toUpperCase()}`,
        calculated: `0x${sum.toString(16).padStart(2, '0').toUpperCase()}`,
        byteIndex: bytes.length - 1,
      });
    }

    // 2. Two's Complement Sum (Common in KWP2000 / ISO9141)
    const twosComp = (-sum) & 0xff;
    if (twosComp === target1) {
      matches.push({
        name: '2s Complement Sum8',
        description: 'Zweierkomplement der 8-Bit-Summe (üblich bei KWP2000 / K-Line).',
        expected: `0x${target1.toString(16).padStart(2, '0').toUpperCase()}`,
        calculated: `0x${twosComp.toString(16).padStart(2, '0').toUpperCase()}`,
        byteIndex: bytes.length - 1,
      });
    }

    // 3. One's Complement Sum (Inverted Sum)
    const onesComp = (~sum) & 0xff;
    if (onesComp === target1) {
      matches.push({
        name: 'Inverted Sum8 (~Sum)',
        description: 'Einerkomplement (Bit-Inversion) der 8-Bit-Summe.',
        expected: `0x${target1.toString(16).padStart(2, '0').toUpperCase()}`,
        calculated: `0x${onesComp.toString(16).padStart(2, '0').toUpperCase()}`,
        byteIndex: bytes.length - 1,
      });
    }

    // 4. XOR / BCC (Block Check Character)
    let xor = 0;
    for (const b of data1) xor ^= b;
    if (xor === target1) {
      matches.push({
        name: 'XOR / BCC Checksum',
        description: 'Bitweises XOR aller vorhergehenden Bytes.',
        expected: `0x${target1.toString(16).padStart(2, '0').toUpperCase()}`,
        calculated: `0x${xor.toString(16).padStart(2, '0').toUpperCase()}`,
        byteIndex: bytes.length - 1,
      });
    }

    // 5. CRC-8 (Polynom 0x07 - standard)
    const calcCrc8 = (data: Uint8Array, poly: number, init: number = 0) => {
      let crc = init;
      for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++) {
          crc = (crc & 0x80) ? ((crc << 1) ^ poly) & 0xff : (crc << 1) & 0xff;
        }
      }
      return crc;
    };

    const crc8_07 = calcCrc8(data1, 0x07);
    if (crc8_07 === target1) {
      matches.push({
        name: 'CRC-8 (Poly 0x07 / SMBus)',
        description: 'Standard CRC-8 mit Generator-Polynom 0x07 (x^8 + x^2 + x + 1).',
        expected: `0x${target1.toString(16).padStart(2, '0').toUpperCase()}`,
        calculated: `0x${crc8_07.toString(16).padStart(2, '0').toUpperCase()}`,
        byteIndex: bytes.length - 1,
      });
    }

    const crc8_1d = calcCrc8(data1, 0x1d, 0xff);
    if (crc8_1d === target1) {
      matches.push({
        name: 'CRC-8/SAE-J1850 (Poly 0x1D)',
        description: 'Automotive SAE J1850 CRC-8 mit Polynom 0x1D und Init 0xFF.',
        expected: `0x${target1.toString(16).padStart(2, '0').toUpperCase()}`,
        calculated: `0x${crc8_1d.toString(16).padStart(2, '0').toUpperCase()}`,
        byteIndex: bytes.length - 1,
      });
    }
  }

  // 16-bit Checksums if length >= 3
  if (bytes.length >= 3) {
    const data2 = bytes.slice(0, bytes.length - 2);
    const target16_be = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
    const target16_le = (bytes[bytes.length - 1] << 8) | bytes[bytes.length - 2];

    // CRC16-CCITT (0x1021)
    const calcCrc16 = (data: Uint8Array, poly: number, init: number) => {
      let crc = init;
      for (const b of data) {
        crc ^= (b << 8);
        for (let i = 0; i < 8; i++) {
          crc = (crc & 0x8000) ? ((crc << 1) ^ poly) & 0xffff : (crc << 1) & 0xffff;
        }
      }
      return crc;
    };

    const ccitt_0000 = calcCrc16(data2, 0x1021, 0x0000);
    const ccitt_ffff = calcCrc16(data2, 0x1021, 0xffff);

    if (ccitt_0000 === target16_be) {
      matches.push({
        name: 'CRC-16/CCITT-FALSE (Big Endian)',
        description: 'Polynom 0x1021, Init 0x0000, Big Endian.',
        expected: `0x${target16_be.toString(16).padStart(4, '0').toUpperCase()}`,
        calculated: `0x${ccitt_0000.toString(16).padStart(4, '0').toUpperCase()}`,
        byteIndex: bytes.length - 2,
      });
    }
    if (ccitt_ffff === target16_be) {
      matches.push({
        name: 'CRC-16/XMODEM (Big Endian)',
        description: 'Polynom 0x1021, Init 0xFFFF, Big Endian.',
        expected: `0x${target16_be.toString(16).padStart(4, '0').toUpperCase()}`,
        calculated: `0x${ccitt_ffff.toString(16).padStart(4, '0').toUpperCase()}`,
        byteIndex: bytes.length - 2,
      });
    }
    if (ccitt_0000 === target16_le) {
      matches.push({
        name: 'CRC-16/CCITT-FALSE (Little Endian)',
        description: 'Polynom 0x1021, Init 0x0000, Little Endian.',
        expected: `0x${target16_le.toString(16).padStart(4, '0').toUpperCase()}`,
        calculated: `0x${ccitt_0000.toString(16).padStart(4, '0').toUpperCase()}`,
        byteIndex: bytes.length - 2,
      });
    }
  }

  return { matches, byteCount: bytes.length };
}

// In-memory packet storage and remote command queue for LLM & MCP integration
let serverPacketStore: any[] = [];

interface RemoteCommand {
  id: string;
  command: 'inject_packet' | 'run_sequence' | 'request_seed' | 'send_key' | 'clear' | 'annotate';
  params?: any;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
}

let commandQueue: RemoteCommand[] = [];

// API: Command & Control execution (called by LM Studio or Python Agent)
app.post('/api/control/execute', async (req: Request, res: Response) => {
  try {
    const { command, params } = req.body;
    if (!command) {
      res.status(400).json({ error: 'command parameter required' });
      return;
    }

    const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newCmd: RemoteCommand = {
      id: cmdId,
      command,
      params,
      timestamp: Date.now(),
      status: 'pending',
    };

    commandQueue.push(newCmd);

    // Keep queue at max 50 items
    if (commandQueue.length > 50) {
      commandQueue = commandQueue.slice(-50);
    }

    // Wait up to 1.5s for frontend to pick up and complete the command
    const start = Date.now();
    while (Date.now() - start < 1500) {
      const found = commandQueue.find((c) => c.id === cmdId);
      if (found && found.status !== 'pending') {
        res.json({ success: true, command: found });
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    // Return queued status if still running
    res.json({ success: true, commandId: cmdId, status: 'queued' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// API: Frontend polls for pending remote commands from LM Studio
app.get('/api/control/pending', (_req: Request, res: Response) => {
  const pending = commandQueue.filter((c) => c.status === 'pending');
  res.json({ pending });
});

// API: Frontend reports completion of remote command
app.post('/api/control/complete', (req: Request, res: Response) => {
  const { id, result, error } = req.body;
  const cmd = commandQueue.find((c) => c.id === id);
  if (cmd) {
    cmd.status = error ? 'failed' : 'completed';
    cmd.result = result;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Command not found' });
  }
});

// API: Direct Seed-Key Calculator for LM Studio / Python scripts
app.post('/api/control/solve-seed-key', (req: Request, res: Response) => {
  try {
    const { seedHex, algorithm = 'bms-k' } = req.body;
    if (!seedHex) {
      res.status(400).json({ error: 'seedHex parameter required (e.g. "4A 7E 19 B2")' });
      return;
    }

    const clean = seedHex.replace(/[^0-9A-Fa-f]/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(parseInt(clean.substring(i, i + 2), 16));
    }

    if (bytes.length < 4) {
      res.status(400).json({ error: 'At least 4 bytes required for Seed' });
      return;
    }

    const s0 = bytes[0], s1 = bytes[1], s2 = bytes[2], s3 = bytes[3];

    // BMW Motorrad BMS-K Pattern
    const rotL1 = ((s1 << 1) & 0xff) | ((s1 >> 7) & 0x01);
    const bmsKey = [
      (s0 ^ 0xd1) & 0xff,
      (rotL1 ^ 0x5f) & 0xff,
      (s2 ^ 0xd7) & 0xff,
      ((~s3) ^ 0x48) & 0xff,
    ];

    // Bosch ME7 / EDC15 Pattern
    const boschKey = [
      (s3 ^ 0x55) & 0xff,
      (s2 ^ 0xaa) & 0xff,
      (s1 ^ 0x33) & 0xff,
      (s0 ^ 0xcc) & 0xff,
    ];

    // Siemens SIMOS
    const simosKey = [
      ((s0 + 0x2a) ^ 0x71) & 0xff,
      ((s1 + 0x4b) ^ 0x82) & 0xff,
      ((s2 + 0x6c) ^ 0x93) & 0xff,
      ((s3 + 0x8d) ^ 0xa4) & 0xff,
    ];

    const toHexStr = (arr: number[]) => arr.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    res.json({
      success: true,
      inputSeed: toHexStr(bytes),
      results: {
        'bms-k': {
          name: 'BMW Motorrad BMS-K / BMS-KP',
          keyHex: toHexStr(bmsKey),
          keyBytes: bmsKey,
          formula: 'K0 = S0 ^ 0xD1 | K1 = RotL(S1, 1) ^ 0x5F | K2 = S2 ^ 0xD7 | K3 = (~S3) ^ 0x48',
        },
        'bosch': {
          name: 'Bosch ME7 / EDC15 (Endian Swap + Mask)',
          keyHex: toHexStr(boschKey),
          keyBytes: boschKey,
          formula: 'K0 = S3 ^ 0x55 | K1 = S2 ^ 0xAA | K2 = S1 ^ 0x33 | K3 = S0 ^ 0xCC',
        },
        'siemens': {
          name: 'Siemens / Continental SIMOS',
          keyHex: toHexStr(simosKey),
          keyBytes: simosKey,
          formula: 'K0 = (S0 + 0x2A) ^ 0x71 | K1 = (S1 + 0x4B) ^ 0x82 | ...',
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// API: Ingest or sync packets from frontend
app.post('/api/packets/ingest', (req: Request, res: Response) => {
  try {
    const { packets } = req.body;
    if (Array.isArray(packets)) {
      serverPacketStore = packets;
      res.json({ success: true, storedCount: serverPacketStore.length });
    } else {
      res.status(400).json({ error: 'packets array required' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// API: Get structured logs formatted for LM Studio & LLM Prompting
app.get('/api/packets', (req: Request, res: Response) => {
  // Format into Challenge-Response Request/Response pairs
  const pairs: any[] = [];
  let pendingRequest: any = null;

  for (const pkt of serverPacketStore) {
    if (pkt.direction === 'HOST_TO_DEVICE') {
      if (pendingRequest) {
        pairs.push({
          request: pendingRequest,
          response: null,
          note: 'No response received before next request',
        });
      }
      pendingRequest = pkt;
    } else if (pkt.direction === 'DEVICE_TO_HOST') {
      if (pendingRequest) {
        const isSecurity =
          (pendingRequest.protocolTag?.includes('0x27') && pkt.protocolTag?.includes('0x67')) ||
          (pendingRequest.hexString?.includes('27 01') && pkt.hexString?.includes('67 01')) ||
          (pendingRequest.hexString?.includes('27 02') && (pkt.hexString?.includes('67 02') || pkt.hexString?.includes('7F 27')));

        pairs.push({
          requestId: pendingRequest.packetNumber,
          responseId: pkt.packetNumber,
          request: {
            endpoint: pendingRequest.endpoint,
            hex: pendingRequest.hexString,
            ascii: pendingRequest.asciiString,
            tag: pendingRequest.protocolTag,
            summary: pendingRequest.decodedSummary,
          },
          response: {
            endpoint: pkt.endpoint,
            hex: pkt.hexString,
            ascii: pkt.asciiString,
            tag: pkt.protocolTag,
            summary: pkt.decodedSummary,
            isError: pkt.isError,
          },
          latencyMs: pkt.deltaMs,
          isSecurityExchange: isSecurity,
        });
        pendingRequest = null;
      } else {
        pairs.push({
          request: null,
          response: pkt,
          note: 'Unsolicited response / device event',
        });
      }
    }
  }

  if (pendingRequest) {
    pairs.push({ request: pendingRequest, response: null });
  }

  res.json({
    totalPackets: serverPacketStore.length,
    transactionPairsCount: pairs.length,
    transactions: pairs,
  });
});

// API: Model Context Protocol (MCP) Tools definition
app.get('/api/mcp/tools', (_req: Request, res: Response) => {
  res.json({
    tools: [
      {
        name: 'get_usb_packet_logs',
        description: 'Liest alle erfassten USB-Pakete als strukturierte Request-Response Transaktionen (Hex, ASCII, UDS-Dienste) aus.',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Optionaler Filter (z. B. "0x27", "security", "all")',
            },
          },
        },
      },
      {
        name: 'test_checksum_algorithm',
        description: 'Prüft ein Byte-Array gegen Sum8, Zweierkomplement, XOR und CRC8/16.',
        inputSchema: {
          type: 'object',
          properties: {
            hexString: {
              type: 'string',
              description: 'Hexadezimale Byte-Folge (z. B. "80 11 F1 02 10 86 1A")',
            },
          },
          required: ['hexString'],
        },
      },
      {
        name: 'test_seed_key_formula',
        description: 'Testet eine mathematische Transformationslogik zwischen einem empfangenen Seed und dem erwarteten Key.',
        inputSchema: {
          type: 'object',
          properties: {
            seedHex: { type: 'string', description: '4-Byte Hex Seed (z. B. "4A 7E 19 B2")' },
            xorMaskHex: { type: 'string', description: '4-Byte Hex XOR Maske (z. B. "D1 5F D7 48")' },
          },
          required: ['seedHex', 'xorMaskHex'],
        },
      },
    ],
  });
});

// API: Test LM Studio local connection
app.post('/api/test-lm-studio', async (req: Request, res: Response) => {
  try {
    const { endpoint = 'http://localhost:1234/v1/chat/completions', model = 'local-model' } = req.body;
    const prompt = 'Hallo! Bestätige bitte kurz, dass du als lokales LLM bereit für die Protokollanalyse von USB-URB-Paketen bist.';

    const lmRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!lmRes.ok) {
      const text = await lmRes.text();
      res.status(lmRes.status).json({ error: `LM Studio antwortete mit Fehler: ${text}` });
      return;
    }

    const data = await lmRes.json();
    res.json({ success: true, response: data });
  } catch (err: any) {
    res.status(500).json({
      error: `Verbindung zu LM Studio fehlgeschlagen: ${err?.message || err}. Läuft der LM Studio Local Server auf Port 1234?`,
    });
  }
});

// API: Guess Checksum
app.post('/api/checksum-guess', (req: Request, res: Response) => {
  try {
    const { hexString } = req.body;
    if (!hexString || typeof hexString !== 'string') {
      res.status(400).json({ error: 'hexString parameter is required' });
      return;
    }
    const result = testChecksumAlgorithms(hexString);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Checksum detection failed' });
  }
});

// API: Gemini Protocol AI Analysis
app.post('/api/analyze-protocol', async (req: Request, res: Response) => {
  try {
    const { packets, targetContext, deviceDetails } = req.body;

    if (!packets || !Array.isArray(packets) || packets.length === 0) {
      res.status(400).json({ error: 'No URB packets provided for analysis' });
      return;
    }

    const formattedPackets = packets.slice(0, 40).map((p: any, idx: number) => {
      return `#${idx + 1} [${p.timestamp || '0.000'}] ${p.direction} (EP: ${p.endpoint || '0x01'}, Type: ${p.type || 'Bulk'}) Len: ${p.dataLength || p.hexData?.split(' ').length} | Hex: ${p.hexData} ${p.ascii ? `| ASCII: "${p.ascii}"` : ''}`;
    }).join('\n');

    const prompt = `Du bist ein erfahrener Embedded-Systems- und Reverse-Engineering-Spezialist für USB-Hardware, Fahrzeug-Diagnoseprotokolle (KWP2000 / ISO 14230, UDS / ISO 14229, OBD-II, ISO-TP) und Treiberentwicklung (C#, C++, Python/PyUSB).

Hier ist ein aufgezeichneter USB-Datenstrom (URB IN/OUT Transfers) zwischen einem Host-Computer und einem Steuergeräte-Diagnoseadapter / USB-Gerät:

KONTEXT / ZIEL:
${targetContext || 'Dokumentation des proprietären Kommunikationsprotokolls und Entwicklung eines eigenständigen Open-Source-Ersatztreibers.'}

GERÄTEDETAILS:
${deviceDetails || 'USB Diagnostic Interface (Vendor ID / Product ID)'}

AUFGEZEICHNETE URB-PAKETE:
${formattedPackets}

AUFGABE:
Analysiere die Sequenz gründlich und erstelle eine strukturierte technische Auswertung:
1. **Framing & Protokollstruktur**: Welches Rahmenformat liegt vor? (Startbytes/Header, Längenfeld, Service-ID/Kommando-ID, Nutzdaten, Prüfsumme/CRC).
2. **Erkannte Dienste / Sequenzen**: Welche Kommandos werden gesendet? (z.B. Initialisierung, Baudratenumschaltung, Session-Wechsel, Read Memory, Write Memory, Keep-Alive/TesterPresent).
3. **Sicherheitsmechanismen (Seed-Key / SecurityAccess)**: Wurde eine Challenge-Response-Sequenz (z.B. UDS 0x27 oder KWP 0x27) erkannt? Wie sind Seed und Key strukturiert?
4. **Prüfsummen-Hypothese**: Welche Prüfsumme (Sum8, 2s Complement, XOR/BCC, CRC8, CRC16) passt zu den Paketen?
5. **Code-Implementierung (Open-Source Treiber)**: Erstelle ein vollständiges, sauberes und sofort verständliches C# (LibUsbDotNet) oder C++ (WinUSB) Code-Gerüst, das genau diesen Verbindungsaufbau, das Senden der Kommandos und das Empfangen/Prüfen der Antworten ausführt.

Antworte auf Deutsch in klar gegliedertem Markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const analysisMarkdown = response.text || 'Keine Auswertung erhalten.';

    res.json({
      success: true,
      analysis: analysisMarkdown,
      analyzedPacketCount: packets.length,
    });
  } catch (err: any) {
    console.error('Gemini Protocol Analysis Error:', err);
    res.status(500).json({
      error: err?.message || 'Fehler bei der KI-Protokollanalyse',
    });
  }
});

// Vite middleware in dev or static files in production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[USB-TraceLab Server] Running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
