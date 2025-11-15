import React from 'react';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/solid';

export const Header: React.FC = () => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-brand-100 sticky top-0 z-30 safe-top">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <ClipboardDocumentCheckIcon className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Inspect<span className="text-brand-600">AI</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full">
            Инженер PRO
          </div>
        </div>
      </div>
    </header>
  );
};