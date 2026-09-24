import { URBPacket, ConnectedDeviceInfo } from '../types/protocol';
import { bytesToHex, bytesToAscii, decodeAutomotiveFrame } from './protocolDecoders';

export class HardwareManager {
  private usbDevice: any = null;
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;
  private isListening = false;
  private packetCounter = 0;
  private lastPacketTime = Date.now();
  private onPacketCallback: ((packet: URBPacket) => void) | null = null;
  private onStatusChangeCallback: ((info: ConnectedDeviceInfo | null) => void) | null = null;

  // Simulator State
  private simState = {
    active: false,
    sessionMode: 'none',
    currentSeed: [0x4A, 0x7E, 0x19, 0xB2],
    isUnlocked: false,
    flashBlockSeq: 0,
    ecuIdent: 'BMS-K1200GS_MOTO_V2.4',
  };

  public setCallbacks(
    onPacket: (packet: URBPacket) => void,
    onStatusChange: (info: ConnectedDeviceInfo | null) => void
  ) {
    this.onPacketCallback = onPacket;
    this.onStatusChangeCallback = onStatusChange;
  }

  // --- WebUSB API ---
  public async connectWebUSB(): Promise<ConnectedDeviceInfo> {
    if (!('usb' in navigator)) {
      throw new Error('WebUSB wird von diesem Browser nicht unterstützt. Bitte Chrome, Chromium oder Edge verwenden.');
    }

    // Prompt user to select USB device
    const device = await (navigator as any).usb.requestDevice({ filters: [] });
    await device.open();

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    this.usbDevice = device;
    this.isListening = true;

    // Detect IN / OUT endpoints
    const iface = device.configuration?.interfaces[0]?.alternate;
    const inEp = iface?.endpoints?.find((e: any) => e.direction === 'in');
    const outEp = iface?.endpoints?.find((e: any) => e.direction === 'out');

    const info: ConnectedDeviceInfo = {
      type: 'webusb',
      name: device.productName || 'USB Diagnosestecker / Interface',
      vendorId: `0x${device.vendorId.toString(16).padStart(4, '0').toUpperCase()}`,
      productId: `0x${device.productId.toString(16).padStart(4, '0').toUpperCase()}`,
      serialNumber: device.serialNumber || 'N/A',
      manufacturerName: device.manufacturerName || 'Generic USB',
      activeEndpointIn: inEp ? `0x${inEp.endpointNumber.toString(16).padStart(2, '0')} (IN)` : '0x81 (IN)',
      activeEndpointOut: outEp ? `0x${outEp.endpointNumber.toString(16).padStart(2, '0')} (OUT)` : '0x02 (OUT)',
      connectedAt: new Date(),
    };

    this.onStatusChangeCallback?.(info);

    // Start background read loop
    if (inEp) {
      this.startUsbReadLoop(inEp.endpointNumber);
    }

    return info;
  }

  private async startUsbReadLoop(epNum: number) {
    while (this.isListening && this.usbDevice && this.usbDevice.opened) {
      try {
        const result = await this.usbDevice.transferIn(epNum, 64);
        if (result.data && result.data.byteLength > 0) {
          const bytes = Array.from(new Uint8Array(result.data.buffer));
          this.emitPacket('DEVICE_TO_HOST', `0x${epNum.toString(16).padStart(2, '0')} (IN)`, 'Bulk', bytes);
        }
      } catch (err: any) {
        if (!this.isListening) break;
        console.warn('USB Read Error or Idle:', err);
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  // --- Web Serial API ---
  public async connectWebSerial(baudRate: number = 10400): Promise<ConnectedDeviceInfo> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial wird von diesem Browser nicht unterstützt. Bitte Chrome, Chromium oder Edge verwenden.');
    }

    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate });

    this.serialPort = port;
    this.isListening = true;

    const info: ConnectedDeviceInfo = {
      type: 'webserial',
      name: `Virtueller COM-Port (${baudRate} Baud)`,
      baudRate,
      activeEndpointIn: 'RX (Serial IN)',
      activeEndpointOut: 'TX (Serial OUT)',
      connectedAt: new Date(),
    };

    this.onStatusChangeCallback?.(info);
    this.startSerialReadLoop();

    return info;
  }

  private async startSerialReadLoop() {
    while (this.serialPort && this.serialPort.readable && this.isListening) {
      this.serialReader = this.serialPort.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this.serialReader.read();
          if (done) break;
          if (value && value.length > 0) {
            const bytes = Array.from(value as Uint8Array);
            this.emitPacket('DEVICE_TO_HOST', 'RX (Serial IN)', 'Bulk', bytes);
          }
        }
      } catch (err) {
        console.warn('Serial Read Exception:', err);
      } finally {
        this.serialReader?.releaseLock();
      }
    }
  }

  // --- Simulator Mode ---
  public startSimulator(presetName: string = 'Motorrad ECU (BMS-K K-Line)'): ConnectedDeviceInfo {
    this.disconnect();
    this.simState.active = true;
    this.simState.sessionMode = 'none';
    this.simState.isUnlocked = false;
    this.simState.flashBlockSeq = 0;
    this.generateNewSeed();

    const info: ConnectedDeviceInfo = {
      type: 'simulator',
      name: `Virtuelle ECU: ${presetName}`,
      vendorId: '0x0403 (FTDI Emulation)',
      productId: '0x6001 (FT232R USB-UART)',
      manufacturerName: 'Motorrad Diagnostic Testbench',
      activeEndpointIn: '0x81 (IN)',
      activeEndpointOut: '0x02 (OUT)',
      connectedAt: new Date(),
    };

    this.onStatusChangeCallback?.(info);
    return info;
  }

  private generateNewSeed() {
    this.simState.currentSeed = [
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
    ];
  }

  // Calculate the correct expected key using the algorithm:
  // Key[0] = Seed[0] ^ 0xD1
  // Key[1] = ((Seed[1] << 1) | (Seed[1] >> 7)) ^ 0x5F
  // Key[2] = Seed[2] ^ 0xD7
  // Key[3] = (~Seed[3]) ^ 0x48
  public calculateExpectedKey(seed: number[]): number[] {
    const s0 = seed[0] ?? 0;
    const s1 = seed[1] ?? 0;
    const s2 = seed[2] ?? 0;
    const s3 = seed[3] ?? 0;

    const rotL1 = ((s1 << 1) & 0xff) | ((s1 >> 7) & 0x01);
    const k0 = (s0 ^ 0xd1) & 0xff;
    const k1 = (rotL1 ^ 0x5f) & 0xff;
    const k2 = (s2 ^ 0xd7) & 0xff;
    const k3 = ((~s3) ^ 0x48) & 0xff;
    return [k0, k1, k2, k3];
  }

  // Send raw bytes to device or simulator
  public async sendPacket(bytes: number[]): Promise<void> {
    if (bytes.length === 0) return;

    // Record host packet
    this.emitPacket('HOST_TO_DEVICE', '0x02 (OUT)', 'Bulk', bytes);

    if (this.simState.active) {
      // Process through virtual ECU state machine with realistic 15-40ms delay
      setTimeout(() => {
        this.processSimulatorInput(bytes);
      }, 25);
      return;
    }

    if (this.usbDevice && this.usbDevice.opened) {
      const data = new Uint8Array(bytes);
      await this.usbDevice.transferOut(2, data);
      return;
    }

    if (this.serialPort && this.serialPort.writable) {
      this.serialWriter = this.serialPort.writable.getWriter();
      await this.serialWriter.write(new Uint8Array(bytes));
      this.serialWriter.releaseLock();
      return;
    }

    throw new Error('Kein USB-Gerät oder Simulator aktiv.');
  }

  private processSimulatorInput(input: number[]) {
    // KWP / UDS framing check
    // If format byte 0x80 / 0x81
    let sid = input[0];
    let payload = input;

    if (input[0] >= 0x80 && input.length >= 4) {
      // e.g. [0x80, 0x11, 0xF1, 0x02, SID, ...]
      const sidIdx = input[0] === 0x81 && input[3] === 0x81 ? 3 : 4;
      sid = input[sidIdx] || input[3];
      payload = input.slice(sidIdx);
    }

    // 1. FastInit / Start Communication (0x81)
    if (sid === 0x81) {
      this.simState.sessionMode = 'default';
      const reply = [0x80, 0xF1, 0x11, 0x03, 0xC1, 0xEA, 0x8F, 0x8E];
      this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
      return;
    }

    // 2. StartDiagnosticSession (0x10)
    if (sid === 0x10) {
      const sub = payload[1] || 0x01;
      this.simState.sessionMode = sub === 0x86 || sub === 0x02 ? 'programming' : 'extended';
      const reply = [0x80, 0xF1, 0x11, 0x02, 0x50, sub, (0x80 + 0xF1 + 0x11 + 0x02 + 0x50 + sub) & 0xff];
      this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
      return;
    }

    // 3. ReadEcuIdentification (0x1A or 0x22)
    if (sid === 0x1A || sid === 0x22) {
      const asciiBytes = Array.from(this.simState.ecuIdent).map(c => c.charCodeAt(0));
      const len = asciiBytes.length + 2;
      const respSid = sid === 0x1A ? 0x5A : 0x62;
      const reply = [0x80, 0xF1, 0x11, len, respSid, 0x9B, ...asciiBytes];
      let sum = 0;
      for (const b of reply) sum = (sum + b) & 0xff;
      reply.push(sum);
      this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
      return;
    }

    // 4. SecurityAccess: Seed Request (0x27 0x01)
    if (sid === 0x27) {
      const sub = payload[1];
      if (sub === 0x01 || sub === 0x03) {
        // Request Seed
        this.generateNewSeed();
        const seed = this.simState.currentSeed;
        const reply = [0x80, 0xF1, 0x11, 0x06, 0x67, sub, ...seed];
        let sum = 0;
        for (const b of reply) sum = (sum + b) & 0xff;
        reply.push(sum);
        this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
        return;
      } else if (sub === 0x02 || sub === 0x04) {
        // Send Key
        const sentKey = payload.slice(2, 6);
        const expectedKey = this.calculateExpectedKey(this.simState.currentSeed);
        const matches = sentKey.length === 4 && sentKey.every((v, i) => v === expectedKey[i]);

        if (matches) {
          this.simState.isUnlocked = true;
          const reply = [0x80, 0xF1, 0x11, 0x02, 0x67, sub, 0x00];
          let sum = 0;
          for (const b of reply) sum = (sum + b) & 0xff;
          reply.push(sum);
          this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
        } else {
          // Negative Response NRC 0x35 (Invalid Key)
          const nrcReply = [0x80, 0xF1, 0x11, 0x03, 0x7F, 0x27, 0x35, 0x00];
          let sum = 0;
          for (const b of nrcReply) sum = (sum + b) & 0xff;
          nrcReply[nrcReply.length - 1] = sum;
          this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', nrcReply, true);
        }
        return;
      }
    }

    // 5. RequestDownload (0x34)
    if (sid === 0x34) {
      if (!this.simState.isUnlocked) {
        // NRC 0x33: Security Access Denied
        const nrcReply = [0x80, 0xF1, 0x11, 0x03, 0x7F, 0x34, 0x33, 0x8B];
        this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', nrcReply, true);
        return;
      }
      this.simState.flashBlockSeq = 1;
      const reply = [0x80, 0xF1, 0x11, 0x03, 0x74, 0x20, 0x80, 0xB9];
      this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
      return;
    }

    // 6. TransferData (0x36)
    if (sid === 0x36) {
      const seq = payload[1] || this.simState.flashBlockSeq++;
      const reply = [0x80, 0xF1, 0x11, 0x02, 0x76, seq, 0x00];
      let sum = 0;
      for (const b of reply) sum = (sum + b) & 0xff;
      reply[reply.length - 1] = sum;
      this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
      return;
    }

    // 7. TesterPresent (0x3E)
    if (sid === 0x3E) {
      const reply = [0x80, 0xF1, 0x11, 0x02, 0x7E, 0x80, 0x82];
      this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', reply);
      return;
    }

    // Generic Positive Response for any other unrecognized command
    const genericAck = [0x80, 0xF1, 0x11, 0x01, (sid + 0x40) & 0xff, 0x00];
    let sum = 0;
    for (const b of genericAck) sum = (sum + b) & 0xff;
    genericAck[genericAck.length - 1] = sum;
    this.emitPacket('DEVICE_TO_HOST', '0x81 (IN)', 'Bulk', genericAck);
  }

  private emitPacket(
    direction: 'HOST_TO_DEVICE' | 'DEVICE_TO_HOST',
    endpoint: string,
    transferType: 'Bulk' | 'Interrupt' | 'Control',
    bytes: number[],
    isError = false
  ) {
    const now = Date.now();
    const deltaMs = this.packetCounter === 0 ? 0 : Math.min(now - this.lastPacketTime, 99999);
    this.lastPacketTime = now;
    this.packetCounter++;

    const decoded = decodeAutomotiveFrame(bytes);

    const packet: URBPacket = {
      id: `pkt-${this.packetCounter}-${now}`,
      packetNumber: this.packetCounter,
      timestamp: now,
      deltaMs,
      direction,
      endpoint,
      transferType,
      rawBytes: bytes,
      hexString: bytesToHex(bytes),
      asciiString: bytesToAscii(bytes),
      byteCount: bytes.length,
      protocolTag: decoded.tag,
      decodedSummary: decoded.summary,
      isError: isError || decoded.isNegativeResponse,
    };

    this.onPacketCallback?.(packet);
  }

  public getCurrentSimulatorSeed(): number[] {
    return this.simState.currentSeed;
  }

  public disconnect() {
    this.isListening = false;
    this.simState.active = false;

    if (this.serialReader) {
      try {
        this.serialReader.cancel();
      } catch {}
      this.serialReader = null;
    }

    if (this.serialPort) {
      try {
        this.serialPort.close();
      } catch {}
      this.serialPort = null;
    }

    if (this.usbDevice) {
      try {
        this.usbDevice.close();
      } catch {}
      this.usbDevice = null;
    }

    this.onStatusChangeCallback?.(null);
  }
}

export const hardwareManager = new HardwareManager();
