"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import '../globals.css';
import { Server } from 'lucide-react';
import { getApiUrl } from '../lib/backend';
import { useWebSocket } from '../lib/websocket-context';

export default function InstancesPage() {
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const fetchFleet = async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/fleet/intelligence'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setFleet(json.fleet ?? []);
      } catch (error) {
        console.warn('Initial fleet fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFleet();

    const unsubscribe = subscribe('fleet', (fleetData) => {
      setFleet(fleetData.fleet ?? []);
      setLoading(false);
    });

    return unsubscribe;
  }, [subscribe]);

  const totalInstances = fleet.length;
  const anomalousCount = fleet.filter((item) => item.status === 'Anomalous').length;
  const healthyCount = totalInstances - anomalousCount;
  const avgCpu = totalInstances > 0 ? Math.round(fleet.reduce((sum, item) => sum + (item.metrics.cpu || 0), 0) / totalInstances) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 shadow-lg shadow-cyan-500/10">
            <Server className="w-6 h-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Instances</h1>
            <p className="mt-1 text-sm text-slate-400">Browse your fleet and open a specific instance dashboard.</p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-300">
          <span className="mr-2 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/40" />
          Live fleet sync enabled
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-900/40">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Total Instances</p>
          <p className="mt-4 text-4xl font-semibold text-slate-100">{totalInstances}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-900/40">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Anomalous</p>
          <p className="mt-4 text-4xl font-semibold text-rose-400">{anomalousCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-900/40">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Healthy</p>
          <p className="mt-4 text-4xl font-semibold text-emerald-300">{healthyCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-900/40">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Avg CPU</p>
          <p className="mt-4 text-4xl font-semibold text-slate-100">{avgCpu}%</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-xl shadow-slate-900/40">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Fleet overview</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Instance list</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm text-slate-300">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
            {anomalousCount} anomalous instance{anomalousCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {fleet.length > 0 ? (
            fleet.map((server: any) => (
              <Link
                key={server.instance}
                href={`/instances/${encodeURIComponent(server.instance)}`}
                className="block border-b border-slate-800 px-6 py-5 transition hover:bg-slate-900/80"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex h-3.5 w-3.5 rounded-full ${server.status === 'Anomalous' ? 'bg-rose-400' : 'bg-emerald-400'}`}
                      />
                      <h3 className="text-xl font-semibold text-slate-100">{server.instance}</h3>
                    </div>
                    <p className="max-w-2xl text-sm text-slate-400">{server.reason || 'No issue details available.'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
                    <div className="rounded-3xl bg-slate-900 px-4 py-3 text-center ring-1 ring-slate-800">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">CPU</p>
                      <p className="mt-2 text-lg font-semibold text-slate-100">{server.metrics.cpu ?? 0}%</p>
                    </div>
                    <div className="rounded-3xl bg-slate-900 px-4 py-3 text-center ring-1 ring-slate-800">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">RAM</p>
                      <p className="mt-2 text-lg font-semibold text-slate-100">{server.metrics.ram ?? 0}%</p>
                    </div>
                    <div className="rounded-3xl bg-slate-900 px-4 py-3 text-center ring-1 ring-slate-800">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Disk</p>
                      <p className="mt-2 text-lg font-semibold text-slate-100">{server.metrics.disk ?? 0}%</p>
                    </div>
                    <div className="rounded-3xl bg-slate-900 px-4 py-3 text-center ring-1 ring-slate-800">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Net</p>
                      <p className="mt-2 text-lg font-semibold text-slate-100">{server.metrics.network ?? 0} KB/s</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-slate-500">No instances available.</div>
          )}
        </div>
      </section>
    </div>
  );
}
