import React from 'react';
import { XCircleIcon, MagnifyingGlassIcon, SignalIcon } from './icons';
import { ScanProgress, Device } from '../types';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: () => void;
  progress: ScanProgress | null;
  foundDevices: Device[];
}

export const ScanModal: React.FC<ScanModalProps> = ({ isOpen, onClose, onScan, progress, foundDevices }) => {
  if (!isOpen) {
    return null;
  }

  const handleScan = () => {
    onScan();
  };

  const isScanning = progress !== null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={isScanning ? undefined : onClose}
    >
      <div 
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl flex flex-col animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">Scan Network for Devices</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="p-6">
            {!isScanning ? (
                <>
                    <p className="text-sm text-slate-400 mb-4">
                        Deckard will automatically scan your current local network to find and connect to available devices with network ADB enabled.
                    </p>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-center">
                        <p className="text-slate-300">Ready to find your devices?</p>
                    </div>
                </>
            ) : (
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto border-4 border-t-indigo-500 border-gray-600 rounded-full animate-spin"></div>
                    <p className="mt-4 text-lg font-semibold text-slate-200">Scanning in progress...</p>
                    <p className="text-sm text-slate-400 font-mono mt-1">Probing: {progress.currentIp}</p>

                    <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4">
                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.progress}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{progress.progress}% complete</p>
                </div>
            )}
            
            {foundDevices.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-semibold text-slate-300">Found Devices ({foundDevices.length})</h3>
                    <div className="mt-2 border border-slate-700 rounded-lg max-h-48 overflow-y-auto bg-slate-900/50">
                        {foundDevices.map(device => (
                            <div key={device.serial} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-b-0">
                                <div>
                                    <p className="font-semibold text-sm text-slate-200">{device.name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{device.ipAddress}</p>
                                </div>
                                <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full ${
                                    device.state === 'device' ? 'bg-green-500/10 text-green-400' :
                                    device.state === 'unauthorized' ? 'bg-yellow-500/10 text-yellow-400' :
                                    'bg-slate-600/20 text-slate-400'
                                }`}>
                                    <SignalIcon className="w-3 h-3"/>
                                    {device.state}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
         <footer className="p-4 bg-slate-900/50 border-t border-slate-700 rounded-b-2xl flex justify-end gap-4">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition-colors"
                >
                    {isScanning ? 'Close' : 'Cancel'}
                </button>
                {!isScanning && (
                    <button
                        onClick={handleScan}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
                    >
                        <MagnifyingGlassIcon className="w-5 h-5" />
                        Start Scan
                    </button>
                )}
        </footer>
      </div>
    </div>
  );
};
