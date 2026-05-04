"use client";
import { useEffect, useMemo, useState } from 'react';
import '../globals.css';
import { AlertTriangle, Clock, Server, TrendingUp } from 'lucide-react';
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
      if (Array.isArray(data)) {
        setHistory(data);
        setTotalRecords(data.length);
        setTotalPages(1);
      } else {
        setHistory(Array.isArray(data.history) ? data.history : []);
        setTotalRecords(data.total_records ?? 0);
        setTotalPages(data.total_pages ?? 0);
      }
    } catch (err) {
      console.error('Erreur Fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadHistory = async () => {
      await fetchHistory(page, pageSize);
    };
    loadHistory();
  }, [page, pageSize]);

  const getTriggerBadgeClass = (triggerType: string) => {
    if (triggerType === 'critical') {
      return 'bg-red-500/15 text-red-300';
    }
    if (triggerType === 'warning') {
      return 'bg-yellow-400/15 text-yellow-200';
    }
    return 'bg-cyan-500/15 text-cyan-200';
  };

  useEffect(() => {
    // Subscribe to new anomalies
    const unsubscribe = subscribe('anomalies', (newAnomaly) => {
      console.log('New anomaly received:', newAnomaly);
      setHistory((prev) => [newAnomaly, ...prev]);
      setTotalRecords((prev) => prev + 1);
    });

    return unsubscribe;
  }, [subscribe]);

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
      <div className="flex items-center gap-3">
        <div className="p-3 bg-red-600/10 rounded-2xl">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Anomaly History</h1>
          <p className="text-slate-400">Monitor and analyze system anomalies and performance issues</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl shadow-slate-950/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Total Anomalies</p>
              <p className="text-2xl font-bold text-white">{totalRecords}</p>
              <p className="text-xs text-slate-500 mt-1">Showing {history.length} this page</p>
            </div>
            <div className="p-3 bg-red-600/10 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl shadow-slate-950/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Critical Issues</p>
              <p className="text-2xl font-bold text-white">
                {history.filter((event) => event.trigger_type === 'critical').length}
              </p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-orange-300" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl shadow-slate-950/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Affected Instances</p>
              <p className="text-2xl font-bold text-white">
                {new Set(history.map((event) => event.instance)).size}
              </p>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-2xl">
              <Server className="w-6 h-6 text-cyan-300" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl shadow-slate-950/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Last 24h</p>
              <p className="text-2xl font-bold text-white">
                {history.filter((event) => {
                  const eventTime = new Date(event.timestamp);
                  return eventTime > oneDayAgo;
                }).length}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <Clock className="w-6 h-6 text-emerald-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Anomalies Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl shadow-slate-950/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">Recent Anomalies</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Instance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Cause
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  CPU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  RAM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Disk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Network
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {history && history.length > 0 ? (
                history.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-950">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {event.instance}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTriggerBadgeClass(event.trigger_type)}`}>
                        {event.trigger_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                      {event.cause}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-200">
                      {event.cpu_val}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-200">
                      {event.ram_val}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-200">
                      {event.disk_val}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-200">
                      {event.net_val}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <AlertTriangle className="w-12 h-12 text-slate-500 mb-4" />
                      <p className="text-slate-400 text-sm">No anomalies detected in the database.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-sm text-slate-400">
            Page {page} of {totalPages || 1} · Showing {history.length} of {totalRecords} records
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="px-3 py-2 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
            <select
              aria-label="Change records per page"
              className="px-3 py-2 rounded-md border border-slate-700 bg-slate-950 text-sm text-slate-200"
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}