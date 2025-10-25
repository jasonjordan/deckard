import React from 'react';
import { XCircleIcon } from './icons';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()} // Prevent clicks inside from closing the modal
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="p-6 overflow-y-auto">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            {content}
          </pre>
        </main>
      </div>
    </div>
  );
};