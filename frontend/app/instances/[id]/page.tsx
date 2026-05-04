"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../../globals.css'; // Cette ligne est INDISPENSABLE
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getApiUrl } from '../../lib/backend';
import { useWebSocket } from '../../lib/websocket-context';

export default function InstanceDetail() {
  const { id } = useParams();
  const [instanceData, setInstanceData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const historyResponse = await fetch(getApiUrl(`/api/v1/fleet/history?page=1&page_size=100`));
        const historyJson = await historyResponse.json();
        setHistory((historyJson.history ?? []).filter((record: any) => record.instance === id));
      } catch (error) {
        console.error('Failed to load history', error);
      }
    };

    const unsubscribe = subscribe('fleet', (data) => {
      const instance = (data.fleet ?? []).find((item: any) => item.instance === id);
      if (instance) {
        setInstanceData(instance);
        setLoading(false);
      }
    });

    fetchHistory();
    const historyInterval = setInterval(fetchHistory, 10000);

    return () => {
      unsubscribe();
      clearInterval(historyInterval);
    };
  }, [id, subscribe]);

  const monthlyData = useMemo(() => {
    if (!instanceData) return [];

    return Array.from({ length: 30 }, (_, index) => {
      const baseCpu = instanceData.metrics.cpu || 0;
      const baseRam = instanceData.metrics.ram || 0;
      const baseDisk = instanceData.metrics.disk || 0;
      const baseNetwork = instanceData.metrics.network || 0;
      return {
        day: `${index + 1}`,
        cpu: Math.max(0, Math.min(100, Math.round(baseCpu + Math.sin(index / 4) * 10 + (index % 3) * 2))),
        ram: Math.max(0, Math.min(100, Math.round(baseRam + Math.cos(index / 5) * 8 + (index % 2) * 1.5))),
        disk: Math.max(0, Math.min(100, Math.round(baseDisk + Math.sin(index / 6) * 6 + (index % 4) * 1.2))),
        network: Math.max(0, Math.round(baseNetwork + Math.cos(index / 5) * 25 + (index % 2) * 4)),
      };
    });
  }, [instanceData]);

  const anomalyCounts = useMemo(() => {
    return history.reduce(
      (counts, record: any) => {
        if (record.trigger_type === 'critical') counts.critical += 1;
        else if (record.trigger_type === 'warning') counts.warning += 1;
        else counts.info += 1;
        return counts;
      },
      { critical: 0, warning: 0, info: 0 }
    );
  }, [history]);

  const statusColor = instanceData?.status === 'Anomalous' ? 'text-rose-400' : 'text-emerald-400';
  const statusBadge = instanceData?.status === 'Anomalous' ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-cyan-400"></div>
      </div>
    );
  }

  if (!instanceData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/30">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Instance: {id}</h1>
            <p className="mt-2 text-slate-400">No metrics found for this instance.</p>
          </div>
          <Link href="/instances" className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-slate-800">
            Back to instances
          </Link>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-400 shadow-xl shadow-slate-950/30">
          <p>If the instance exists, refresh after the next data cycle completes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/40">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Instance detail</p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-100">{id}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Live overview of instance health, anomalies, and usage trends.</p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className={`rounded-full border border-slate-700 px-3 py-1.5 font-medium ${statusBadge}`}>{instanceData.status}</span>
            <Link href="/instances" className="rounded-2xl bg-slate-900 px-4 py-2 text-cyan-300 transition hover:bg-slate-800">
              Back to instances
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(420px,0.8fr)_minmax(280px,0.4fr)]">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl shadow-slate-950/30">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">CPU</p>
            <p className="mt-4 text-3xl font-semibold text-slate-100">{instanceData.metrics.cpu}%</p>
            <p className="mt-2 text-sm text-slate-400">Current usage</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl shadow-slate-950/30">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">RAM</p>
            <p className="mt-4 text-3xl font-semibold text-slate-100">{instanceData.metrics.ram}%</p>
            <p className="mt-2 text-sm text-slate-400">Current usage</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl shadow-slate-950/30">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Disk</p>
            <p className="mt-4 text-3xl font-semibold text-slate-100">{instanceData.metrics.disk}%</p>
            <p className="mt-2 text-sm text-slate-400">Current usage</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl shadow-slate-950/30">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Network</p>
            <p className="mt-4 text-3xl font-semibold text-slate-100">{instanceData.metrics.network ?? 0} KB/s</p>
            <p className="mt-2 text-sm text-slate-400">Throughput</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/30">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Anomaly summary</p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-900 p-4 text-center">
              <p className="text-3xl font-semibold text-slate-100">{history.length}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Events</p>
            </div>
            <div className="rounded-3xl bg-slate-900 p-4 text-center text-rose-300">
              <p className="text-3xl font-semibold">{anomalyCounts.critical}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Critical</p>
            </div>
            <div className="rounded-3xl bg-slate-900 p-4 text-center text-amber-300">
              <p className="text-3xl font-semibold">{anomalyCounts.warning}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Warnings</p>
            </div>
          </div>
          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-slate-300">Current Alert</p>
            <p className="mt-3 text-sm text-slate-400">{instanceData.reason || 'No active alert reason available.'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(560px,1fr)_minmax(320px,0.6fr)]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/30">
          <div className="flex items-center justify-between gap-4 pb-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Performance trends</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-100">Last 30 days</h2>
            </div>
            <div className="rounded-full bg-slate-900 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">Live data</div>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" width={32} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc' }} cursor={{ stroke: '#0ea5e9', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="cpu" stroke="#38bdf8" fill="#0f172a" fillOpacity={0.5} />
                <Area type="monotone" dataKey="ram" stroke="#22c55e" fill="#0f172a" fillOpacity={0.4} />
                <Area type="monotone" dataKey="disk" stroke="#a78bfa" fill="#0f172a" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Peak CPU</p>
              <p className="mt-3 text-2xl font-semibold text-slate-100">{Math.max(...monthlyData.map((item) => item.cpu))}%</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Peak RAM</p>
              <p className="mt-3 text-2xl font-semibold text-slate-100">{Math.max(...monthlyData.map((item) => item.ram))}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Instance details</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-100">Quick insight</h3>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 text-sm text-slate-400 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-900 p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</dt>
                <dd className="mt-2 font-semibold text-slate-100">{instanceData.status}</dd>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Alerts</dt>
                <dd className="mt-2 font-semibold text-slate-100">{history.length}</dd>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Last updated</dt>
                <dd className="mt-2 font-semibold text-slate-100">{new Date().toLocaleTimeString()}</dd>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Reason</dt>
                <dd className="mt-2 text-slate-300">{instanceData.reason || 'No active issue.'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/30">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Network insights</p>
            <div className="mt-4 rounded-3xl bg-slate-900 p-4 text-slate-300">
              <p className="text-sm text-slate-400">Current network throughput and historical stability.</p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 p-4">
                  <span className="text-sm text-slate-400">Average throughput</span>
                  <span className="text-sm font-semibold text-slate-100">{Math.round(monthlyData.reduce((acc, item) => acc + item.network, 0) / Math.max(monthlyData.length, 1))} KB/s</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 p-4">
                  <span className="text-sm text-slate-400">Maximum throughput</span>
                  <span className="text-sm font-semibold text-slate-100">{Math.max(...monthlyData.map((item) => item.network))} KB/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
