import { LayoutDashboard, Server, AlertOctagon, History } from 'lucide-react';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-slate-900 text-white flex">
        <nav className="w-64 h-screen bg-slate-800 border-r border-slate-700 p-6 flex flex-col gap-4">
          <h2 className="text-xl font-bold mb-8 text-blue-400">AI Monitor</h2>
          <Link href="/" className="flex items-center gap-3 hover:text-blue-400 transition"><LayoutDashboard size={20}/> Dashboard</Link>
          <Link href="/instances" className="flex items-center gap-3 hover:text-blue-400 transition"><Server size={20}/> Instances</Link>
          <Link href="/anomalies" className="flex items-center gap-3 hover:text-blue-400 transition"><AlertOctagon size={20}/> Anomalies</Link>
        </nav>
        <main className="flex-1 h-screen overflow-auto p-8">
          {children}
        </main>
      </body>
    </html>
  );
}