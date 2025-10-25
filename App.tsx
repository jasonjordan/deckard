import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DeviceFrame } from './components/DeviceFrame';
import { Message, Device, ScanProgress } from './types';
import { generateScreenFromCommand } from './services/geminiService';
import { Header } from './components/Header';
import { ComputerDesktopIcon } from './components/icons';
import { Sidebar } from './components/Sidebar';
import { InfoModal } from './components/InfoModal';
import { AdbService } from './services/adbService';
import { AddDeviceModal } from './components/AddDeviceModal';
import { ScanModal } from './components/ScanModal';

const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
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

        const onlineCount = adbService.current?.getDevices().filter(d => d.state === 'device').length ?? 0;
        const totalCount = adbService.current?.getDevices().length ?? 0;
        
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Scan complete. Found ${totalCount} device(s), ${onlineCount} online.`
        }]);

    }, 1000);
  }, []);

  const scanProgressHandler = useCallback((progress: ScanProgress) => {
    setScanProgress(progress);
  }, []);

  const errorHandler = useCallback((err: Error) => {
      const errorMessage = err.message.includes("Failed to fetch") ? "Connection failed. Ensure the device is online and network ADB is enabled." : err.message;
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
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


  // Effect to generate initial screens for newly connected devices
  useEffect(() => {
    if (!isAdbInitialized || !adbService.current) return;
    const currentAdbService = adbService.current;

    const newDevices = devices.filter(d => d.state === 'device' && !d.screenImageUrl && !d.isLoading);

    if (newDevices.length > 0) {
        const generateScreensForNewDevices = async () => {
            currentAdbService.updateDevices(prev => 
                prev.map(d => newDevices.some(nd => nd.serial === d.serial) ? { ...d, isLoading: true } : d)
            );

            const screenPromises = newDevices.map(device => 
                generateScreenFromCommand(`Show the initial home screen for a ${device.model}`, `the home screen of a modern android device.`)
                    .then(result => ({ serial: device.serial, model: device.model, ...result }))
                    .catch(err => ({ serial: device.serial, model: device.model, error: err.message }))
            );

            const screenResults = await Promise.allSettled(screenPromises);

            currentAdbService.updateDevices(prevDevices => prevDevices.map(device => {
                const result = screenResults.find(r => r.status === 'fulfilled' && r.value.serial === device.serial);
                if (result && result.status === 'fulfilled') {
                    const value = result.value;
                    if ('error' in value) {
                         return { ...device, isLoading: false, state: 'offline' }; // Failed to generate screen
                    }
                    return {
                        ...device,
                        screenImageUrl: value.imageUrl,
                        currentScreenDescription: `a screen on a ${value.model} showing ${value.description}`,
                        isLoading: false,
                    };
                }
                // If screen generation failed for a new device, just stop loading
                if (newDevices.some(nd => nd.serial === device.serial)) {
                    return { ...device, isLoading: false };
                }
                return device;
            }));
        };
        generateScreensForNewDevices();
    }
  }, [devices, isAdbInitialized]);
  
  const handleAddDevice = useCallback(async (ipAddress: string) => {
    if (!adbService.current) return;
    setIsAddDeviceModalOpen(false);
    setError(null);
    setMessages(prev => [...prev, { role: 'assistant', content: `Attempting to connect to device at ${ipAddress}...` }]);
    try {
      await adbService.current.connectDevice(ipAddress);
      setMessages(prev => [...prev, { role: 'assistant', content: `Successfully initiated connection to ${ipAddress}. Please authorize it on the device if prompted.` }]);
    } catch (err) {
       const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
       setError(errorMessage);
       setMessages(prev => [...prev, { role: 'assistant', content: `Failed to connect to ${ipAddress}: ${errorMessage}` }]);
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
    setMessages([]);
    setError(null);
    setDevices([]);
  }, []);
  
  const runCommandOnFleet = useCallback(async (command: string, updateDescription: string) => {
    if (!adbService.current) return;
    const onlineDevices = adbService.current.getDevices().filter(d => d.state === 'device');
    if (onlineDevices.length === 0) {
      setError("No online devices to run command on.");
      return;
    }

    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: command }]);
    
    adbService.current.updateDevices(prev => prev.map(d => onlineDevices.some(od => od.serial === d.serial) ? { ...d, isLoading: true } : d));

    const commandPromises = onlineDevices.map(device => 
      generateScreenFromCommand(command, device.currentScreenDescription)
        .then(result => ({ ...result, serial: device.serial, model: device.model }))
    );
    
    const results = await Promise.allSettled(commandPromises);

    let firstSuccessDescription = '';
    let successCount = 0;
    const failures: { name: string; reason: string }[] = [];

    results.forEach((result, index) => {
        const device = onlineDevices[index];
        if (result.status === 'fulfilled') {
            if (!firstSuccessDescription) {
                firstSuccessDescription = result.value.description;
            }
            successCount++;
            adbService.current!.updateDevice(device.serial, {
                screenImageUrl: result.value.imageUrl,
                currentScreenDescription: `a screen on a ${result.value.model} showing ${result.value.description}`,
                isLoading: false
            });
        } else {
            failures.push({ name: device.name, reason: result.reason.message });
            adbService.current!.updateDevice(device.serial, { isLoading: false }); // Stop loading on failure
        }
    });

    let summaryMessage = '';
    if (successCount > 0) {
      summaryMessage += `${firstSuccessDescription} on ${successCount} device(s).`;
    }
    if (failures.length > 0) {
      const failureText = failures.map(f => `${f.name} (${f.reason})`).join(', ');
      summaryMessage += `\n\nFailed on ${failures.length} device(s): ${failureText}`;
    }

    setMessages(prev => [...prev, { role: 'assistant', content: summaryMessage.trim() }]);

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
        
        const finalDescription = `Based on the last action (${updateDescription}), generate a new screen.`;
        const { imageUrl, description } = await generateScreenFromCommand(finalDescription, device.currentScreenDescription);
        adbService.current.updateDevice(serial, {
            screenImageUrl: imageUrl,
            currentScreenDescription: `a screen showing the result of: ${description}`,
            isLoading: false
        });

     } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown ADB error';
        setError(`Failed on ${device.name}: ${errorMessage}`);
        adbService.current.updateDevice(serial, { isLoading: false });
     }
  }, [devices]);

  const runAdbCommandOnFleet = useCallback(async (command: string, args?: { appName?: string, packageName?: string }) => {
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
            default:
                return Promise.resolve();
        }
      });

      const results = await Promise.allSettled(adbPromises);

      // Now generate new screens based on the results
      const screenPromises = onlineDevices.map((device, index) => {
          if (results[index].status === 'fulfilled') {
              const commandDescription = `${actionVerb} ${device.name}`;
              return generateScreenFromCommand(commandDescription, device.currentScreenDescription)
                  .then(res => ({ ...res, serial: device.serial, model: device.model, success: true }))
                  .catch(err => ({ serial: device.serial, model: device.model, success: false, reason: err.message }));
          } else {
              return Promise.resolve({ serial: device.serial, model: device.model, success: false, reason: (results[index] as PromiseRejectedResult).reason.message });
          }
      });
      
      const screenResults = await Promise.all(screenPromises);

      screenResults.forEach(res => {
          if (res.success) {
            adbService.current!.updateDevice(res.serial, {
              isLoading: false,
              screenImageUrl: res.imageUrl,
              currentScreenDescription: `a screen on ${res.model} showing ${res.description}`
            });
          } else {
             adbService.current!.updateDevice(res.serial, { isLoading: false });
             setError(`Failed on ${res.model}: ${res.reason}`);
          }
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
            messages={messages}
            onSendCommand={runCommandOnFleet}
            isFleetLoading={isFleetLoading}
            error={error}
            onInstallApk={(appName) => runAdbCommandOnFleet('uninstall', { appName: `install ${appName}` })}
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