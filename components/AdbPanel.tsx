import React, { useState } from 'react';
import { ArrowPathIcon, BugAntIcon, XCircleIcon, TrashIcon, DocumentTextIcon } from './icons';

interface AdbPanelProps {
    isFleetLoading: boolean;
    onAdbReboot: () => void;
    onAdbToggleLayoutBounds: () => void;
    onAdbForceStop: (appName: string) => void;
    onAdbUninstall: (packageName: string) => void;
    onAdbGetFleetInfo: () => void;
}

const AdbCommandButton: React.FC<{ title: string, description: string, icon: React.ReactNode, onClick: () => void, disabled: boolean }> = 
({ title, description, icon, onClick, disabled }) => (
    <div className="flex items-start gap-4">
        <div className="mt-1 flex-shrink-0">
            {icon}
        </div>
        <div className="flex-grow">
            <h4 className="font-semibold text-slate-200">{title}</h4>
            <p className="text-xs text-slate-400 mb-2">{description}</p>
            <button
                onClick={onClick}
                disabled={disabled}
                className="px-3 py-1 text-xs font-semibold bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
                Apply to All
            </button>
        </div>
    </div>
);


export const AdbPanel: React.FC<AdbPanelProps> = ({ isFleetLoading, onAdbReboot, onAdbToggleLayoutBounds, onAdbForceStop, onAdbUninstall, onAdbGetFleetInfo }) => {
  const [forceStopAppName, setForceStopAppName] = useState('');
  const [uninstallPackageName, setUninstallPackageName] = useState('');

  const handleForceStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (forceStopAppName.trim() && !isFleetLoading) {
      onAdbForceStop(forceStopAppName);
      setForceStopAppName('');
    }
  };

  const handleUninstallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uninstallPackageName.trim() && !isFleetLoading) {
      onAdbUninstall(uninstallPackageName);
      setUninstallPackageName('');
    }
  };
    
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg flex-grow flex flex-col">
       <div className="text-center mb-4">
         <h3 className="text-md font-semibold">ADB Commands</h3>
         <p className="text-xs text-slate-400">Run simulated ADB commands on all devices.</p>
       </div>
       <div className="space-y-6 overflow-y-auto pr-2 -mr-2">
            <AdbCommandButton 
                title="Reboot"
                description="Simulates restarting all devices. They will show a boot screen."
                icon={<ArrowPathIcon className="w-6 h-6 text-indigo-400" />}
                onClick={onAdbReboot}
                disabled={isFleetLoading}
            />
            <AdbCommandButton 
                title="Toggle Layout Bounds"
                description="Shows debugging outlines for all UI elements on the screen."
                icon={<BugAntIcon className="w-6 h-6 text-indigo-400" />}
                onClick={onAdbToggleLayoutBounds}
                disabled={isFleetLoading}
            />
             <AdbCommandButton 
                title="Get Device Info"
                description="Gathers properties from all online devices and displays them."
                icon={<DocumentTextIcon className="w-6 h-6 text-indigo-400" />}
                onClick={onAdbGetFleetInfo}
                disabled={isFleetLoading}
            />

            <div className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0">
                    <XCircleIcon className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex-grow">
                    <h4 className="font-semibold text-slate-200">Force Stop App</h4>
                    <p className="text-xs text-slate-400 mb-2">Simulates forcing an application to close. Returns to the home screen.</p>
                    <form onSubmit={handleForceStopSubmit} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={forceStopAppName}
                            onChange={(e) => setForceStopAppName(e.target.value)}
                            placeholder="e.g., com.google.youtube"
                            disabled={isFleetLoading}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isFleetLoading || !forceStopAppName.trim()}
                            className="px-3 py-1 text-xs font-semibold bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                            Apply
                        </button>
                    </form>
                </div>
            </div>

            <div className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0">
                    <TrashIcon className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex-grow">
                    <h4 className="font-semibold text-slate-200">Uninstall App</h4>
                    <p className="text-xs text-slate-400 mb-2">Simulates uninstalling an application by its package name.</p>
                    <form onSubmit={handleUninstallSubmit} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={uninstallPackageName}
                            onChange={(e) => setUninstallPackageName(e.target.value)}
                            placeholder="e.g., com.netflix.ninja"
                            disabled={isFleetLoading}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isFleetLoading || !uninstallPackageName.trim()}
                            className="px-3 py-1 text-xs font-semibold bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                            Apply
                        </button>
                    </form>
                </div>
            </div>

       </div>
    </div>
  );
};