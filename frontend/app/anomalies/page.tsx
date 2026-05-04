"use client";
import { useEffect, useMemo, useState } from 'react';
import '../globals.css';
import { AlertTriangle, Clock, Server, TrendingUp, CheckCircle, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '../lib/backend';
import { useWebSocket } from '../lib/websocket-context';

type AnomalyEvent = {
  id: string;
  timestamp: string;
  instance: string;
  trigger_type: string;
  cause: string;
  cpu_val: number;
  ram_val: number;
  disk_val: number;
  net_val: number;
  verified: boolean; // Added from backend
};

export default function AnomaliesPage() {
  const [history, setHistory] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { subscribe } = useWebSocket();
  
  const oneDayAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }, []);

  const fetchHistory = async (currentPage: number, currentPageSize: number) => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/v1/fleet/history?page=${currentPage}&page_size=${currentPageSize}`));
      const data = await res.json();
      // Handle both array and paginated object response
      const records = Array.isArray(data) ? data : (data.history ?? []);
      setHistory(records);
      setTotalRecords(data.total_records ?? records.length);
      setTotalPages(data.total_pages ?? 1);
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Verify Action ---
  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/v1/anomalies/${id}/verify`), {
        method: 'POST',
      });
      if (res.ok) {
        // Update local state to reflect verification immediately
        setHistory(prev => prev.map(item => 
          item.id === id ? { ...item, verified: true } : item
        ));
      }
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  useEffect(() => {
    fetchHistory(page, pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    const unsubscribe = subscribe('anomalies', (newAnomaly) => {
      setHistory((prev) => [newAnomaly, ...prev]);
      setTotalRecords((prev) => prev + 1);
    });
    return unsubscribe;
  }, [subscribe]);

  const getTriggerBadgeClass = (triggerType: string) => {
    if (triggerType.toLowerCase().includes('spike')) return 'bg-orange-500/15 text-orange-300';
    if (triggerType.toLowerCase().includes('threshold')) return 'bg-red-500/15 text-red-300';
    return 'bg-cyan-500/15 text-cyan-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading anomaly history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600/10 rounded-2xl">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Anomaly History</h1>
            <p className="text-slate-400">Verified anomalies will not trigger repeat alerts for 2 hours.</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <p className="text-sm font-medium text-slate-400">Total Anomalies</p>
          <p className="text-2xl font-bold text-white">{totalRecords}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <p className="text-sm font-medium text-slate-400">Unverified</p>
          <p className="text-2xl font-bold text-orange-400">
            {history.filter(e => !e.verified).length}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <p className="text-sm font-medium text-slate-400">Affected Instances</p>
          <p className="text-2xl font-bold text-white">{new Set(history.map(e => e.instance)).size}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <p className="text-sm font-medium text-slate-400">Last 24h</p>
          <p className="text-2xl font-bold text-emerald-400">
            {history.filter(e => new Date(e.timestamp) > oneDayAgo).length}
          </p>
        </div>
      </div>

      {/* Anomalies Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Instance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type / Cause</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Metrics (C/R/D/N)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {history.length > 0 ? (
                history.map((event) => (
                  <tr key={event.id} className={`hover:bg-slate-950/50 transition-colors ${event.verified ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-white">{event.instance}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${getTriggerBadgeClass(event.trigger_type)}`}>
                          {event.trigger_type}
                        </span>
                        <span className="text-sm text-slate-200">{event.cause}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-400">
                      <span className={event.cpu_val > 70 ? 'text-red-400' : ''}>{event.cpu_val}%</span> / 
                      <span className={event.ram_val > 70 ? 'text-red-400' : ''}> {event.ram_val}%</span> / 
                      <span> {event.disk_val}%</span> / 
                      <span> {event.net_val}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {event.verified ? (
                        <div className="flex items-center justify-end gap-1 text-emerald-400 text-xs font-medium">
                          <ShieldCheck className="w-4 h-4" />
                          Verified
                        </div>
                      ) : (
                        <button
                          onClick={() => handleVerify(event.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-400 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Verify Fix
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No anomalies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}