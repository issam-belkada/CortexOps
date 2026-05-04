"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, LineChart, Line 
} from 'recharts';
import { Activity, Database, HardDrive, Network, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '../../lib/backend';

export default function InstanceDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/v1/instances/${id}/monthly-intelligence`));
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const transformMetric = (key: string) => {
    return data?.metrics?.[key]?.map((v: any) => ({
      time: new Date(v[0] * 1000).toLocaleDateString([], {month:'short', day:'numeric', hour:'2-digit'}),
      value: parseFloat(v[1]).toFixed(2)
    })) || [];
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-cyan-500">Loading Deep Analytics...</div>;

  return (
    <div className="space-y-6 p-8 bg-slate-950 min-h-screen text-slate-200">
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${data.status === 'Anomalous' ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
            <Activity className={data.status === 'Anomalous' ? 'text-rose-400' : 'text-emerald-400'} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{data.instance}</h1>
            <p className="text-slate-400 text-sm">Status: <span className="text-slate-200">{data.status}</span> • Last 30 Days</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
            <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Monthly Incidents</p>
                <p className="text-2xl font-mono text-rose-400">{data.anomaly_count}</p>
            </div>
        </div>
      </div>

      {/* 2. CORE METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU CHART */}
        <MetricCard title="Processor Load" icon={<Activity size={18}/>} color="#22d3ee" data={transformMetric('cpu')} unit="%" />
        {/* RAM CHART */}
        <MetricCard title="Memory Usage" icon={<Database size={18}/>} color="#a855f7" data={transformMetric('ram')} unit="%" />
        {/* DISK CHART */}
        <MetricCard title="Storage Pressure" icon={<HardDrive size={18}/>} color="#f59e0b" data={transformMetric('disk')} unit="%" />
        {/* NETWORK CHART */}
        <MetricCard title="Network Throughput" icon={<Network size={18}/>} color="#10b981" data={transformMetric('network')} unit="bps" />
      </div>

      {/* 3. ANOMALY TIMELINE */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Clock className="text-slate-400" size={20} /> Incident History
        </h3>
        <div className="space-y-4">
          {data.history.map((item: any) => (
            <div key={item.id} className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={14} className="text-rose-400" />
                    <span className="font-bold text-slate-100">{item.trigger}</span>
                </div>
                <p className="text-sm text-slate-400">{item.cause}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                <div className="bg-slate-900 px-3 py-1 rounded-lg">CPU: {item.metrics.cpu}%</div>
                <div className="bg-slate-900 px-3 py-1 rounded-lg">RAM: {item.metrics.ram}%</div>
                <span className="text-slate-600">{new Date(item.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {data.history.length === 0 && <p className="text-center py-10 text-slate-600">No anomalies detected in the last month. Perfect uptime!</p>}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, icon, color, data, unit }: any) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="flex items-center gap-2 text-slate-400 font-medium">
          {icon} {title}
        </h4>
        <span className="text-xs font-mono" style={{color}}>{unit}</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip 
                contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b'}}
                itemStyle={{color: color}}
            />
            <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${title})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}