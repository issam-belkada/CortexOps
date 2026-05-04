"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, Server, Activity, Cpu,
  HardDrive, Wifi, Database, ArrowUpRight, Clock,
  TrendingUp, TrendingDown, Minus, AlertOctagon, CheckCircle2,
  Radio, Layers, BarChart3, Zap
} from 'lucide-react';
import { getApiUrl } from './lib/backend';
import { useWebSocket } from './lib/websocket-context';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, Cell, PieChart, Pie, Legend,
} from 'recharts';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metrics { cpu: number; ram: number; disk: number; network: number }
interface FleetNode {
  instance: string; metrics: Metrics;
  status: string; reason: string; recent_logs: any[]
}
interface FleetData {
  timestamp: number;
  summary: { total_instances: number; anomalies: number; learning_phase: number };
  fleet: FleetNode[];
}
interface AnomalyRecord {
  id: number; timestamp: string; instance: string;
  cpu_val: number; ram_val: number; disk_val: number; net_val: number;
  trigger_type: string; cause: string; logs: string;
}

// ─── Sparkline history buffer ─────────────────────────────────────────────────
const MAX_SPARKLINE = 40;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function metricColor(v: number, warn = 70, crit = 85) {
  if (v >= crit) return '#ef4444';
  if (v >= warn) return '#f59e0b';
  return '#22d3ee';
}

function statusColor(s: string) {
  if (s === 'Healthy') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: '#10b981' };
  if (s === 'Anomalous') return { bg: 'bg-red-500/10', text: 'text-red-400', dot: '#ef4444' };
  return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: '#f59e0b' };
}

function fmt(n: number, decimals = 1) { return n.toFixed(decimals); }
function fmtBytes(n: number) {
  if (n > 1_000_000) return `${fmt(n / 1_000_000)} MB/s`;
  if (n > 1_000) return `${fmt(n / 1_000)} KB/s`;
  return `${fmt(n)} B/s`;
}
function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Mini gauge ───────────────────────────────────────────────────────────────
function GaugeArc({ value, color }: { value: number; color: string }) {
  const r = 28; const circ = Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * circ;
  return (
    <svg width="72" height="42" viewBox="0 0 72 42">
      <path d="M8,36 A28,28 0 0,1 64,36" fill="none" stroke="#1e2a3a" strokeWidth="7" strokeLinecap="round" />
      <path d="M8,36 A28,28 0 0,1 64,36" fill="none" stroke={color}
        strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="36" y="38" textAnchor="middle" fontSize="11" fontWeight="700"
        fill={color} fontFamily="'JetBrains Mono', monospace">{Math.round(pct)}%</text>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-8 w-full" />;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (v / max) * 90;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1929] border border-cyan-900/40 rounded-lg px-3 py-2 shadow-2xl text-xs font-mono">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}{p.unit || ''}</p>
      ))}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<FleetData | null>(null);
  const [history, setHistory] = useState<AnomalyRecord[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, { cpu: number[]; ram: number[]; disk: number[]; net: number[] }>>({});
  const [fleetTimeline, setFleetTimeline] = useState<{ t: string; cpu: number; ram: number; disk: number; net: number }[]>([]);
  const [tick, setTick] = useState(0);
  const { subscribe, isConnected } = useWebSocket();

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/v1/fleet/intelligence'));
      const json = await res.json();
      setData(json.data ?? json);
    } catch { setData({ timestamp: Date.now() / 1000, summary: { total_instances: 0, anomalies: 0, learning_phase: 0 }, fleet: [] }); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/v1/fleet/history?page=1&page_size=100'));
      const json = await res.json();
      setHistory(Array.isArray(json.history) ? json.history : []);
    } catch { setHistory([]); }
  }, []);

  const ingestFleet = useCallback((payload: FleetData) => {
    if (!payload?.fleet) return;
    setData(payload);
    setTick(t => t + 1);

    // Update per-instance sparklines
    setSparklines(prev => {
      const next = { ...prev };
      payload.fleet.forEach(node => {
        const old = prev[node.instance] ?? { cpu: [], ram: [], disk: [], net: [] };
        next[node.instance] = {
          cpu:  [...old.cpu,  node.metrics.cpu].slice(-MAX_SPARKLINE),
          ram:  [...old.ram,  node.metrics.ram].slice(-MAX_SPARKLINE),
          disk: [...old.disk, node.metrics.disk].slice(-MAX_SPARKLINE),
          net:  [...old.net,  node.metrics.network].slice(-MAX_SPARKLINE),
        };
      });
      return next;
    });

    // Fleet-wide average timeline
    const fl = payload.fleet;
    if (fl.length > 0) {
      const avg = (key: keyof Metrics) => fl.reduce((s, n) => s + n.metrics[key], 0) / fl.length;
      const now = new Date().toLocaleTimeString('en', { hour12: false });
      setFleetTimeline(prev => [
        ...prev,
        { t: now, cpu: avg('cpu'), ram: avg('ram'), disk: avg('disk'), net: avg('network') }
      ].slice(-MAX_SPARKLINE));
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    fetchHistory();
    const unsub1 = subscribe('fleet', ingestFleet);
    const unsub2 = subscribe('anomalies', (payload) => {
      if (payload) setHistory(prev => [payload, ...prev].slice(0, 200));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (isConnected) return;
    const iv = window.setInterval(fetchInitialData, 10_000);
    return () => window.clearInterval(iv);
  }, [isConnected, fetchInitialData]);

  // ─── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const fleet = data?.fleet ?? [];
    const total = fleet.length;
    const anomalies = data?.summary?.anomalies ?? 0;
    const learning = data?.summary?.learning_phase ?? 0;
    const healthy = total - anomalies - learning;

    const avgMetrics = fleet.length ? {
      cpu:  fleet.reduce((s, n) => s + n.metrics.cpu, 0) / fleet.length,
      ram:  fleet.reduce((s, n) => s + n.metrics.ram, 0) / fleet.length,
      disk: fleet.reduce((s, n) => s + n.metrics.disk, 0) / fleet.length,
      net:  fleet.reduce((s, n) => s + n.metrics.network, 0) / fleet.length,
    } : { cpu: 0, ram: 0, disk: 0, net: 0 };

    // Cause breakdown from history
    const causeCounts: Record<string, number> = {};
    history.forEach(h => {
      const c = h.cause || 'Unknown';
      causeCounts[c] = (causeCounts[c] ?? 0) + 1;
    });
    const causeData = Object.entries(causeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // Instance health bar data
    const instanceBars = fleet.map(n => ({
      name: n.instance.replace('remote-', '').replace('-0', '').slice(0, 14),
      cpu: n.metrics.cpu, ram: n.metrics.ram, disk: n.metrics.disk,
      status: n.status,
    }));

    // Radar data
    const radarData = [
      { subject: 'CPU',     A: avgMetrics.cpu,                fullMark: 100 },
      { subject: 'RAM',     A: avgMetrics.ram,                fullMark: 100 },
      { subject: 'Disk',    A: avgMetrics.disk,               fullMark: 100 },
      { subject: 'Network', A: Math.min(100, avgMetrics.net), fullMark: 100 },
      { subject: 'Health',  A: total ? (healthy / total) * 100 : 100, fullMark: 100 },
    ];

    // Scatter: CPU vs RAM per instance
    const scatterData = fleet.map(n => ({
      x: n.metrics.cpu, y: n.metrics.ram,
      name: n.instance, status: n.status,
    }));

    return { total, anomalies, learning, healthy, avgMetrics, causeData, instanceBars, radarData, scatterData };
  }, [data, history, tick]);

  const CAUSE_COLORS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (!data) return (
    <div className="flex items-center justify-center h-screen bg-[#060d18]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin" />
          <Radio className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
        </div>
        <p className="text-cyan-400/70 font-mono text-sm tracking-widest uppercase">Connecting to Neural Engine</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060d18] text-slate-100 font-mono p-5 space-y-5"
         style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Fleet Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {stats.total} nodes · last update {data.timestamp ? new Date(data.timestamp * 1000).toLocaleTimeString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/history" className="text-xs text-cyan-400 border border-cyan-900 px-3 py-1.5 rounded hover:bg-cyan-900/20 transition flex items-center gap-1">
            <Clock className="w-3 h-3" /> History
          </Link>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${isConnected ? 'border-emerald-800 text-emerald-400' : 'border-amber-800 text-amber-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {isConnected ? 'LIVE' : 'POLLING'}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Nodes',   value: stats.total,    icon: Server,        color: '#22d3ee', sub: `${stats.healthy} healthy` },
          { label: 'Anomalies',     value: stats.anomalies, icon: AlertOctagon,  color: '#ef4444', sub: stats.anomalies > 0 ? 'CRITICAL' : 'None' },
          { label: 'Health Score',  value: `${Math.round(stats.total ? (stats.healthy / stats.total) * 100 : 100)}%`, icon: ShieldCheck, color: '#10b981', sub: `${stats.learning} learning` },
          { label: 'Avg CPU Load',  value: `${fmt(stats.avgMetrics.cpu)}%`, icon: Cpu,  color: metricColor(stats.avgMetrics.cpu), sub: `RAM ${fmt(stats.avgMetrics.ram)}%` },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-[#0d1929] border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold text-white leading-tight">{value}</p>
              <p className="text-xs mt-0.5" style={{ color }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Fleet Timeline (wide) + Radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Visual 1 — Fleet Avg Timeline Area Chart */}
        <div className="lg:col-span-2 bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Fleet Avg · Real-time
            </span>
            <span className="text-[10px] text-slate-600">{fleetTimeline.length} samples</span>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fleetTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {[['cpu','#22d3ee'],['ram','#8b5cf6'],['disk','#f59e0b']].map(([k,c])=>(
                    <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" vertical={false}/>
                <XAxis dataKey="t" tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false}/>
                <YAxis domain={[0,100]} tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false}/>
                <Tooltip content={<DarkTooltip />}/>
                <Area type="monotone" dataKey="cpu"  name="CPU"  stroke="#22d3ee" fill="url(#grad-cpu)"  strokeWidth={2} dot={false}/>
                <Area type="monotone" dataKey="ram"  name="RAM"  stroke="#8b5cf6" fill="url(#grad-ram)"  strokeWidth={2} dot={false}/>
                <Area type="monotone" dataKey="disk" name="Disk" stroke="#f59e0b" fill="url(#grad-disk)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-3 flex gap-5 text-[10px] text-slate-500">
            {[['CPU','#22d3ee'],['RAM','#8b5cf6'],['Disk','#f59e0b']].map(([l,c])=>(
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{background:c}}/>
                {l} %
              </span>
            ))}
          </div>
        </div>

        {/* Visual 2 — System Health Radar */}
        <div className="bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Health Radar
            </span>
          </div>
          <div className="p-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={stats.radarData}>
                <PolarGrid stroke="#1e2d40"/>
                <PolarAngleAxis dataKey="subject" tick={{ fill:'#64748b', fontSize:11, fontFamily:'monospace' }}/>
                <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/>
                <Radar name="Fleet" dataKey="A" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 2: Per-Instance Metrics Bar + Cause Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Visual 3 — Per-Instance grouped bar */}
        <div className="lg:col-span-2 bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-cyan-400" /> Per-Instance Metrics
            </span>
          </div>
          <div className="p-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.instanceBars} margin={{ top:4, right:4, left:-20, bottom:0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" vertical={false}/>
                <XAxis dataKey="name" tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false}/>
                <YAxis domain={[0,100]} tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false}/>
                <Tooltip content={<DarkTooltip />}/>
                <Bar dataKey="cpu"  name="CPU"  fill="#22d3ee" radius={[3,3,0,0]} maxBarSize={18}/>
                <Bar dataKey="ram"  name="RAM"  fill="#8b5cf6" radius={[3,3,0,0]} maxBarSize={18}/>
                <Bar dataKey="disk" name="Disk" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={18}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-3 flex gap-5 text-[10px] text-slate-500">
            {[['CPU','#22d3ee'],['RAM','#8b5cf6'],['Disk','#f59e0b']].map(([l,c])=>(
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{background:c}}/>{l} %
              </span>
            ))}
          </div>
        </div>

        {/* Visual 4 — Root Cause Pie */}
        <div className="bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Root Cause Dist.
            </span>
          </div>
          {stats.causeData.length > 0 ? (
            <div className="p-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.causeData} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
                       dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {stats.causeData.map((_, i) => (
                      <Cell key={i} fill={CAUSE_COLORS[i % CAUSE_COLORS.length]}/>
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="px-4 pb-2 flex flex-wrap gap-x-3 gap-y-1 justify-center text-[10px] text-slate-400">
                {stats.causeData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: CAUSE_COLORS[i % CAUSE_COLORS.length] }}/>
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-600 text-xs">
              No anomalies recorded yet
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: CPU vs RAM Scatter + Anomaly Line Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Visual 5 — CPU vs RAM Scatter */}
        <div className="bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> CPU vs RAM Scatter
            </span>
          </div>
          <div className="p-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top:4, right:10, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40"/>
                <XAxis dataKey="x" name="CPU" type="number" domain={[0,100]}
                  tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false} label={{ value:'CPU %', position:'insideBottom', offset:-2, fill:'#475569', fontSize:10 }}/>
                <YAxis dataKey="y" name="RAM" type="number" domain={[0,100]}
                  tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false} label={{ value:'RAM %', angle:-90, position:'insideLeft', fill:'#475569', fontSize:10 }}/>
                <Tooltip cursor={{ stroke:'#1e2d40' }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0d1929] border border-cyan-900/40 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
                      <p className="text-cyan-300 font-bold mb-1">{d.name}</p>
                      <p className="text-slate-300">CPU: {fmt(d.x)}%</p>
                      <p className="text-slate-300">RAM: {fmt(d.y)}%</p>
                      <p style={{ color: statusColor(d.status).dot }}>{d.status}</p>
                    </div>
                  );
                }}/>
                <Scatter name="Instances" data={stats.scatterData}>
                  {stats.scatterData.map((d, i) => (
                    <Cell key={i} fill={statusColor(d.status).dot} fillOpacity={0.85} stroke={statusColor(d.status).dot} strokeWidth={1}/>
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {/* Threshold lines annotation */}
          <div className="px-5 pb-3 flex gap-4 text-[10px] text-slate-500">
            {[['Healthy','#10b981'],['Anomalous','#ef4444'],['Learning','#f59e0b']].map(([l,c])=>(
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{background:c}}/>{l}
              </span>
            ))}
          </div>
        </div>

        {/* Visual 6 — Anomaly history line (cpu + ram from anomaly records) */}
        <div className="bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-red-400" /> Anomaly Metric Trace
            </span>
            <span className="text-[10px] text-slate-600">{history.length} events</span>
          </div>
          <div className="p-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.slice(0, 30).reverse()} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" vertical={false}/>
                <XAxis dataKey="timestamp" hide/>
                <YAxis domain={[0,100]} tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false}/>
                <Tooltip content={<DarkTooltip />}/>
                <Line type="stepAfter" dataKey="cpu_val" name="CPU" stroke="#22d3ee" strokeWidth={2} dot={false}/>
                <Line type="stepAfter" dataKey="ram_val" name="RAM" stroke="#8b5cf6" strokeWidth={2} dot={false}/>
                <Line type="stepAfter" dataKey="disk_val" name="Disk" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Fleet Node Cards — with per-node sparklines ── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400" /> Live Node Telemetry
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(data?.fleet ?? []).map((node) => {
            const sc = statusColor(node.status);
            const sp = sparklines[node.instance] ?? { cpu: [], ram: [], disk: [], net: [] };
            return (
              <div key={node.instance}
                   className="bg-[#0d1929] border border-slate-800 rounded-xl p-4 hover:border-cyan-900 transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                    <span className="text-sm font-bold text-white truncate">{node.instance}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}>
                    {node.status}
                  </span>
                </div>

                {/* Gauges row */}
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {[
                    { label: 'CPU',  value: node.metrics.cpu  },
                    { label: 'RAM',  value: node.metrics.ram  },
                    { label: 'Disk', value: node.metrics.disk },
                    { label: 'Net',  value: Math.min(100, node.metrics.network) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center">
                      <GaugeArc value={value} color={metricColor(value)} />
                      <span className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</span>
                    </div>
                  ))}
                </div>

                {/* CPU sparkline */}
                <div className="mb-2">
                  <div className="flex justify-between text-[9px] text-slate-600 mb-0.5">
                    <span>CPU TREND</span>
                    <span style={{ color: metricColor(node.metrics.cpu) }}>{fmt(node.metrics.cpu)}%</span>
                  </div>
                  <Sparkline data={sp.cpu} color={metricColor(node.metrics.cpu)} />
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-[9px] text-slate-600 mb-0.5">
                    <span>RAM TREND</span>
                    <span style={{ color: metricColor(node.metrics.ram) }}>{fmt(node.metrics.ram)}%</span>
                  </div>
                  <Sparkline data={sp.ram} color={metricColor(node.metrics.ram)} />
                </div>

                {/* Network + Disk pill */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-[#0a1525] rounded-lg p-2 text-center">
                    <p className="text-[9px] text-slate-600 uppercase">Network</p>
                    <p className="text-xs font-bold" style={{ color: metricColor(Math.min(100, node.metrics.network)) }}>
                      {fmtBytes(node.metrics.network)}
                    </p>
                  </div>
                  <div className="flex-1 bg-[#0a1525] rounded-lg p-2 text-center">
                    <p className="text-[9px] text-slate-600 uppercase">Disk</p>
                    <p className="text-xs font-bold" style={{ color: metricColor(node.metrics.disk) }}>
                      {fmt(node.metrics.disk)}%
                    </p>
                  </div>
                </div>

                {/* Root cause */}
                <div className="bg-[#0a1525] rounded-lg px-3 py-2">
                  <p className="text-[9px] text-slate-600 uppercase mb-0.5">Root Cause Analysis</p>
                  <p className={`text-xs ${node.status === 'Anomalous' ? 'text-red-400' : 'text-slate-400'} leading-relaxed`}>
                    {node.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Anomaly Event Log ── */}
      <div className="bg-[#0d1929] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-red-400" /> Anomaly Event Log
          </span>
          <Link href="/history" className="text-[10px] text-cyan-400 flex items-center gap-1 hover:underline">
            Full history <ArrowUpRight className="w-3 h-3"/>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {['Time','Instance','Trigger','Cause','CPU','RAM','Disk'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 12).map((ev, i) => (
                <tr key={ev.id ?? i}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {ev.timestamp ? relTime(ev.timestamp) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-cyan-300 font-bold whitespace-nowrap">{ev.instance}</td>
                  <td className="px-4 py-2.5">
                    <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[10px]">
                      {ev.trigger_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-red-400">{ev.cause}</td>
                  <td className="px-4 py-2.5" style={{ color: metricColor(ev.cpu_val) }}>{fmt(ev.cpu_val)}%</td>
                  <td className="px-4 py-2.5" style={{ color: metricColor(ev.ram_val) }}>{fmt(ev.ram_val)}%</td>
                  <td className="px-4 py-2.5" style={{ color: metricColor(ev.disk_val) }}>{fmt(ev.disk_val)}%</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-600">No anomaly events recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}