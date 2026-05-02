"use client";
import { useParams } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function InstanceDetail() {
  const { id } = useParams();
  // Ici, tu pourrais fetch des données spécifiques à cette instance via l'API

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Suivi : {id}</h1>
      <p className="text-slate-400 mb-8">Analyse en temps réel des performances individuelles.</p>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-96">
          <h3 className="mb-4 font-semibold">Historique de Charge CPU</h3>
          {/* Tu peux intégrer Recharts ici pour tracer les courbes */}
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Graphique de tendance en cours de chargement...
          </div>
        </div>
      </div>
    </div>
  );
}