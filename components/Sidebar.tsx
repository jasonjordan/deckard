import React, { useState } from 'react';
import { ApkInstaller } from './ApkInstaller';
import { AdbPanel } from './AdbPanel';
import { PlusCircleIcon, CommandLineIcon } from './icons';

type Tab = 'install' | 'adb';

interface SidebarProps {
    isFleetLoading: boolean;
    onInstallApk: (packageNameOrPath: string) => void;
    onAdbReboot: () => void;
    onAdbToggleLayoutBounds: () => void;
    onAdbForceStop: (appName: string) => void;
    onAdbUninstall: (packageName: string) => void;
    onAdbGetFleetInfo: () => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const [activeTab, setActiveTab] = useState<Tab>('install');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'install':
        return <ApkInstaller onInstall={props.onInstallApk} isLoading={props.isFleetLoading} />;
      case 'adb':
          return <AdbPanel 
            isFleetLoading={props.isFleetLoading}
            onAdbReboot={props.onAdbReboot}
            onAdbToggleLayoutBounds={props.onAdbToggleLayoutBounds}
            onAdbForceStop={props.onAdbForceStop}
            onAdbUninstall={props.onAdbUninstall}
            onAdbGetFleetInfo={props.onAdbGetFleetInfo}
          />
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabName: Tab, icon: React.ReactNode, label: string }> = ({ tabName, icon, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex-1 flex flex-col items-center justify-center p-2 rounded-t-lg transition-colors duration-200 ${
        activeTab === tabName ? 'bg-slate-800 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800/50'
      }`}
      title={label}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow flex flex-col">
        {renderTabContent()}
      </div>
      <div className="flex-shrink-0 bg-slate-800 border border-slate-700 rounded-b-2xl -mt-2 z-0">
         <div className="flex justify-around items-center bg-slate-900/50 rounded-b-xl border-t border-slate-700 p-1">
            <TabButton tabName="install" icon={<PlusCircleIcon className="w-5 h-5"/>} label="Install"/>
            <TabButton tabName="adb" icon={<CommandLineIcon className="w-5 h-5"/>} label="ADB"/>
         </div>
      </div>
    </div>
  );
};