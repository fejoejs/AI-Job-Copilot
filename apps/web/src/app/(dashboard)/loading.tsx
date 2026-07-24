import React from 'react';
import { Bot } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full animate-in fade-in duration-300">
      <div className="relative">
        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
        <div className="relative bg-zinc-900/80 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-sm">
          <Bot className="w-10 h-10 text-purple-400 animate-bounce" />
        </div>
      </div>
      <div className="mt-8 flex flex-col items-center">
        <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 w-full animate-pulse" />
        </div>
        <span className="text-sm font-semibold text-zinc-400 mt-4 tracking-wider uppercase">Loading Workspace</span>
      </div>
    </div>
  );
}
