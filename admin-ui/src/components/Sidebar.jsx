import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, LogOut } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        AdminPanel
      </div>
      <div className="sidebar-nav">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link to="/users" className={`nav-link ${location.pathname.startsWith('/users') ? 'active' : ''}`}>
          <Users size={20} />
          Manage Users
        </Link>
        <Link to="#" className="nav-link">
          <Settings size={20} />
          Settings
        </Link>
      </div>
      <div style={{ padding: '16px' }}>
        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
