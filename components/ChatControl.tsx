import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { PaperAirplaneIcon, SparklesIcon, UserIcon, ExclamationTriangleIcon } from './icons';

interface ChatControlProps {
  messages: Message[];
  onSendCommand: (command: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const ChatControl: React.FC<ChatControlProps> = ({ messages, onSendCommand, isLoading, error }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendCommand(input);
      setInput('');
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col h-full shadow-lg">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-center">Fleet Command Center</h2>
        <p className="text-sm text-slate-400 text-center">Instruct all devices with natural language.</p>
      </div>

      <div className="flex-grow p-4 overflow-y-auto">
        <div className="flex flex-col gap-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-slate-700 text-white rounded-br-none' : 'bg-slate-700/50 text-slate-300 rounded-bl-none'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
               {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
           <div ref={messagesEndRef} />
        </div>
      </div>
      
      {error && (
        <div className="p-3 mx-4 mb-2 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="p-4 border-t border-slate-700">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLoading ? 'Processing fleet command...' : 'e.g., Open YouTube'}
            disabled={isLoading}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
          >
            <PaperAirplaneIcon className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
};