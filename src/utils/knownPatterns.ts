import { KnownSeedKeyPattern, URBPacket } from '../types/protocol';

export const KNOWN_SEED_KEY_PATTERNS: KnownSeedKeyPattern[] = [
  {
    id: 'bms_k_moto',
    name: 'BMW Motorrad BMS-K / BMS-KP',
    ecuFamily: 'BMW Motorrad (BMS-K 1200 / F800 / K1300 / S1000RR K-Line & CAN)',
    description: 'Kombinierte Bit-Rotation und 4-Byte statische XOR-Transformation.',
    formulaDescription: 'K0 = S0 ^ 0xD1 | K1 = RotL(S1, 1) ^ 0x5F | K2 = S2 ^ 0xD7 | K3 = (~S3) ^ 0x48',
    testFunction: (seed: number[]) => {
      if (seed.length < 4) return [0, 0, 0, 0];
      const s0 = seed[0], s1 = seed[1], s2 = seed[2], s3 = seed[3];
      const rotL1 = ((s1 << 1) & 0xff) | ((s1 >> 7) & 0x01);
      return [
        (s0 ^ 0xd1) & 0xff,
        (rotL1 ^ 0x5f) & 0xff,
        (s2 ^ 0xd7) & 0xff,
        ((~s3) ^ 0x48) & 0xff,
      ];
    },
  },
  {
    id: 'bosch_me7_edc15',
    name: 'Bosch ME7.x / EDC15 / VAG & Moto',
    ecuFamily: 'Bosch Automotive & European Moto (Ducati, KTM, Aprilia)',
    description: 'Endianness Byte-Swap mit alternierender 4-Byte XOR-Maske (0x55, 0xAA, 0x33, 0xCC).',
    formulaDescription: 'K0 = S3 ^ 0x55 | K1 = S2 ^ 0xAA | K2 = S1 ^ 0x33 | K3 = S0 ^ 0xCC',
    testFunction: (seed: number[]) => {
      if (seed.length < 4) return [0, 0, 0, 0];
      return [
        (seed[3] ^ 0x55) & 0xff,
        (seed[2] ^ 0xaa) & 0xff,
        (seed[1] ^ 0x33) & 0xff,
        (seed[0] ^ 0xcc) & 0xff,
      ];
    },
  },
  {
    id: 'marelli_iaw',
    name: 'Magneti Marelli IAW (5AM / 7SM)',
    ecuFamily: 'Magneti Marelli (Ducati Monster/Panigale, Moto Guzzi, Aprilia RSV4)',
    description: '16-Bit Word-Fold mit Konstante 0x4D47 ("MG") und 16-Bit Bit-Invertierung.',
    formulaDescription: 'Word0 = (S0<<8 | S1) ^ 0x4D47 | Word1 = (~(S2<<8 | S3)) ^ 0x734D',
    testFunction: (seed: number[]) => {
      if (seed.length < 4) return [0, 0, 0, 0];
      const w0 = (((seed[0] << 8) | seed[1]) ^ 0x4d47) & 0xffff;
      const w1 = ((~((seed[2] << 8) | seed[3])) ^ 0x734d) & 0xffff;
      return [(w0 >> 8) & 0xff, w0 & 0xff, (w1 >> 8) & 0xff, w1 & 0xff];
    },
  },
  {
    id: 'siemens_continental',
    name: 'Siemens / Continental SIMOS / MSD',
    ecuFamily: 'Continental / Siemens (VDO, BMW, KTM)',
    description: 'Additiver Offset pro Byte mit anschließender XOR-Verschleierung.',
    formulaDescription: 'K0 = (S0 + 0x2A) ^ 0x71 | K1 = (S1 + 0x4B) ^ 0x82 | K2 = (S2 + 0x6C) ^ 0x93 | K3 = (S3 + 0x8D) ^ 0xA4',
    testFunction: (seed: number[]) => {
      if (seed.length < 4) return [0, 0, 0, 0];
      return [
        ((seed[0] + 0x2a) ^ 0x71) & 0xff,
        ((seed[1] + 0x4b) ^ 0x82) & 0xff,
        ((seed[2] + 0x6c) ^ 0x93) & 0xff,
        ((seed[3] + 0x8d) ^ 0xa4) & 0xff,
      ];
    },
  },
  {
    id: 'keihin_denso_moto',
    name: 'Keihin / Denso Motorcycle (Japanisch)',
    ecuFamily: 'Keihin & Denso (Honda CBR, Yamaha R1/R6, Kawasaki Ninja, Suzuki GSX-R)',
    description: 'Bitweiser 3-Bit Circular Shift (RotR 3) mit 0x5A Maskierung.',
    formulaDescription: 'K[i] = (((S[i] >> 3) | (S[i] << 5)) ^ 0x5A) & 0xFF',
    testFunction: (seed: number[]) => {
      if (seed.length < 4) return [0, 0, 0, 0];
      return seed.slice(0, 4).map((b) => (((b >> 3) | (b << 5)) ^ 0x5a) & 0xff);
    },
  },
  {
    id: 'generic_xor_55aa',
    name: 'Generische Alternierende XOR-Maske (0x55 / 0xAA)',
    ecuFamily: 'Allgemeine Embedded ISO 14229 Standard-Steuergeräte',
    description: 'Klassische Test- und Schutzmaske in Entwicklungs- und Standardständen.',
    formulaDescription: 'K0 = S0 ^ 0x55 | K1 = S1 ^ 0xAA | K2 = S2 ^ 0x55 | K3 = S3 ^ 0xAA',
    testFunction: (seed: number[]) => {
      if (seed.length < 4) return [0, 0, 0, 0];
      return [
        (seed[0] ^ 0x55) & 0xff,
        (seed[1] ^ 0xaa) & 0xff,
        (seed[2] ^ 0x55) & 0xff,
        (seed[3] ^ 0xaa) & 0xff,
      ];
    },
  },
];

// Evaluates a seed and observed key against all known patterns
export function matchSeedKeyAgainstKnownPatterns(seed: number[], observedKey: number[]) {
  if (seed.length < 4 || observedKey.length < 4) return [];

  const results: Array<{
    pattern: KnownSeedKeyPattern;
    calculatedKey: number[];
    isExactMatch: boolean;
    matchingByteCount: number;
  }> = [];

  for (const pattern of KNOWN_SEED_KEY_PATTERNS) {
    const calc = pattern.testFunction(seed);
    let matchCount = 0;
    for (let i = 0; i < 4; i++) {
      if (calc[i] === observedKey[i]) matchCount++;
    }

    results.push({
      pattern,
      calculatedKey: calc,
      isExactMatch: matchCount === 4,
      matchingByteCount: matchCount,
    });
  }

  // Sort: exact matches first, then highest matching byte count
  return results.sort((a, b) => {
    if (a.isExactMatch && !b.isExactMatch) return -1;
    if (!a.isExactMatch && b.isExactMatch) return 1;
    return b.matchingByteCount - a.matchingByteCount;
  });
}

// Analyzes captured packets specifically for Read & Write operations
export interface FlashSessionAnalysis {
  hasSecurityUnlock: boolean;
  securityState: {
    seedPacket?: URBPacket;
    keyPacket?: URBPacket;
    seedBytes?: number[];
    keyBytes?: number[];
    unlockConfirmed: boolean;
  };
  readOperations: {
    uploadRequest?: URBPacket;
    dataBlockCount: number;
    totalBytesRead: number;
    startAddress?: string;
  };
  writeOperations: {
    downloadRequest?: URBPacket;
    dataBlockCount: number;
    totalBytesWritten: number;
    startAddress?: string;
    targetMemorySize?: number;
  };
  detectedServices: string[];
}

export function analyzeReadWriteSessions(packets: URBPacket[]): FlashSessionAnalysis {
  const analysis: FlashSessionAnalysis = {
    hasSecurityUnlock: false,
    securityState: {
      unlockConfirmed: false,
    },
    readOperations: {
      dataBlockCount: 0,
      totalBytesRead: 0,
    },
    writeOperations: {
      dataBlockCount: 0,
      totalBytesWritten: 0,
    },
    detectedServices: [],
  };

  const serviceSet = new Set<string>();

  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    const bytes = p.rawBytes;
    if (bytes.length < 2) continue;

    // Detect Service ID (SID) at index 3 or 4 depending on header (KWP2000 format)
    let sid = 0;
    if ((bytes[0] & 0x80) !== 0 && bytes.length >= 5) {
      sid = bytes[4];
    } else if (bytes.length >= 2) {
      sid = bytes[1];
    }

    // SecurityAccess (0x27 / 0x67)
    if (sid === 0x27 || p.protocolTag?.includes('0x27')) {
      serviceSet.add('0x27 SecurityAccess');
      if (p.direction === 'HOST_TO_DEVICE' && bytes.includes(0x01)) {
        analysis.securityState.seedPacket = p;
      } else if (p.direction === 'HOST_TO_DEVICE' && bytes.includes(0x02)) {
        analysis.securityState.keyPacket = p;
        // Key is bytes[6..9]
        if (bytes.length >= 10) {
          analysis.securityState.keyBytes = bytes.slice(6, 10);
        }
      }
    } else if (sid === 0x67 || p.protocolTag?.includes('0x67')) {
      serviceSet.add('0x67 SecurityAccess Positive Response');
      if (bytes.includes(0x01) && bytes.length >= 10) {
        analysis.securityState.seedBytes = bytes.slice(6, 10);
      } else if (bytes.includes(0x02)) {
        analysis.securityState.unlockConfirmed = true;
        analysis.hasSecurityUnlock = true;
      }
    }

    // RequestUpload (0x35 - Flash Lesen)
    if (sid === 0x35 || p.hexString.includes('35 ')) {
      serviceSet.add('0x35 RequestUpload (Flash Lesen)');
      analysis.readOperations.uploadRequest = p;
      if (bytes.length >= 8) {
        analysis.readOperations.startAddress = `0x${bytes.slice(4, 8).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      }
    }

    // RequestDownload (0x34 - Flash Schreiben)
    if (sid === 0x34 || p.hexString.includes('34 ')) {
      serviceSet.add('0x34 RequestDownload (Flash Schreiben)');
      analysis.writeOperations.downloadRequest = p;
      if (bytes.length >= 8) {
        analysis.writeOperations.startAddress = `0x${bytes.slice(4, 8).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      }
    }

    // TransferData (0x36)
    if (sid === 0x36 || p.hexString.includes('36 ')) {
      serviceSet.add('0x36 TransferData');
      if (p.direction === 'DEVICE_TO_HOST') {
        analysis.readOperations.dataBlockCount++;
        analysis.readOperations.totalBytesRead += p.byteCount;
      } else {
        analysis.writeOperations.dataBlockCount++;
        analysis.writeOperations.totalBytesWritten += p.byteCount;
      }
    }

    // Ident (0x1A / 0x22)
    if (sid === 0x1A || sid === 0x22) {
      serviceSet.add('0x1A/0x22 ECU Identifikation');
    }
  }

  analysis.detectedServices = Array.from(serviceSet);
  return analysis;
}
