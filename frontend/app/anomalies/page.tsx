"use client";
import { useEffect, useState } from 'react';

export default function AnomaliesPage() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/fleet/history')
      .then(res => res.json())
      .then(data => setHistory(data));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Journal des Anomalies</h1>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-700 text-slate-300 uppercase text-xs">
            <tr>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Instance</th>
              <th className="p-4">Trigger</th>
              <th className="p-4">Cause Prédite (IA)</th>
              <th className="p-4">CPU %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {history.map((event: any) => (
              <tr key={event.id} className="hover:bg-slate-700/50">
                <td className="p-4 text-sm font-mono">{new Date(event.timestamp).toLocaleString()}</td>
                <td className="p-4 font-semibold">{event.instance}</td>
                <td className="p-4"><span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">{event.trigger_type}</span></td>
                <td className="p-4 text-blue-300">{event.cause}</td>
                <td className="p-4 font-mono">{event.cpu_val}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}