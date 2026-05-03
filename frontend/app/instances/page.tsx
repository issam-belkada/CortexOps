"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import '../globals.css';
import { Server } from 'lucide-react';

export default function InstancesPage() {
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/fleet/intelligence');
        const json = await res.json();
        setFleet(json.fleet ?? []);
      } catch (error) {
        console.error('Failed to fetch fleet instances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalInstances = fleet.length;
  const anomalousCount = fleet.filter((item) => item.status === 'Anomalous').length;
  const healthyCount = totalInstances - anomalousCount;
  const avgCpu = totalInstances > 0 ? Math.round(fleet.reduce((sum, item) => sum + (item.metrics.cpu || 0), 0) / totalInstances) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Server className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instances</h1>
          <p className="text-gray-600">Browse your fleet and open a specific instance dashboard.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Total Instances</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{totalInstances}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Anomalous</p>
          <p className="mt-3 text-3xl font-bold text-red-600">{anomalousCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Healthy</p>
          <p className="mt-3 text-3xl font-bold text-green-600">{healthyCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Avg CPU</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{avgCpu}%</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Instance list</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {fleet.length > 0 ? (
            fleet.map((server: any) => (
              <Link key={server.instance} href={`/instances/${encodeURIComponent(server.instance)}`} className="block p-6 hover:bg-gray-50">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-3 w-3 rounded-full ${server.status === 'Anomalous' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                      <h4 className="text-lg font-semibold text-gray-900">{server.instance}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{server.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm text-gray-600">
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <p className="text-xs uppercase tracking-wide">CPU</p>
                      <p className="mt-2 font-semibold text-gray-900">{server.metrics.cpu}%</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <p className="text-xs uppercase tracking-wide">RAM</p>
                      <p className="mt-2 font-semibold text-gray-900">{server.metrics.ram}%</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <p className="text-xs uppercase tracking-wide">Disk</p>
                      <p className="mt-2 font-semibold text-gray-900">{server.metrics.disk}%</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <p className="text-xs uppercase tracking-wide">Net</p>
                      <p className="mt-2 font-semibold text-gray-900">{server.metrics.network} KB/s</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">No instances available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
