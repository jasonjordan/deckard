import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DeviceFrame } from './components/DeviceFrame';
import { Device, ScanProgress } from './types';
import { Header } from './components/Header';
import { ComputerDesktopIcon } from './components/icons';
import { Sidebar } from './components/Sidebar';
import { InfoModal } from './components/InfoModal';
import { AdbService } from './services/adbService';
import { AddDeviceModal } from './components/AddDeviceModal';
import { ScanModal } from './components/ScanModal';

const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [deviceInfoContent, setDeviceInfoContent] = useState('');
  const [isInitialScanRunning, setIsInitialScanRunning] = useState(false);
  
  const adbService = useRef<AdbService | null>(null);
  const [isAdbInitialized, setIsAdbInitialized] = useState(false);

  const isFleetLoading = devices.some(d => d.isLoading);
  
  const scanCompleteHandler = useCallback(() => {
    // Using a timeout provides a better user experience, allowing the user to see the
    // "100%" state for a moment before the modal closes, and ensures final device
    // state updates have time to render.
    setTimeout(() => {
        setIsScanModalOpen(false);
        setIsInitialScanRunning(false);
        setScanProgress(null);
    }, 1000);
  }, []);

  const scanProgressHandler = useCallback((progress: ScanProgress) => {
    setScanProgress(progress);
  }, []);

  const errorHandler = useCallback((err: Error) => {
      const errorMessage = err.message.includes("Failed to fetch") ? "Connection failed. Ensure the device is online and network ADB is enabled." : err.message;
      setError(errorMessage);
  }, []);


  // Effect to initialize the ADB service once the TangoADB script has loaded.
  useEffect(() => {
    const initAdbService = () => {
      if (window.Tango?.Adb) {
        const service = new AdbService();
        adbService.current = service;

        // Set up listeners
        service.on('devices-update', setDevices);
        service.on('error', errorHandler);
        service.on('scan-progress', scanProgressHandler);
        service.on('scan-complete', scanCompleteHandler);
        
        setIsAdbInitialized(true);
      } else {
        // Poll until the script is loaded
        setTimeout(initAdbService, 100);
      }
    };

    initAdbService();

    // Cleanup function
    return () => {
      if (adbService.current) {
        adbService.current.off('devices-update', setDevices);
        adbService.current.off('error', errorHandler);
        adbService.current.off('scan-progress', scanProgressHandler);
        adbService.current.off('scan-complete', scanCompleteHandler);
        adbService.current.disconnectAll();
      }
    };
  }, [errorHandler, scanProgressHandler, scanCompleteHandler]);


  // Effect to automatically scan the network on load
  useEffect(() => {
    if (isAdbInitialized && adbService.current) {
      setIsInitialScanRunning(true);
      adbService.current.scanNetwork();
    }
  }, [isAdbInitialized]);


  // Effect to set a placeholder for newly connected devices
  useEffect(() => {
    if (!isAdbInitialized || !adbService.current) return;
    const currentAdbService = adbService.current;

    const newDevices = devices.filter(d => d.state === 'device' && !d.screenImageUrl && !d.isLoading);

    if (newDevices.length > 0) {
        currentAdbService.updateDevices(prev =>
            prev.map(d => {
                if (newDevices.some(nd => nd.serial === d.serial)) {
                    return {
                        ...d,
                        // Set a generic placeholder image
                        screenImageUrl: 'https://storage.googleapis.com/tango-public-assets/android-homescreen-placeholder.png',
                        currentScreenDescription: `The home screen of a ${d.model}.`,
                        isLoading: false
                    };
                }
                return d;
            })
        );
    }
  }, [devices, isAdbInitialized]);
  
  const handleAddDevice = useCallback(async (ipAddress: string) => {
    if (!adbService.current) return;
    setIsAddDeviceModalOpen(false);
    setError(null);
    try {
      await adbService.current.connectDevice(ipAddress);
    } catch (err) {
       const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
       setError(errorMessage);
    }
  }, []);
  
  const handleScanNetwork = useCallback(async () => {
    if (!adbService.current) return;
    setIsScanModalOpen(true);
    // The service has a guard, so it won't start a new scan if one is already running.
    await adbService.current.scanNetwork();
  }, []);

  const handleEndSession = useCallback(() => {
    if (!adbService.current) return;
    adbService.current.disconnectAll();
    setError(null);
    setDevices([]);
  }, []);
  
  
  const runAdbCommandOnDevice = useCallback(async (cmd: string, serial: string, args?: { appName?: string, packageName?: string }) => {
     if (!adbService.current) return;
     const device = devices.find(d => d.serial === serial);
     if (!device) return;

     setError(null);
     adbService.current.updateDevice(serial, { isLoading: true });

     try {
        let updateDescription = '';
        switch(cmd) {
            case 'reboot':
                await adbService.current.reboot(serial);
                updateDescription = `Device ${device.name} is rebooting.`;
                break;
            case 'layout_bounds':
                 const nextLayoutState = !device.layoutBoundsVisible;
                 await adbService.current.exec(serial, `setprop debug.layout ${nextLayoutState}`);
                 await adbService.current.exec(serial, 'service call window 3'); // This forces a redraw
                 adbService.current.updateDevice(serial, { layoutBoundsVisible: nextLayoutState });
                 updateDescription = `Toggled layout bounds ${nextLayoutState ? 'on' : 'off'} for ${device.name}.`;
                 break;
            case 'get_properties':
                const props = await adbService.current.getProperties(serial);
                const propsString = Object.entries(props).map(([key, value]) => `[${key}]: [${value}]`).join('\n');
                adbService.current.updateDevice(serial, { infoOverlay: propsString });
                // Set a timer to clear the overlay
                setTimeout(() => adbService.current!.updateDevice(serial, { infoOverlay: null }), 15000);
                updateDescription = `Fetched properties for ${device.name}.`;
                break;
            case 'force_stop':
                if (args?.appName) {
                    await adbService.current.forceStop(serial, args.appName);
                    updateDescription = `Force stopped ${args.appName} on ${device.name}. The device will now show the home screen.`;
                }
                break;
             case 'disconnect':
                await adbService.current.disconnectDevice(serial);
                updateDescription = `Disconnected from ${device.name}.`;
                break;
        }
        
        // After an action, just reset to a generic placeholder.
        // A more sophisticated approach might try to guess the resulting screen.
        adbService.current.updateDevice(serial, {
            screenImageUrl: 'https://storage.googleapis.com/tango-public-assets/android-homescreen-placeholder.png',
            currentScreenDescription: `The screen of a ${device.model} after performing an action.`,
            isLoading: false
        });

     } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown ADB error';
        setError(`Failed on ${device.name}: ${errorMessage}`);
        adbService.current.updateDevice(serial, { isLoading: false });
     }
  }, [devices]);

  const runAdbCommandOnFleet = useCallback(async (command: string, args?: { appName?: string, packageName?: string, packageNameOrPath?: string }) => {
      if (!adbService.current) return;
      const onlineDevices = adbService.current.getDevices().filter(d => d.state === 'device');
      if (onlineDevices.length === 0) {
        setError("No online devices to run command on.");
        return;
      }
      
      setError(null);
      let actionVerb = '';

      // Set loading state for all targeted devices
      adbService.current.updateDevices(prev => prev.map(d => onlineDevices.some(od => od.serial === d.serial) ? { ...d, isLoading: true } : d));

      const adbPromises = onlineDevices.map(device => {
        switch (command) {
            case 'reboot':
                actionVerb = 'Rebooting';
                return adbService.current!.reboot(device.serial);
            case 'layout_bounds':
                actionVerb = 'Toggling layout bounds on';
                const nextState = !device.layoutBoundsVisible;
                adbService.current!.updateDevice(device.serial, { layoutBoundsVisible: nextState });
                return adbService.current!.exec(device.serial, `setprop debug.layout ${nextState}`).then(() => adbService.current!.exec(device.serial, 'service call window 3'));
            case 'force_stop':
                if (args?.appName) {
                    actionVerb = `Forcing stop of ${args.appName} on`;
                    return adbService.current!.forceStop(device.serial, args.appName);
                }
                return Promise.resolve();
            case 'uninstall':
                 if (args?.packageName) {
                    actionVerb = `Uninstalling ${args.packageName} from`;
                    return adbService.current!.uninstall(device.serial, args.packageName);
                 }
                 return Promise.resolve();
            case 'install':
                if (args?.packageNameOrPath) {
                    actionVerb = `Installing ${args.packageNameOrPath} on`;
                    return adbService.current!.install(device.serial, args.packageNameOrPath);
                }
                return Promise.resolve();
            default:
                return Promise.resolve();
        }
      });

      await Promise.allSettled(adbPromises);

      // After the commands, update all devices to a generic state.
      onlineDevices.forEach(device => {
        adbService.current!.updateDevice(device.serial, {
            isLoading: false,
            screenImageUrl: 'https://storage.googleapis.com/tango-public-assets/android-homescreen-placeholder.png',
            currentScreenDescription: `The screen of a ${device.model} after performing a fleet action.`
        });
      });
  }, []);
  
  const handleGetFleetInfo = useCallback(async () => {
    if (!adbService.current) return;
    const onlineDevices = adbService.current.getDevices().filter(d => d.state === 'device');
    if (onlineDevices.length === 0) {
      setDeviceInfoContent("No online devices to fetch information from.");
      setIsInfoModalOpen(true);
      return;
    }
    
    setDeviceInfoContent("Fetching information from all online devices...");
    setIsInfoModalOpen(true);

    const infoPromises = onlineDevices.map(d => adbService.current!.getProperties(d.serial));
    const results = await Promise.allSettled(infoPromises);

    const content = results.map((result, index) => {
        const device = onlineDevices[index];
        if (result.status === 'fulfilled') {
            const props = result.value;
            return `--- ${device.name} (${device.ipAddress}) ---\n` +
                   `Model: ${props['ro.product.model'] || 'N/A'}\n` +
                   `Manufacturer: ${props['ro.product.manufacturer'] || 'N/A'}\n` +
                   `Android Version: ${props['ro.build.version.release'] || 'N/A'}\n` +
                   `Build: ${props['ro.build.id'] || 'N/A'}\n` +
                   `-----------------------------------\n`;
        } else {
            return `--- FAILED: ${device.name} (${device.ipAddress}) ---\n` +
                   `Reason: ${result.reason.message}\n` +
                   `-----------------------------------\n`;
        }
    }).join('\n');
    
    setDeviceInfoContent(content);

  }, []);


  return (
    <div className="flex flex-col h-screen text-white font-sans">
      <Header 
        deviceCount={devices.filter(d => d.state === 'device').length}
        onAddDevice={() => setIsAddDeviceModalOpen(true)}
        onScanNetwork={handleScanNetwork}
        onEndSession={handleEndSession}
      />
      <main className="flex-grow flex p-4 gap-4 overflow-hidden">
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 p-4 overflow-y-auto rounded-2xl bg-slate-900/50 border border-slate-700/50">
          {devices.length === 0 && isInitialScanRunning && (
            <div className="col-span-full flex flex-col items-center justify-center text-center text-slate-500 h-full">
              <div className="w-16 h-16 mx-auto border-4 border-t-indigo-500 border-gray-600 rounded-full animate-spin"></div>
              <h2 className="text-2xl font-bold text-slate-300 mt-4">Scanning for Devices...</h2>
              <p className="mt-2">Deckard is automatically scanning your local network.</p>
              <p className="text-xs mt-1">(You can see detailed progress by clicking "Scan Network")</p>
            </div>
          )}
          {devices.length === 0 && !isInitialScanRunning && !isScanModalOpen && (
            <div className="col-span-full flex flex-col items-center justify-center text-center text-slate-500 h-full">
              <ComputerDesktopIcon className="w-20 h-20 mb-4" />
              <h2 className="text-2xl font-bold text-slate-300">No Devices Found</h2>
              <p className="mt-2">Use "Scan Network" to search again, or "Add Device" to connect via IP address.</p>
            </div>
          )}
          {devices.map(device => (
            <DeviceFrame key={device.serial} device={device} onRunAdbCommand={runAdbCommandOnDevice} />
          ))}
        </div>
        <aside className="w-[400px] flex-shrink-0">
          <Sidebar 
            isFleetLoading={isFleetLoading}
            onInstallApk={(packageNameOrPath) => runAdbCommandOnFleet('install', { packageNameOrPath })}
            onAdbReboot={() => runAdbCommandOnFleet('reboot')}
            onAdbToggleLayoutBounds={() => runAdbCommandOnFleet('layout_bounds')}
            onAdbForceStop={(appName) => runAdbCommandOnFleet('force_stop', { appName })}
            onAdbUninstall={(packageName) => runAdbCommandOnFleet('uninstall', { packageName })}
            onAdbGetFleetInfo={handleGetFleetInfo}
          />
        </aside>
      </main>
      <InfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="Fleet Device Information"
        content={deviceInfoContent}
      />
      <AddDeviceModal 
        isOpen={isAddDeviceModalOpen}
        onClose={() => setIsAddDeviceModalOpen(false)}
        onConnect={handleAddDevice}
      />
       <ScanModal 
        isOpen={isScanModalOpen}
        onClose={() => {
            setIsScanModalOpen(false);
            if (adbService.current) adbService.current.cancelScan();
        }}
        onScan={handleScanNetwork}
        progress={scanProgress}
        foundDevices={devices}
      />
    </div>
  );
};

export default App;