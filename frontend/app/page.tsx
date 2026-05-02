"use client";
import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, AlertTriangle, Database, Network, HardDrive, Cpu } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('http://localhost:8000/api/v1/fleet/intelligence');
      const json = await res.json();
      setData(json);
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div className="p-10 text-center">Connecting to AI Backend...</div>;

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Fleet Intelligence</h1>
          <p className="text-slate-400">Real-time Root Cause Analysis Engine</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <span className="text-sm text-slate-400 block">Anomalies</span>
            <span className={`text-2xl font-mono ${data.summary.anomalies > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {data.summary.anomalies}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {data.fleet.map((server: any) => (
  <div key={server.instance} className={`p-6 rounded-xl border ${server.status === 'Anomalous' ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-800'}`}>
    <div className="flex justify-between items-start mb-6">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        {/* FIXED: Removed quotes around {20} and the template literal */}
        <Activity size={20} className={server.status === 'Anomalous' ? 'text-red-500' : 'text-green-500'} />
        {server.instance}
      </h3>
      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${server.status === 'Anomalous' ? 'bg-red-500' : 'bg-green-500'}`}>
        {server.status}
      </span>
    </div>

    {/* Metrics Grid */}
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-slate-900/50 p-3 rounded">
        <p className="text-xs text-slate-400 flex items-center gap-1 mb-1"><Cpu size={12}/> CPU</p>
        <p className="text-lg font-mono">{server.metrics.cpu}%</p>
      </div>
      <div className="bg-slate-900/50 p-3 rounded">
        <p className="text-xs text-slate-400 flex items-center gap-1 mb-1"><Database size={12}/> RAM</p>
        <p className="text-lg font-mono">{server.metrics.ram}%</p>
      </div>
      <div className="bg-slate-900/50 p-3 rounded">
        <p className="text-xs text-slate-400 flex items-center gap-1 mb-1"><HardDrive size={12}/> DISK</p>
        <p className="text-lg font-mono">{server.metrics.disk}%</p>
      </div>
      <div className="bg-slate-900/50 p-3 rounded">
        <p className="text-xs text-slate-400 flex items-center gap-1 mb-1"><Network size={12}/> NET</p>
        <p className="text-lg font-mono">{server.metrics.network} KB/s</p>
      </div>
    </div>

    {/* AI Diagnosis */}
    <div className={`p-4 rounded-lg ${server.status === 'Anomalous' ? 'bg-red-900/40 border border-red-500/50' : 'bg-slate-900'}`}>
      <p className="text-xs text-slate-400 uppercase mb-1">AI Diagnosis</p>
      <p className="font-medium">{server.reason}</p>
    </div>
  </div>
))}
      </div>
    </main>
  );
}