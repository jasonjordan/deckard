import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DeviceFrame } from './components/DeviceFrame';
import { Message, Device } from './types';
import { generateScreenFromCommand } from './services/geminiService';
import { Header } from './components/Header';
import { ComputerDesktopIcon } from './components/icons';
import { Sidebar } from './components/Sidebar';
import { InfoModal } from './components/InfoModal';
import { AdbService } from './services/adbService';
import { AddDeviceModal } from './components/AddDeviceModal';

const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [deviceInfoContent, setDeviceInfoContent] = useState('');
  
  const adbService = useRef<AdbService | null>(null);
  const [isAdbInitialized, setIsAdbInitialized] = useState(false);

  const isFleetLoading = devices.some(d => d.isLoading);

  // Effect to initialize the ADB service once the TangoADB script has loaded.
  useEffect(() => {
    const errorHandler = (err: Error) => {
        const errorMessage = err.message.includes("Failed to fetch") ? "Connection failed. Ensure the device is online and network ADB is enabled." : err.message;
        setError(errorMessage);
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
    };

    const initAdbService = () => {
      if (window.Tango?.Adb) {
        const service = new AdbService();
        adbService.current = service;

        // Set up listeners
        service.on('devices-update', setDevices);
        service.on('error', errorHandler);
        
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
        adbService.current.disconnectAll();
      }
    };
  }, []); // Run only once on component mount


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

  const handleEndSession = useCallback(() => {
    if (!adbService.current) return;
    adbService.current.disconnectAll();
    setMessages([]);
    setError(null);
  }, []);

  const runCommandOnFleet = useCallback(async (command: string, userMessage: string) => {
    if (!adbService.current) return;
    const currentAdbService = adbService.current;
    
    const newUserMessage: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setError(null);

    const targetDevices = currentAdbService.getDevices().filter(d => d.state === 'device');

    if (targetDevices.length === 0) {
      const noDevicesMessage: Message = { role: 'assistant', content: "No online devices to run the command on." };
      setMessages(prev => [...prev, noDevicesMessage]);
      return;
    };
    
    currentAdbService.updateDevices(prev => prev.map(d => targetDevices.some(td => td.serial === d.serial) ? { ...d, isLoading: true } : d));

    try {
      const commandPromises = targetDevices.map(device => 
        generateScreenFromCommand(command, device.currentScreenDescription)
            .then(result => ({ serial: device.serial, ...result }))
      );
      
      const settledResults = await Promise.allSettled(commandPromises);
      
      const successfulResults: (Awaited<ReturnType<typeof generateScreenFromCommand>> & { serial: string })[] = [];
      const failedDevices: { name: string; reason: string; }[] = [];

      settledResults.forEach((result, index) => {
        const device = targetDevices[index];
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          failedDevices.push({
            name: device.name,
            reason: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          });
        }
      });
      
      currentAdbService.updateDevices(prevDevices => prevDevices.map(device => {
        const successfulResult = successfulResults.find(r => r.serial === device.serial);
        if (successfulResult) {
            return {
                ...device,
                screenImageUrl: successfulResult.imageUrl,
                currentScreenDescription: `a screen on a ${device.model} showing ${successfulResult.description}`,
                isLoading: false,
            };
        }
        if (targetDevices.some(td => td.serial === device.serial)) {
            return { ...device, isLoading: false };
        }
        return device;
      }));
      
      let summaryMessage = '';
      const total = targetDevices.length;
      if (failedDevices.length === 0 && successfulResults.length > 0) {
        summaryMessage = `${successfulResults[0].description} (Applied to ${total} device${total > 1 ? 's' : ''}).`;
      } else {
        summaryMessage = `Command executed with mixed results.\n\n`;
        if (successfulResults.length > 0) {
          const successNames = targetDevices.filter(d => successfulResults.some(r => r.serial === d.serial)).map(d => d.name).join(', ');
          summaryMessage += `✅ **Success (${successfulResults.length}):** ${successNames}\n`;
        }
        if (failedDevices.length > 0) {
          const failureInfo = failedDevices.map(f => f.name).join(', ');
          summaryMessage += `❌ **Failed (${failedDevices.length}):** ${failureInfo}`;
        }
      }
      const newAssistantMessage: Message = { role: 'assistant', content: summaryMessage.trim() };
      setMessages(prev => [...prev, newAssistantMessage]);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`A critical error occurred. ${errorMessage}`);
        console.error(err);
        currentAdbService.updateDevices(prev => prev.map(d => ({ ...d, isLoading: false })));
    }
  }, []);

  const handleSendCommand = useCallback((command: string) => {
      if (!command.trim()) return;
      runCommandOnFleet(command, command);
  }, [runCommandOnFleet]);

  const handleInstallApk = useCallback((appName: string) => {
    if(!appName.trim()) return;
    const command = `Install the app "${appName}" and show its icon on the home screen.`;
    const userMessage = `Install ${appName}.apk`;
    runCommandOnFleet(command, userMessage);
  }, [runCommandOnFleet]);

  // --- ADB Command Handlers ---

  const handleAdbCommand = async (handler: (serial: string, args?: any) => Promise<any>, serials: string[], args?: any) => {
    if (!adbService.current) return;
    try {
        await Promise.all(serials.map(serial => handler(serial, args)));
    } catch(err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`ADB command failed: ${errorMessage}`);
    }
  };
  
  const handleDisconnectDevice = (serial: string) => {
    if (!adbService.current) return;
    adbService.current.disconnectDevice(serial);
  };

  const handleReboot = useCallback((serials: string[]) => {
    if (!adbService.current) return;
    handleAdbCommand(adbService.current.reboot, serials);
  }, []);

  const handleToggleLayoutBounds = useCallback(async (serials: string[]) => {
    if (!adbService.current) return;
    const currentAdbService = adbService.current;

    const targetDevices = currentAdbService.getDevices().filter(d => serials.includes(d.serial) && d.state === 'device');
    if (targetDevices.length === 0) return;
    
    currentAdbService.updateDevices(prev => prev.map(d => targetDevices.some(td => td.serial === d.serial) ? { ...d, isLoading: true } : d));

    try {
        const commandPromises = targetDevices.map(async device => {
            const newLayoutBoundsState = !device.layoutBoundsVisible;
            // Execute real ADB command
            await currentAdbService.setLayoutBounds(device.serial, newLayoutBoundsState);

            // Generate visual update
            const command = newLayoutBoundsState
                ? `Redraw the current screen described as "${device.currentScreenDescription}" but with developer layout bounds enabled, showing thin red and blue outlines on all UI elements.`
                : `Redraw the current screen described as "${device.currentScreenDescription}" but with developer layout bounds disabled, returning to the normal appearance.`;

            const result = await generateScreenFromCommand(command, device.currentScreenDescription);
            return { serial: device.serial, ...result, layoutBoundsVisible: newLayoutBoundsState };
        });
        
        const results = await Promise.all(commandPromises);

        currentAdbService.updateDevices(prevDevices => prevDevices.map(device => {
            const result = results.find(r => r.serial === device.serial);
            return result ? {
                ...device,
                screenImageUrl: result.imageUrl,
                currentScreenDescription: `a screen on a ${device.model} showing ${result.description}`,
                isLoading: false,
                layoutBoundsVisible: result.layoutBoundsVisible,
            } : { ...device, isLoading: false };
        }));
    } catch (err) {
      console.error(err);
      setError('Failed to toggle layout bounds.');
      currentAdbService.updateDevices(prev => prev.map(d => ({ ...d, isLoading: false })));
    }
  }, []);

  const handleGetProperties = useCallback(async (serial: string) => {
    if (!adbService.current) return;
    const currentAdbService = adbService.current;
    try {
        const props = await currentAdbService.getProperties(serial);
        const propsString = Object.entries(props).map(([key, value]) => `${key}: ${value}`).join('\n');
        currentAdbService.updateDevice(serial, { infoOverlay: propsString });
        setTimeout(() => {
            currentAdbService.updateDevice(serial, { infoOverlay: null });
        }, 5000);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to get properties: ${errorMessage}`);
    }
  }, []);
  
  const handleForceStop = useCallback(async (appName: string, serials: string[]) => {
    if (!adbService.current || !appName.trim()) return;
    await handleAdbCommand(adbService.current.forceStop, serials, appName);
    const homeScreenCommand = `Show the device's main home screen.`;
    const userMessage = `ADB Command: Force Stop ${appName}`;
    // Visually update the screen using Gemini
    const targetDevices = adbService.current.getDevices().filter(d => serials.includes(d.serial) && d.state === 'device');
    if (targetDevices.length > 0) {
        runCommandOnFleet(homeScreenCommand, userMessage);
    }
  }, [runCommandOnFleet]);

  const handleUninstall = useCallback(async (packageName: string, serials: string[]) => {
    if (!adbService.current || !packageName.trim()) return;
    await handleAdbCommand(adbService.current.uninstall, serials, packageName);
    const homeScreenCommand = `Uninstall the app with package name "${packageName}". The app icon should be removed, and the device should show its main home screen.`;
    const userMessage = `ADB Command: Uninstall ${packageName}`;
     // Visually update the screen using Gemini
     const targetDevices = adbService.current.getDevices().filter(d => serials.includes(d.serial) && d.state === 'device');
     if (targetDevices.length > 0) {
         runCommandOnFleet(homeScreenCommand, userMessage);
     }
  }, [runCommandOnFleet]);

  const handleGetFleetInfo = useCallback(async () => {
    if (!adbService.current) return;
    const onlineDevices = adbService.current.getDevices().filter(d => d.state === 'device');
    if (onlineDevices.length === 0) {
      setDeviceInfoContent("No online devices to get information from.");
      setIsInfoModalOpen(true);
      return;
    }

    const allPropsPromises = onlineDevices.map(async device => {
        try {
            if (!adbService.current) throw new Error("ADB service disconnected");
            const props = await adbService.current.getProperties(device.serial);
            return `--- ${props['ro.product.manufacturer']} ${props['ro.product.model']} (${device.serial}) ---\n` +
                   `Android Version: ${props['ro.build.version.release']}\n` +
                   `Build: ${props['ro.build.display.id']}`;
        } catch (e) {
            return `--- ${device.name} (${device.serial}) ---\nCould not fetch properties.`;
        }
    });

    const allProps = (await Promise.all(allPropsPromises)).join('\n\n');

    setDeviceInfoContent(allProps);
    setIsInfoModalOpen(true);
  }, []);
  
  const getSerialsForFleet = () => adbService.current?.getDevices().filter(d => d.state === 'device').map(d => d.serial) ?? [];
  
  return (
    <div className="min-h-screen max-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <Header 
        deviceCount={devices.length}
        onAddDevice={() => setIsAddDeviceModalOpen(true)}
        onEndSession={handleEndSession}
      />
      <main className="flex-grow flex flex-col lg:flex-row p-4 gap-4 overflow-hidden h-[calc(100vh-69px)]">
        <div className="flex-grow bg-slate-900/50 rounded-lg overflow-auto border border-slate-800">
            {devices.length === 0 ? (
                <div className="flex-grow h-full flex flex-col items-center justify-center text-center p-8">
                    <ComputerDesktopIcon className="w-16 h-16 text-indigo-400/50 mb-4" />
                    <p className="text-xl text-slate-300">No Devices Connected</p>
                    <p className="text-sm text-slate-400 mt-2">Click "Add Device" in the header to connect to a device via its IP address.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-x-4 gap-y-8 p-4 justify-items-center">
                    {devices.map(device => (
                        <DeviceFrame 
                            key={device.serial} 
                            device={device}
                            onRunAdbCommand={(command, serial, args) => {
                                switch(command) {
                                    case 'reboot': handleReboot([serial]); break;
                                    case 'layout_bounds': handleToggleLayoutBounds([serial]); break;
                                    case 'get_properties': handleGetProperties(serial); break;
                                    case 'force_stop': if(args?.appName) handleForceStop(args.appName, [serial]); break;
                                    case 'disconnect': handleDisconnectDevice(serial); break;
                                }
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
        <aside className="w-full lg:w-[400px] lg:max-w-md flex-shrink-0 flex flex-col gap-4 h-full">
           <Sidebar 
             messages={messages}
             onSendCommand={handleSendCommand}
             isFleetLoading={!isAdbInitialized || isFleetLoading}
             error={error}
             onInstallApk={handleInstallApk}
             onAdbReboot={() => handleReboot(getSerialsForFleet())}
             onAdbToggleLayoutBounds={() => handleToggleLayoutBounds(getSerialsForFleet())}
             onAdbForceStop={(appName) => handleForceStop(appName, getSerialsForFleet())}
             onAdbUninstall={(packageName) => handleUninstall(packageName, getSerialsForFleet())}
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
    </div>
  );
};

export default App;