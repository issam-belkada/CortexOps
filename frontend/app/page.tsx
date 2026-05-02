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
        {/* Instances List */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Fleet Instances</h3>
            <p className="text-sm text-gray-600">Real-time monitoring of all instances</p>
          </div>
          <div className="divide-y divide-gray-200">
            {data.fleet?.map((server: any) => (
              <div key={server.instance} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${server.status === 'Anomalous' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <h4 className="font-medium text-gray-900">{server.instance}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      server.status === 'Anomalous'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {server.status}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-600">CPU</p>
                    <p className="font-semibold text-gray-900">{server.metrics.cpu}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600">RAM</p>
                    <p className="font-semibold text-gray-900">{server.metrics.ram}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600">Disk</p>
                    <p className="font-semibold text-gray-900">{server.metrics.disk}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600">Network</p>
                    <p className="font-semibold text-gray-900">{server.metrics.network} KB/s</p>
                  </div>
                </div>

                {/* AI Diagnosis */}
                {server.reason && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">AI Diagnosis</p>
                    <p className="text-sm text-gray-900">{server.reason}</p>
                  </div>
                )}
              </div>
            ))}
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