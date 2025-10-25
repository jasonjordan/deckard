import React from 'react';
import { ComputerDesktopIcon, PlusCircleIcon } from './icons';

interface HeaderProps {
    deviceCount: number;
    onAddDevice: () => void;
    onEndSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({ deviceCount, onAddDevice, onEndSession }) => {
    return (
        <header className="flex items-center justify-between p-4 bg-slate-900/60 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50 flex-shrink-0">
            <div className="flex items-center gap-3">
                <ComputerDesktopIcon className="w-8 h-8 text-indigo-400" />
                <h1 className="text-xl font-bold text-slate-200">Deckard</h1>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">{deviceCount} device{deviceCount !== 1 ? 's' : ''} connected</span>
                 <button
                    onClick={onAddDevice}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    Add Device
                </button>
                {deviceCount > 0 && (
                    <button
                        onClick={onEndSession}
                        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-red-500"
                    >
                        Disconnect All
                    </button>
                )}
            </div>
        </header>
    );
};