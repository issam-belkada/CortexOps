'use client';

import React, { useEffect, useState } from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
import { useWebSocket } from '../lib/websocket-context';

export default function Header() {
  const { subscribe } = useWebSocket();
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe('anomalies', (data: unknown) => {
      if (Array.isArray(data)) {
        setAnomalyCount(data.length);
        return;
      }

      if (data && typeof data === 'object' && 'anomalies' in data) {
        const payload = data as { anomalies?: unknown };
        if (Array.isArray(payload.anomalies)) {
          setAnomalyCount(payload.anomalies.length);
          return;
        }
      }

      setAnomalyCount(0);
    });

    return unsubscribe;
  }, [subscribe]);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-xl shadow-slate-950/20">
      <div className="flex items-center gap-4">
        <button
          aria-label="Open navigation menu"
          className="p-2 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">AI Fleet Intelligence</h1>
          <p className="text-sm text-slate-400">Real-time fleet monitoring and anomaly alerts</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          aria-label="View anomaly notifications"
          className="p-2 rounded-2xl bg-slate-800 text-slate-200 hover:bg-red-600 hover:text-white relative transition"
        >
          <Bell size={20} />
          {anomalyCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {anomalyCount > 99 ? '99+' : anomalyCount}
            </span>
          )}
        </button>
        <button aria-label="Open user profile" className="p-2 rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition">
          <User size={20} />
        </button>
      </div>
    </header>
  );
}