export type PacketDirection = 'HOST_TO_DEVICE' | 'DEVICE_TO_HOST';

export type TransferType = 'Bulk' | 'Interrupt' | 'Control' | 'Isochronous';

export interface URBPacket {
  id: string;
  packetNumber: number;
  timestamp: number; // millisecond timestamp
  deltaMs: number; // delta since previous packet
  direction: PacketDirection;
  endpoint: string; // e.g. "0x01 (OUT)", "0x81 (IN)"
  transferType: TransferType;
  rawBytes: number[];
  hexString: string;
  asciiString: string;
  byteCount: number;
  protocolTag?: string;
  decodedSummary?: string;
  isError?: boolean;
  userActionAnnotation?: string; // e.g. "Klick auf 'Flash Lesen'"
}

export interface UserActionAnnotation {
  id: string;
  timestamp: number;
  label: string;
  category: 'READ' | 'WRITE' | 'SECURITY' | 'IDENT' | 'USER_CLICK' | 'CONFIRM_DIALOG';
  description?: string;
  packetNumberAtAction: number;
}

export interface ConnectedDeviceInfo {
  type: 'webusb' | 'webserial' | 'simulator';
  name: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  manufacturerName?: string;
  baudRate?: number;
  interfacesCount?: number;
  activeEndpointIn?: string;
  activeEndpointOut?: string;
  connectedAt: Date;
}

export interface ChecksumMatch {
  name: string;
  description: string;
  expected: string;
  calculated: string;
  byteIndex: number;
}

export interface KnownSeedKeyPattern {
  id: string;
  name: string;
  ecuFamily: string;
  description: string;
  formulaDescription: string;
  testFunction: (seed: number[]) => number[];
}

export interface ProtocolAnalysisResponse {
  success: boolean;
  analysis: string;
  analyzedPacketCount: number;
  error?: string;
}
