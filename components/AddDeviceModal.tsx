import React, { useState } from 'react';
import { XCircleIcon, QrCodeIcon } from './icons';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (ipAddress: string) => void;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [ipAddress, setIpAddress] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ipAddress.trim()) {
      onConnect(ipAddress.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">Connect to Device</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="p-6">
            <p className="text-sm text-slate-400 mb-4">
                Enter the IP address of the device you want to connect to. Ensure the device is on the same network and has network ADB debugging enabled.
            </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="ip-address" className="text-sm font-medium text-slate-300">Device IP Address</label>
            <input
              id="ip-address"
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g., 192.168.1.100"
              className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              autoFocus
            />
            <div className="mt-6 flex justify-end">
                 <button
                    type="submit"
                    disabled={!ipAddress.trim()}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    <QrCodeIcon className="w-5 h-5" />
                    Connect
                </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};