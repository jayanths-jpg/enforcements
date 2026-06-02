import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Shield, Database, RefreshCw } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Enforcements from './pages/Enforcements';
import Scraper from './pages/Scraper';

function Nav() {
  const link = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;
  return (
    <nav className="bg-white border-b border-gray-200 px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1 h-14">
        <div className="flex items-center gap-2 mr-6">
          <Shield size={18} className="text-gray-800" />
          <span className="font-semibold text-gray-900 text-sm">Fed Enforcement Monitor</span>
        </div>
        <NavLink to="/" end className={link}>Dashboard</NavLink>
        <NavLink to="/enforcements" className={link}>
          <Database size={14} /> Enforcements
        </NavLink>
        <NavLink to="/scraper" className={link}>
          <RefreshCw size={14} /> Run scraper
        </NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/enforcements" element={<Enforcements />} />
          <Route path="/scraper" element={<Scraper />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
