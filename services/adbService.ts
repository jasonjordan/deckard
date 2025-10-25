import { Device, ScanProgress } from '../types';

// This service uses the TangoADB library to create a REAL network ADB
// connection to physical devices, managed entirely within the browser.
// It uses an event-based system to notify the UI of changes.

// TangoADB is loaded from a script tag, so we declare its type here.
declare global {
  interface Window {
    Tango: {
      Adb: new () => Adb;
    };
  }
}

interface AdbDevice {
    serial: string;
    state: 'device' | 'offline' | 'unauthorized';
    type: 'device' | 'emulator';
    getProperties(): Promise<Record<string, string>>;
    reboot(): Promise<void>;
    disconnect(): Promise<void>;
    exec(command: string): Promise<string>;
    // Add other AdbDevice methods as needed
}

interface Adb {
    on(event: 'device:add' | 'device:remove' | 'device:change', listener: (device: AdbDevice) => void): this;
    getDevices(): Promise<AdbDevice[]>;
    connect(ip: string): Promise<AdbDevice>;
    disconnect(ip: string): Promise<void>;
}


type EventListener = (...args: any[]) => void;

export class AdbService {
  private adb: Adb;
  private devices: Device[] = [];
  private listeners: Map<string, EventListener[]> = new Map();
  private isScanning = false;
 
  constructor() {
    this.adb = new window.Tango.Adb();
    this.setupListeners();
  }

  // --- Event Emitter Implementation ---
  public on(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  public off(event: string, listener?: EventListener) {
    if (!this.listeners.has(event)) return;
    if (listener) {
        const filteredListeners = this.listeners.get(event)!.filter(l => l !== listener);
        this.listeners.set(event, filteredListeners);
    } else {
        this.listeners.delete(event);
    }
  }

  private emit(event: string, ...args: any[]) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => listener(...args));
    }
  }

  private setupListeners() {
    this.adb.on('device:add', (device: AdbDevice) => this.handleDeviceUpdate(device));
    this.adb.on('device:remove', (device: AdbDevice) => {
        this.devices = this.devices.filter(d => d.serial !== device.serial);
        this.emit('devices-update', [...this.devices]);
    });
    this.adb.on('device:change', (device: AdbDevice) => this.handleDeviceUpdate(device));
  }

  private async handleDeviceUpdate(adbDevice: AdbDevice) {
    const existingDevice = this.devices.find(d => d.serial === adbDevice.serial);

    // Only fetch properties and update if it's a new device or state changed to 'device'
    if (!existingDevice || (existingDevice.state !== 'device' && adbDevice.state === 'device')) {
        try {
            const props = await adbDevice.getProperties();
            const newDevice: Device = {
                serial: adbDevice.serial,
                ipAddress: adbDevice.serial.split(':')[0], // Extract IP from serial
                state: adbDevice.state,
                type: adbDevice.type,
                name: `${props['ro.product.manufacturer']} ${props['ro.product.model']}`,
                model: props['ro.product.model'] || 'Unknown Model',
                screenImageUrl: existingDevice?.screenImageUrl || null,
                currentScreenDescription: existingDevice?.currentScreenDescription || 'The initial state of the device.',
                isLoading: false,
                layoutBoundsVisible: existingDevice?.layoutBoundsVisible || false,
                infoOverlay: null,
            };
            this.upsertDevice(newDevice);
        } catch (e) {
            console.error(`Failed to get properties for ${adbDevice.serial}`, e);
            // Add a placeholder device even if properties fail
            const placeholderDevice: Device = {
                 serial: adbDevice.serial,
                 ipAddress: adbDevice.serial.split(':')[0],
                 state: adbDevice.state,
                 type: adbDevice.type,
                 name: adbDevice.state === 'unauthorized' ? 'Unauthorized Device' : 'Unknown Device',
                 model: 'Unknown',
                 screenImageUrl: null, currentScreenDescription: '', isLoading: false, layoutBoundsVisible: false, infoOverlay: null
            };
            this.upsertDevice(placeholderDevice);
        }
    } else {
        // Just update the state for existing devices
        this.updateDevice(adbDevice.serial, { state: adbDevice.state });
    }
  }
  
  private upsertDevice(device: Device) {
      const index = this.devices.findIndex(d => d.serial === device.serial);
      if (index > -1) {
          this.devices[index] = { ...this.devices[index], ...device };
      } else {
          this.devices.push(device);
      }
      this.emit('devices-update', [...this.devices]);
  }
  
  public getDevices = (): Device[] => [...this.devices];

  // --- Connection Management ---
  public async connectDevice(ipAddress: string): Promise<void> {
    try {
        await this.adb.connect(ipAddress);
    } catch(e) {
        this.emit('error', e);
        throw e;
    }
  }

  public async disconnectDevice(serial: string): Promise<void> {
    const ip = serial.split(':')[0];
    await this.adb.disconnect(ip);
  }

  public async disconnectAll(): Promise<void> {
    for (const device of this.devices) {
        try {
            await this.disconnectDevice(device.serial);
        } catch (e) {
            console.warn(`Could not disconnect ${device.serial}`, e);
        }
    }
  }
  
  /**
   * Uses a WebRTC trick to get the user's local IP address and derive the subnet.
   * This is a workaround for browsers not exposing local IP directly for security reasons.
   */
  private getLocalSubnet(): Promise<string | null> {
    return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then(pc.setLocalDescription.bind(pc));

        let resolved = false;

        pc.onicecandidate = (ice) => {
            if (resolved || !ice || !ice.candidate || !ice.candidate.candidate) {
                if (!resolved && pc.iceGatheringState === 'complete') {
                    pc.close();
                    resolve(null);
                }
                return;
            }

            const candidateString = ice.candidate.candidate;
            const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
            const match = ipRegex.exec(candidateString);
            
            if (match) {
                const ip = match[1];
                if (ip.startsWith('192.168.') || ip.startsWith('10.')) {
                    const subnet = ip.substring(0, ip.lastIndexOf('.'));
                    resolved = true;
                    pc.onicecandidate = null;
                    pc.close();
                    resolve(subnet);
                }
            }
        };

        // Timeout to prevent the promise from hanging indefinitely
        setTimeout(() => {
            if (!resolved) {
                pc.onicecandidate = null;
                pc.close();
                resolve(null);
            }
        }, 1500);
    });
  }

  // --- Network Scan ---
  public async scanNetwork() {
    if (this.isScanning) return;
    this.isScanning = true;
    
    this.emit('scan-progress', { currentIp: 'Detecting local network...', progress: 0, found: this.devices.length });
    const detectedSubnet = await this.getLocalSubnet();

    const subnetsToScan: string[] = [];
    if (detectedSubnet) {
        subnetsToScan.push(detectedSubnet);
        this.emit('scan-progress', { currentIp: `Scanning your local subnet (${detectedSubnet}.x)...`, progress: 0, found: this.devices.length });
    } else {
        const commonSubnets = ['192.168.1', '192.168.0', '10.0.0'];
        subnetsToScan.push(...commonSubnets);
        this.emit('scan-progress', { currentIp: 'Could not detect local subnet. Scanning common ranges...', progress: 0, found: this.devices.length });
    }

    const start = 1;
    const end = 254;
    const batchSize = 20;
    const totalIpsToScan = subnetsToScan.length * (end - start + 1);
    let ipsScanned = 0;

    for (const subnet of subnetsToScan) {
        if (!this.isScanning) break;

        for (let i = start; i <= end; i += batchSize) {
            if (!this.isScanning) break;

            const batchEnd = Math.min(i + batchSize - 1, end);
            const batchPromises = [];

            for (let j = i; j <= batchEnd; j++) {
                const ip = `${subnet}.${j}`;
                if (!this.devices.some(d => d.ipAddress === ip)) {
                    batchPromises.push(this.adb.connect(ip).catch(() => { /* Ignore connection errors during scan */ }));
                }
            }
            
            await Promise.allSettled(batchPromises);
            
            ipsScanned += (batchEnd - i + 1);
            
            const progress: ScanProgress = {
                currentIp: `${subnet}.${batchEnd}`,
                progress: Math.round((ipsScanned / totalIpsToScan) * 100),
                found: this.devices.length,
            };
            this.emit('scan-progress', progress);
        }
    }

    this.isScanning = false;
    this.emit('scan-complete');
  }

  public cancelScan() {
      this.isScanning = false;
  }


  // --- Public ADB Commands (Real) ---
  private async getAdbDevice(serial: string): Promise<AdbDevice> {
      const adbDevices = await this.adb.getDevices();
      const device = adbDevices.find(d => d.serial === serial);
      if (!device) throw new Error(`Device ${serial} not found.`);
      if (device.state !== 'device') throw new Error(`Device ${serial} is not online (${device.state}).`);
      return device;
  }

  public updateDevices = (updater: (prevDevices: Device[]) => Device[]): void => {
      this.devices = updater(this.devices);
      this.emit('devices-update', [...this.devices]);
  }

  public updateDevice = (serial: string, updates: Partial<Device>): void => {
    this.updateDevices(prev => prev.map(d => d.serial === serial ? { ...d, ...updates } : d));
  }

  public reboot = async (serial: string): Promise<void> => {
    const device = await this.getAdbDevice(serial);
    await device.reboot();
  }

  public getProperties = async (serial: string): Promise<Record<string, string>> => {
    const device = await this.getAdbDevice(serial);
    return await device.getProperties();
  }

  public uninstall = async (serial: string, packageName: string): Promise<void> => {
      const device = await this.getAdbDevice(serial);
      const result = await device.exec(`pm uninstall ${packageName}`);
      if (result.includes('Failure')) {
          throw new Error(`Failed to uninstall ${packageName}: ${result}`);
      }
  }

  public forceStop = async (serial: string, appName: string): Promise<void> => {
      const device = await this.getAdbDevice(serial);
      await device.exec(`am force-stop ${appName}`);
  }

  public exec = async(serial: string, command: string): Promise<string> => {
      const device = await this.getAdbDevice(serial);
      return await device.exec(command);
  }
}