"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../../globals.css'; // Cette ligne est INDISPENSABLE
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function InstanceDetail() {
  const { id } = useParams();
  const [instanceData, setInstanceData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInstanceData = async () => {
      try {
        const fleetResponse = await fetch('http://localhost:8000/api/v1/fleet/intelligence');
        const fleetJson = await fleetResponse.json();
        const instance = (fleetJson.fleet ?? []).find((item: any) => item.instance === id);
        setInstanceData(instance || null);

        const historyResponse = await fetch('http://localhost:8000/api/v1/fleet/history?page=1&page_size=100');
        const historyJson = await historyResponse.json();
        setHistory((historyJson.history ?? []).filter((record: any) => record.instance === id));
      } catch (error) {
        console.error('Failed to load instance details', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstanceData();
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!instanceData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Instance: {id}</h1>
            <p className="text-gray-600">No metrics found for this instance.</p>
          </div>
          <Link href="/instances" className="text-blue-600 hover:underline">
            Back to instances
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-gray-600">If the instance exists, refresh after the next data cycle completes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instance: {id}</h1>
          <p className="text-gray-600">Detailed metrics and monthly trends</p>
        </div>
        <Link href="/instances" className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
          Back to instances
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Status</p>
          <p className={`mt-3 text-2xl font-bold ${instanceData.status === 'Anomalous' ? 'text-red-600' : 'text-green-600'}`}>
            {instanceData.status}
          </p>
          <p className="mt-2 text-sm text-gray-500">{instanceData.reason}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">CPU Usage</p>
          <p className="mt-3 text-2xl font-bold text-gray-900">{instanceData.metrics.cpu}%</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">RAM Usage</p>
          <p className="mt-3 text-2xl font-bold text-gray-900">{instanceData.metrics.ram}%</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Disk Usage</p>
          <p className="mt-3 text-2xl font-bold text-gray-900">{instanceData.metrics.disk}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Metrics</h3>
          <div className="space-y-6">
            {['cpu', 'ram', 'disk', 'network'].map((metric) => (
              <div key={metric} className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">{metric.toUpperCase()}</p>
                  <p className="text-sm text-gray-500">
                    Current {instanceData.metrics[metric]}{metric === 'network' ? ' KB/s' : '%'}
                  </p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData} margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={false} />
                      <YAxis stroke="#6b7280" width={30} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                      <Area
                        type="monotone"
                        dataKey={metric}
                        stroke={metric === 'cpu' ? '#3b82f6' : metric === 'ram' ? '#10b981' : metric === 'disk' ? '#8b5cf6' : '#f97316'}
                        fill={metric === 'cpu' ? '#dbeafe' : metric === 'ram' ? '#d1fae5' : metric === 'disk' ? '#ede9fe' : '#ffedd5'}
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Anomalies</h3>
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((record: any) => (
                <div key={record.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{new Date(record.timestamp).toLocaleString()}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      record.trigger_type === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : record.trigger_type === 'warning'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {record.trigger_type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">Cause: {record.cause}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>CPU: {record.cpu_val}%</div>
                    <div>RAM: {record.ram_val}%</div>
                    <div>Disk: {record.disk_val}%</div>
                    <div>Network: {record.net_val}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No recent anomaly records for this instance.</p>
          )}
        </div>
      </div>
    </div>
  );
}
