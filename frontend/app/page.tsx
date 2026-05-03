"use client";
import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, AlertTriangle, Database, Network, HardDrive, Cpu, TrendingUp, Users, Server, Zap } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/fleet/intelligence');
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Real-time Root Cause Analysis Engine</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Live Data
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Instances</p>
              <p className="text-2xl font-bold text-gray-900">{data.fleet?.length || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Server className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Anomalies</p>
              <p className="text-2xl font-bold text-red-600">{data.summary?.anomalies || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Healthy</p>
              <p className="text-2xl font-bold text-green-600">
                {(data.fleet?.length || 0) - (data.summary?.anomalies || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.fleet?.length > 0
                  ? Math.round(data.fleet.reduce((sum: number, server: any) => sum + server.metrics.cpu, 0) / data.fleet.length)
                  : 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Cpu className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Fleet Overview</h3>
            <p className="text-sm text-gray-600">The instance list is now available on the dedicated Instances page.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-dashed border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">New Instance list location</h4>
              <p className="text-sm text-gray-600 mb-4">
                Click through to the Instances page to browse your fleet and open a specific instance dashboard.
              </p>
              <a
                href="/instances"
                className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700"
              >
                View Instances
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-5 rounded-xl">
                <p className="text-xs uppercase tracking-wide text-gray-500">Fleet health</p>
                <p className="mt-3 text-2xl font-semibold text-gray-900">{data.fleet?.length ? Math.round(((data.fleet.length - (data.summary?.anomalies || 0)) / data.fleet.length)*100) : 0}%</p>
                <p className="mt-2 text-sm text-gray-500">Healthy instances percentage</p>
              </div>
              <div className="bg-gray-50 p-5 rounded-xl">
                <p className="text-xs uppercase tracking-wide text-gray-500">Data refresh</p>
                <p className="mt-3 text-2xl font-semibold text-gray-900">Every 3 seconds</p>
                <p className="mt-2 text-sm text-gray-500">Live metrics from Prometheus</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity / Summary */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">System Summary</h3>
            <p className="text-sm text-gray-600">Current system status</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Instances</span>
              <span className="font-semibold text-gray-900">{data.fleet?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Anomalous</span>
              <span className="font-semibold text-red-600">{data.summary?.anomalies || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Healthy</span>
              <span className="font-semibold text-green-600">
                {(data.fleet?.length || 0) - (data.summary?.anomalies || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Update</span>
              <span className="font-semibold text-gray-900">Just now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pro CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
            <p className="text-blue-100 mb-4">Get advanced analytics, custom alerts, and priority support</p>
            <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-50 transition">
              Learn More
            </button>
          </div>
          <div className="hidden md:block">
            <Zap className="w-16 h-16 text-blue-200" />
          </div>
        </div>
      </div>
    </div>
  );
}