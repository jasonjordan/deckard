import React, { useState, useRef, useEffect } from 'react';
// FIX: Removed unused import of WifiIcon which is not exported from './icons'.
import { ComputerDesktopIcon, EllipsisVerticalIcon, ArrowPathIcon, BugAntIcon, InformationCircleIcon, XCircleIcon, SignalSlashIcon, ExclamationTriangleIcon, SignalIcon } from './icons';
import { Device } from '../types';

type AdbCommand = 'reboot' | 'layout_bounds' | 'get_properties' | 'force_stop' | 'disconnect';

interface DeviceFrameProps {
  device: Device;
  onRunAdbCommand: (command: AdbCommand, serial: string, args?: { appName?: string }) => void;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ device, onRunAdbCommand }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { name, model, screenImageUrl, isLoading, infoOverlay, serial, state, ipAddress } = device;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCommand = (command: AdbCommand) => {
    if (command === 'force_stop') {
        const appName = prompt(`Enter app name to force stop on "${name}":`);
        if (appName) {
            onRunAdbCommand(command, serial, { appName });
        }
    } else {
        onRunAdbCommand(command, serial);
    }
    setMenuOpen(false);
  };

  const renderDeviceState = () => {
    switch (state) {
        case 'offline':
            return (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-2 text-center">
                    <SignalSlashIcon className="w-12 h-12 mb-2"/>
                    <p className="text-sm font-semibold">Offline</p>
                </div>
            );
        case 'unauthorized':
             return (
                <div className="w-full h-full flex flex-col items-center justify-center text-yellow-400 p-2 text-center">
                    <ExclamationTriangleIcon className="w-12 h-12 mb-2"/>
                    <p className="text-sm font-semibold">Unauthorized</p>
                    <p className="text-xs mt-1">Please approve the connection on your device.</p>
                </div>
            );
        case 'connecting':
            return (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-2 text-center">
                    <div className="w-10 h-10 border-4 border-t-indigo-500 border-gray-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm">Connecting...</p>
                </div>
            );
        case 'device':
            if (screenImageUrl) {
                return <img src={screenImageUrl} alt={`${name} Screen`} className="w-full h-full object-cover" />;
            }
            return (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-2 text-center">
                    <div className="w-10 h-10 border-4 border-t-indigo-500 border-gray-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm">Loading screen...</p>
                </div>
            );
    }
  };


  return (
    <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${(state === 'offline' || state === 'connecting') ? 'opacity-60' : ''}`}>
      <div className="relative w-[200px] h-[406px] sm:w-[220px] sm:h-[448px] bg-black border-2 border-gray-700 rounded-[28px] shadow-lg shadow-slate-950/50 flex items-center justify-center p-1.5">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-0.5 h-10 bg-gray-700 rounded-l-md -ml-0.5"></div>
        <div className="absolute top-16 right-0 w-0.5 h-6 bg-gray-700 rounded-r-md -mr-0.5"></div>
        <div className="absolute top-24 right-0 w-0.5 h-6 bg-gray-700 rounded-r-md -mr-0.5"></div>
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-b-lg flex justify-center items-center pt-0.5">
          <div className="w-6 h-0.5 bg-gray-700 rounded-full"></div>
        </div>
        
        {/* ADB Menu */}
        <div ref={menuRef} className="absolute top-2 right-2 z-30">
            <button 
              onClick={() => setMenuOpen(!menuOpen)} 
              disabled={state === 'connecting'}
              className="p-1 rounded-full text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <EllipsisVerticalIcon className="w-5 h-5" />
            </button>
            {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                    <button onClick={() => handleCommand('reboot')} disabled={state !== 'device'} className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><ArrowPathIcon className="w-4 h-4" /> Reboot</button>
                    <button onClick={() => handleCommand('layout_bounds')} disabled={state !== 'device'} className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><BugAntIcon className="w-4 h-4" /> Toggle Layout Bounds</button>
                    <button onClick={() => handleCommand('get_properties')} disabled={state !== 'device'} className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><InformationCircleIcon className="w-4 h-4" /> Get Properties</button>
                    <button onClick={() => handleCommand('force_stop')} disabled={state !== 'device'} className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><XCircleIcon className="w-4 h-4" /> Force Stop App</button>
                    <div className="my-1 h-px bg-slate-700"></div>
                    <button onClick={() => handleCommand('disconnect')} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"><SignalSlashIcon className="w-4 h-4" /> Disconnect</button>
                </div>
            )}
        </div>

        <div className="w-full h-full bg-gray-800 rounded-[22px] overflow-hidden relative">
          {state === 'device' && isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20">
              <div className="w-10 h-10 border-4 border-t-indigo-500 border-gray-600 rounded-full animate-spin"></div>
            </div>
          )}
          {infoOverlay && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 p-3 text-white text-xs font-mono whitespace-pre-wrap overflow-y-auto">
                <p className="font-bold text-sm mb-2 text-indigo-300">Device Properties</p>
                {infoOverlay}
            </div>
          )}
          {renderDeviceState()}
        </div>
      </div>
      <div className="text-center w-full px-2">
          <p className="font-semibold text-slate-200 text-sm truncate">{name}</p>
          <p className="text-slate-400 text-xs truncate">{model}</p>
          <p className="text-slate-500 text-xs font-mono truncate flex items-center justify-center gap-1">
            <SignalIcon className={`w-3 h-3 ${state === 'device' ? 'text-green-400' : 'text-slate-600'}`} />
            {ipAddress}
          </p>
      </div>
    </div>
  );
};