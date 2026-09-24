import { URBPacket } from '../types/protocol';

export function bytesToHex(bytes: number[] | Uint8Array): string {
  const arr = Array.from(bytes);
  return arr.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function bytesToAscii(bytes: number[] | Uint8Array): string {
  const arr = Array.from(bytes);
  return arr
    .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
    .join('');
}

export function parseHexInput(input: string): number[] {
  const cleaned = input.replace(/0x/gi, '').replace(/[^0-9A-Fa-f]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    if (i + 1 < cleaned.length) {
      bytes.push(parseInt(cleaned.substring(i, i + 2), 16));
    }
  }
  return bytes;
}

export interface DecodedInfo {
  tag: string;
  summary: string;
  serviceId?: number;
  subFunction?: number;
  isPositiveResponse?: boolean;
  isNegativeResponse?: boolean;
  nrcCode?: number;
  nrcDescription?: string;
  seedHex?: string;
  keyHex?: string;
}

// NRC descriptions for ISO 14229 / ISO 14230
const NRC_TABLE: Record<number, string> = {
  0x10: 'General Reject',
  0x11: 'Service Not Supported',
  0x12: 'Sub-Function Not Supported',
  0x13: 'Incorrect Message Length Or Invalid Format',
  0x14: 'Response Too Long',
  0x21: 'Busy Repeat Request',
  0x22: 'Conditions Not Correct',
  0x24: 'Request Sequence Error',
  0x31: 'Request Out Of Range',
  0x33: 'Security Access Denied',
  0x35: 'Invalid Key (Seed-Key Check Failed)',
  0x36: 'Exceeded Number Of Attempts',
  0x37: 'Required Time Delay Not Expired',
  0x78: 'Request Correctly Received - Response Pending (Wait)',
  0x7E: 'Sub-Function Not Supported In Active Session',
  0x7F: 'Service Not Supported In Active Session',
};

export function decodeAutomotiveFrame(bytes: number[]): DecodedInfo {
  if (!bytes || bytes.length === 0) {
    return { tag: 'EMPTY', summary: 'Keine Daten vorhanden' };
  }

  // Detect FTDI Status header (often 2 modem status bytes e.g. 0x01 0x60)
  let payload = bytes;
  let offset = 0;

  // Check if K-Line / KWP2000 framing (Header byte >= 0x80)
  // Format: [FormatByte, TargetAddr, SourceAddr, (OptLength), ServiceID, ...]
  if (bytes[0] >= 0x80 && bytes[0] <= 0xBF && bytes.length >= 4) {
    const fmt = bytes[0];
    const target = bytes[1];
    const source = bytes[2];
    const lengthInHeader = fmt & 0x3f;
    let sidIndex = 3;
    if (lengthInHeader === 0 && bytes.length > 4) {
      sidIndex = 4; // Length byte is in payload
    }

    if (bytes.length > sidIndex) {
      const sid = bytes[sidIndex];
      return decodeDiagnosticSid(sid, bytes.slice(sidIndex), `KWP2000 (Fmt: 0x${fmt.toString(16).toUpperCase()})`);
    }
  }

  // Standard raw ISO-TP / UDS or direct diagnostic byte stream
  // Check if first byte is a Single Frame (SF) in ISO-TP (0x01 to 0x07)
  if (bytes[0] <= 0x07 && bytes.length > 1) {
    const sfLength = bytes[0];
    const sid = bytes[1];
    return decodeDiagnosticSid(sid, bytes.slice(1, 1 + sfLength), 'ISO-TP (Single Frame)');
  }

  // Direct SID test
  return decodeDiagnosticSid(bytes[0], bytes, 'Raw Diagnostic');
}

function decodeDiagnosticSid(sid: number, frame: number[], contextPrefix: string): DecodedInfo {
  // Negative Response (0x7F)
  if (sid === 0x7F && frame.length >= 3) {
    const rejectedSid = frame[1];
    const nrc = frame[2];
    const nrcText = NRC_TABLE[nrc] || `Unbekannter NRC (0x${nrc.toString(16).toUpperCase()})`;
    return {
      tag: 'NRC 0x7F',
      summary: `[NRC] Abgelehnt für Dienst 0x${rejectedSid.toString(16).toUpperCase()}: ${nrcText}`,
      serviceId: rejectedSid,
      isNegativeResponse: true,
      nrcCode: nrc,
      nrcDescription: nrcText,
    };
  }

  // 0x10: DiagnosticSessionControl
  if (sid === 0x10) {
    const sub = frame[1];
    const sessionNames: Record<number, string> = {
      0x01: 'Default Session',
      0x02: 'Programming Session (Flashing)',
      0x03: 'Extended Diagnostic Session',
      0x85: 'Safety System Session',
      0x86: 'KWP Fast Init Session',
    };
    const sess = sessionNames[sub] || `Session 0x${sub?.toString(16).toUpperCase()}`;
    return {
      tag: 'UDS 0x10 Session',
      summary: `SessionControl Anforderung: ${sess}`,
      serviceId: sid,
      subFunction: sub,
    };
  }

  // 0x50: Positive Response to 0x10
  if (sid === 0x50) {
    const sub = frame[1];
    return {
      tag: 'UDS 0x50 Session OK',
      summary: `Diagnose-Session bestätigt (Typ 0x${sub?.toString(16).toUpperCase() || 'OK'})`,
      serviceId: sid,
      isPositiveResponse: true,
    };
  }

  // 0x27: SecurityAccess (Request Seed or Send Key)
  if (sid === 0x27) {
    const sub = frame[1];
    const isSeedRequest = (sub % 2 === 1); // 0x01, 0x03, 0x05 are seed requests
    if (isSeedRequest) {
      return {
        tag: 'UDS 0x27 Seed Req',
        summary: `SecurityAccess: Seed-Anforderung (Level 0x${sub.toString(16).toUpperCase()})`,
        serviceId: sid,
        subFunction: sub,
      };
    } else {
      const keyBytes = frame.slice(2);
      return {
        tag: 'UDS 0x27 Key Send',
        summary: `SecurityAccess: Berechneter Schlüssel gesendet [${bytesToHex(keyBytes)}]`,
        serviceId: sid,
        subFunction: sub,
        keyHex: bytesToHex(keyBytes),
      };
    }
  }

  // 0x67: Positive Response to 0x27 (returns Seed or Unlock OK)
  if (sid === 0x67) {
    const sub = frame[1];
    const isSeedResponse = (sub % 2 === 1);
    if (isSeedResponse) {
      const seedBytes = frame.slice(2);
      return {
        tag: 'UDS 0x67 Seed Ret',
        summary: `SecurityAccess: ECU Seed empfangen [${bytesToHex(seedBytes)}]`,
        serviceId: sid,
        subFunction: sub,
        isPositiveResponse: true,
        seedHex: bytesToHex(seedBytes),
      };
    } else {
      return {
        tag: 'UDS 0x67 Unlocked',
        summary: 'SecurityAccess: ECU erfolgreich entsperrt (Schlüssel akzeptiert)!',
        serviceId: sid,
        subFunction: sub,
        isPositiveResponse: true,
      };
    }
  }

  // 0x22: ReadDataByIdentifier
  if (sid === 0x22) {
    const did = frame.length >= 3 ? (frame[1] << 8) | frame[2] : undefined;
    const didDesc = getDidDescription(did);
    return {
      tag: 'UDS 0x22 ReadData',
      summary: `ReadDataByIdentifier: DID 0x${did?.toString(16).padStart(4, '0').toUpperCase()} (${didDesc})`,
      serviceId: sid,
    };
  }

  // 0x62: Positive Response to 0x22
  if (sid === 0x62) {
    const did = frame.length >= 3 ? (frame[1] << 8) | frame[2] : undefined;
    const didData = frame.slice(3);
    return {
      tag: 'UDS 0x62 Data Ret',
      summary: `DID 0x${did?.toString(16).padStart(4, '0').toUpperCase()}: [${bytesToHex(didData)}] ("${bytesToAscii(didData)}")`,
      serviceId: sid,
      isPositiveResponse: true,
    };
  }

  // 0x34: RequestDownload
  if (sid === 0x34) {
    return {
      tag: 'UDS 0x34 Flash Req',
      summary: 'RequestDownload: Flash-Download ins Steuergerät angefordert',
      serviceId: sid,
    };
  }

  // 0x74: Positive Response to 0x34
  if (sid === 0x74) {
    return {
      tag: 'UDS 0x74 Flash OK',
      summary: 'RequestDownload bestätigt: ECU bereit für Datenübertragung',
      serviceId: sid,
      isPositiveResponse: true,
    };
  }

  // 0x36: TransferData
  if (sid === 0x36) {
    const blockSeq = frame[1];
    const dataLen = frame.length - 2;
    return {
      tag: 'UDS 0x36 Data Block',
      summary: `TransferData: Block #${blockSeq} mit ${dataLen} Bytes Nutzdaten`,
      serviceId: sid,
      subFunction: blockSeq,
    };
  }

  // 0x76: Positive Response to 0x36
  if (sid === 0x76) {
    const blockSeq = frame[1];
    return {
      tag: 'UDS 0x76 Block ACK',
      summary: `TransferData Block #${blockSeq} bestätigt`,
      serviceId: sid,
      isPositiveResponse: true,
    };
  }

  // 0x37: RequestTransferExit
  if (sid === 0x37) {
    return {
      tag: 'UDS 0x37 Transfer Exit',
      summary: 'RequestTransferExit: Flash-Schreibvorgang beendet',
      serviceId: sid,
    };
  }

  // 0x3E: TesterPresent (Keepalive)
  if (sid === 0x3E) {
    return {
      tag: 'UDS 0x3E Keepalive',
      summary: 'TesterPresent (Heartbeat / Keep-Alive)',
      serviceId: sid,
    };
  }

  if (sid === 0x7E) {
    return {
      tag: 'UDS 0x7E Keepalive OK',
      summary: 'TesterPresent bestätigt',
      serviceId: sid,
      isPositiveResponse: true,
    };
  }

  // KWP2000 0x1A: ReadEcuIdentification
  if (sid === 0x1A) {
    return {
      tag: 'KWP 0x1A Ident Req',
      summary: `KWP2000 ReadECUIdentification (Typ 0x${frame[1]?.toString(16).toUpperCase()})`,
      serviceId: sid,
    };
  }

  if (sid === 0x5A) {
    return {
      tag: 'KWP 0x5A Ident OK',
      summary: `KWP2000 Steuergeräte-Identifikation: "${bytesToAscii(frame.slice(2))}"`,
      serviceId: sid,
      isPositiveResponse: true,
    };
  }

  // KWP2000 0x23: ReadMemoryByAddress
  if (sid === 0x23) {
    return {
      tag: 'KWP 0x23 Read Mem',
      summary: 'ReadMemoryByAddress: Speicherbereich wird aus Steuergerät ausgelesen',
      serviceId: sid,
    };
  }

  return {
    tag: `CMD 0x${sid.toString(16).padStart(2, '0').toUpperCase()}`,
    summary: `${contextPrefix}: Dienst/Kommando-Byte 0x${sid.toString(16).padStart(2, '0').toUpperCase()} mit ${frame.length} Bytes`,
    serviceId: sid,
  };
}

function getDidDescription(did?: number): string {
  if (did === undefined) return 'Unbekannt';
  const DID_MAP: Record<number, string> = {
    0xF190: 'VIN / Fahrgestellnummer',
    0xF189: 'ECU Software Kalibrierungs-ID',
    0xF187: 'Ersatzteilnummer / Part Number',
    0xF188: 'Software-Teilenummer',
    0xF191: 'ECU Hardware-Nummer',
    0xF197: 'System Name / Motortyp',
    0xF199: 'Programmierdatum',
  };
  return DID_MAP[did] || `Proprietäre DID 0x${did.toString(16).padStart(4, '0').toUpperCase()}`;
}

// Pre-packaged realistic sample dataset of a motorcycle ECU diagnostic & flash read session
export function getSampleMotorcycleEcuTrace(): URBPacket[] {
  const rawPackets = [
    // 1. FTDI / USB Adapter Init (Baudrate set 10400 K-Line)
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x00 (Control)',
      type: 'Control' as const,
      bytes: [0x40, 0x03, 0x41, 0x38, 0x00, 0x00, 0x00, 0x00],
      delta: 0,
      tag: 'USB Vendor Setup',
      summary: 'FTDI USB: Set Baud Rate auf 10400 Baud (K-Line Diagnostic)',
    },
    // 2. K-Line Fast Init (0x81 0x11 0xF1 0x81 0x04)
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x81, 0x11, 0xF1, 0x81, 0x04],
      delta: 42,
      tag: 'KWP 0x81 FastInit',
      summary: 'KWP2000 StartCommunicationRequest (Target: 0x11 ECU, Source: 0xF1 Tester)',
    },
    // 3. ECU Reply to FastInit (0x80 0xF1 0x11 0x03 0xC1 0xEA 0x8F 0x8E)
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x03, 0xC1, 0xEA, 0x8F, 0x8E],
      delta: 18,
      tag: 'KWP 0xC1 Connect OK',
      summary: 'StartCommunicationPositiveResponse: KeyBytes 0xEA 0x8F (KWP2000 aktiv)',
    },
    // 4. Request Extended Diagnostic Session (0x80 0x11 0xF1 0x02 0x10 0x86 0x1A)
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x02, 0x10, 0x86, 0x1A],
      delta: 35,
      tag: 'UDS 0x10 Session',
      summary: 'StartDiagnosticSession: Umschaltung in Extended/Programming Session (0x86)',
    },
    // 5. ECU Response Session OK (0x80 0xF1 0x11 0x02 0x50 0x86 0x5A)
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x02, 0x50, 0x86, 0x5A],
      delta: 22,
      tag: 'UDS 0x50 Session OK',
      summary: 'Session bestätigt: Steuergerät befindet sich im Programmiermodus',
    },
    // 6. Read ECU Identification (0x80 0x11 0xF1 0x02 0x1A 0x9B 0x3E)
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x02, 0x1A, 0x9B, 0x3E],
      delta: 40,
      tag: 'KWP 0x1A Ident Req',
      summary: 'ReadECUIdentification: Modell, Softwarestand & Teilenummer abfragen',
    },
    // 7. ECU Reply with Identification (0x80 0xF1 0x11 0x0F 0x5A 0x9B ... "BMS-MP 1200GS")
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x0E, 0x5A, 0x9B, 0x42, 0x4D, 0x53, 0x2D, 0x4B, 0x31, 0x32, 0x30, 0x30, 0x47, 0x53, 0x7C],
      delta: 29,
      tag: 'KWP 0x5A Ident OK',
      summary: 'Identifikation empfangen: "BMS-K1200GS" (Motorrad Steuergerät)',
    },
    // 8. SecurityAccess: Request Seed (0x80 0x11 0xF1 0x02 0x27 0x01 0xAC)
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x02, 0x27, 0x01, 0xAC],
      delta: 55,
      tag: 'UDS 0x27 Seed Req',
      summary: 'SecurityAccess: Fordert 4-Byte Zufalls-Seed von der ECU an (Level 0x01)',
    },
    // 9. ECU Sends Seed: [0x4A, 0x7E, 0x19, 0xB2]
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x06, 0x67, 0x01, 0x4A, 0x7E, 0x19, 0xB2, 0xD4],
      delta: 19,
      tag: 'UDS 0x67 Seed Ret',
      summary: 'SecurityAccess Seed geliefert: [4A 7E 19 B2] -> Tool muss Key berechnen',
    },
    // 10. Tool sends calculated Key: [0x9B, 0x21, 0xCE, 0x5D]
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x06, 0x27, 0x02, 0x9B, 0x21, 0xCE, 0x5D, 0x48],
      delta: 32,
      tag: 'UDS 0x27 Key Send',
      summary: 'SecurityAccess Key übertragen: [9B 21 CE 5D] (Seed-Key Challenge-Response)',
    },
    // 11. ECU Confirms Unlock!
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x02, 0x67, 0x02, 0xED],
      delta: 24,
      tag: 'UDS 0x67 Unlocked',
      summary: 'SecurityAccess bestätigt! Steuergerät ist freigeschaltet (Flash Schreibzugriff aktiv)',
    },
    // 12. Request Download (Flash Prep)
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x07, 0x34, 0x00, 0x44, 0x00, 0x08, 0x00, 0x00, 0xDF],
      delta: 45,
      tag: 'UDS 0x34 Flash Req',
      summary: 'RequestDownload: Flash-Adresse 0x00080000, unkomprimiert',
    },
    // 13. ECU Acknowledges Download
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x03, 0x74, 0x20, 0x80, 0xB9],
      delta: 30,
      tag: 'UDS 0x74 Flash OK',
      summary: 'ECU bereit: Max Block-Länge = 128 Bytes (0x80)',
    },
    // 14. TransferData Block 0x01
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x12, 0x36, 0x01, 0xAA, 0x55, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x93],
      delta: 62,
      tag: 'UDS 0x36 Block 01',
      summary: 'TransferData Block #1: Erste 16 Flash-Bytes geschrieben',
    },
    // 15. ECU Block 0x01 Acknowledged
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x02, 0x76, 0x01, 0x0B],
      delta: 18,
      tag: 'UDS 0x76 Block ACK',
      summary: 'Block #1 erfolgreich in EEPROM/Flash programmiert',
    },
    // 16. TesterPresent Keep-Alive
    {
      dir: 'HOST_TO_DEVICE' as const,
      ep: '0x02 (OUT)',
      type: 'Bulk' as const,
      bytes: [0x80, 0x11, 0xF1, 0x02, 0x3E, 0x80, 0x42],
      delta: 100,
      tag: 'UDS 0x3E Keepalive',
      summary: 'TesterPresent (Session-Timeout verhindern, P2/P3 Timer Refresh)',
    },
    // 17. TesterPresent ACK
    {
      dir: 'DEVICE_TO_HOST' as const,
      ep: '0x81 (IN)',
      type: 'Bulk' as const,
      bytes: [0x80, 0xF1, 0x11, 0x02, 0x7E, 0x80, 0x82],
      delta: 15,
      tag: 'UDS 0x7E Keepalive OK',
      summary: 'Keep-Alive bestätigt, Session aktiv gehalten',
    },
  ];

  let cumulativeTime = Date.now() - 5000;

  return rawPackets.map((p, idx) => {
    cumulativeTime += p.delta;
    return {
      id: `sample-${idx + 1}`,
      packetNumber: idx + 1,
      timestamp: cumulativeTime,
      deltaMs: p.delta,
      direction: p.dir,
      endpoint: p.ep,
      transferType: p.type,
      rawBytes: p.bytes,
      hexString: bytesToHex(p.bytes),
      asciiString: bytesToAscii(p.bytes),
      byteCount: p.bytes.length,
      protocolTag: p.tag,
      decodedSummary: p.summary,
      isError: false,
    };
  });
}
