import { Device } from '../types';

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

  public setLayoutBounds = async (serial: string, enabled: boolean): Promise<void> => {
      const device = await this.getAdbDevice(serial);
      await device.exec(`setprop debug.layout ${enabled}`);
      // Invalidate surfaceflinger to apply the change
      await device.exec(`service call activity 1599295570`); 
  }
}