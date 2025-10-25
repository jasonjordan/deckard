import React, { useState } from 'react';
import { PlusCircleIcon } from './icons';

interface ApkInstallerProps {
  onInstall: (packageNameOrPath: string) => void;
  isLoading: boolean;
}

export const ApkInstaller: React.FC<ApkInstallerProps> = ({ onInstall, isLoading }) => {
  const [packageNameOrPath, setPackageNameOrPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (packageNameOrPath.trim() && !isLoading) {
      onInstall(packageNameOrPath);
      setPackageNameOrPath('');
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg flex-shrink-0">
       <h3 className="text-md font-semibold text-center mb-1">Mass Install APK</h3>
       <p className="text-xs text-slate-400 text-center mb-3">
        Enter the full path to an APK file already on the device.
        (e.g., <code className="bg-slate-900 px-1 rounded">/sdcard/Download/app.apk</code>)
       </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={packageNameOrPath}
          onChange={(e) => setPackageNameOrPath(e.target.value)}
          placeholder={isLoading ? "Installing..." : "Full path to APK on device"}
          disabled={isLoading}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !packageNameOrPath.trim()}
          className="p-2 w-9 h-9 flex-shrink-0 flex items-center justify-center bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
          title="Install App"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <PlusCircleIcon className="w-5 h-5 text-white" />
          )}
        </button>
      </form>
    </div>
  );
};