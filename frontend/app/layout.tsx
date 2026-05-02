import { LayoutDashboard, Server, AlertOctagon, History, Search, Bell, User, Menu } from 'lucide-react';
import './globals.css'; // Cette ligne est INDISPENSABLE
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold text-gray-800">AI Fleet Intelligence</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100 relative">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <User size={20} />
            </button>
          </div>
        </header>

        <div className="flex flex-1">
          {/* Sidebar */}
          <nav className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-blue-600">Aurora</h2>
            </div>
            <Link href="/" className="flex text-gray-800 items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
            <Link href="/instances" className="flex text-gray-800 items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
              <Server size={20} />
              Instances
            </Link>
            <Link href="/anomalies" className="flex text-gray-800 items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
              <AlertOctagon size={20} />
              Anomalies
            </Link>
            <div className="mt-auto p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
              <h3 className="font-semibold mb-2">Upgrade to Pro</h3>
              <p className="text-sm opacity-90 mb-3">Get more features and support</p>
              <button className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium">Learn More</button>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 p-6 bg-gray-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}