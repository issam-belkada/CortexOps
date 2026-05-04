import { LayoutDashboard, Server, AlertOctagon } from 'lucide-react';
import './globals.css'; // Cette ligne est INDISPENSABLE
import Link from 'next/link';
import { WebSocketProvider } from './lib/websocket-context';
import Header from './components/Header';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="bg-slate-950 text-slate-100 flex flex-col min-h-screen">
        <WebSocketProvider>
        <Header />

        <div className="flex flex-1">
          {/* Sidebar */}
          <nav className="w-72 bg-slate-950 border-r border-slate-800 p-6 flex flex-col gap-4">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-cyan-400">Aurora</h2>
              <p className="mt-1 text-sm text-slate-400">Fleet intelligence dashboard</p>
            </div>
            <Link href="/" className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-slate-100 rounded-2xl shadow-sm border border-slate-800 hover:bg-slate-800 transition">
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
            <Link href="/instances" className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-slate-100 rounded-2xl shadow-sm border border-slate-800 hover:bg-slate-800 transition">
              <Server size={20} />
              Instances
            </Link>
            <Link href="/anomalies" className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-slate-100 rounded-2xl shadow-sm border border-slate-800 hover:bg-red-600 hover:text-white transition">
              <AlertOctagon size={20} />
              Anomalies
            </Link>
            <div className="mt-auto p-5 bg-linear-to-br from-cyan-500 via-blue-600 to-indigo-700 rounded-3xl text-white shadow-xl">
              <h3 className="font-semibold mb-2">Upgrade to Pro</h3>
              <p className="text-sm opacity-90 mb-4">Unlock deeper analytics and anomaly prediction.</p>
              <button className="bg-white text-slate-950 px-4 py-2 rounded-full text-sm font-semibold hover:bg-slate-100 transition">Learn More</button>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 p-6 bg-slate-900">
            {children}
          </main>
        </div>
        </WebSocketProvider>
      </body>
    </html>
  );
}