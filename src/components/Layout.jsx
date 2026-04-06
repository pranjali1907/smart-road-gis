import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Map, ListOrdered, History, LogOut, ChevronLeft, ChevronRight,
  Menu, Bell, Search, User, MapPin, Settings
} from 'lucide-react';
import Dashboard from './Dashboard';
import MapView from './MapView';
import RoadRegistry from './RoadRegistry';
import RoadDetail from './RoadDetail';
import EditHistory from './EditHistory';
import AddRoadModal from './AddRoadModal';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Map View', icon: Map },
  { id: 'registry', label: 'Road Registry', icon: ListOrdered },
  { id: 'history', label: 'Edit History', icon: History },
];

export default function Layout() {
  const { currentUser, isAdmin, logout } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRoadId, setSelectedRoadId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSelectRoad = (roadId) => {
    setSelectedRoadId(roadId);
  };

  const handleCloseDetail = () => {
    setSelectedRoadId(null);
  };

  const handleViewOnMap = (roadId) => {
    setSelectedRoadId(roadId);
    setActiveView('map');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onViewOnMap={handleViewOnMap} />;
      case 'map':
        return (
          <MapView
            selectedRoadId={selectedRoadId}
            onSelectRoad={handleSelectRoad}
          />
        );
      case 'registry':
        return (
          <RoadRegistry
            onSelectRoad={handleSelectRoad}
            onAddRoad={() => setShowAddModal(true)}
            onViewOnMap={handleViewOnMap}
          />
        );
      case 'history':
        return <EditHistory />;
      default:
        return <Dashboard onViewOnMap={handleViewOnMap} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${showMobileNav ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <MapPin size={22} />
            </div>
            {!sidebarCollapsed && (
              <div className="brand-text">
                <span className="brand-name">Sangli Roads</span>
                <span className="brand-sub">GIS Portal</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => { setActiveView(item.id); setShowMobileNav(false); }}
              title={item.label}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {activeView === item.id && <div className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`sidebar-user ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="user-avatar">
              {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">{currentUser?.fullName}</span>
                <span className={`user-role ${isAdmin ? 'admin' : 'viewer'}`}>
                  {isAdmin ? 'Administrator' : 'Viewer'}
                </span>
              </div>
            )}
          </div>
          <button className="nav-item logout-btn" onClick={logout} title="Sign Out">
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {showMobileNav && (
        <div className="sidebar-overlay" onClick={() => setShowMobileNav(false)} />
      )}

      {/* Main content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setShowMobileNav(v => !v)}>
              <Menu size={20} />
            </button>
            <h1 className="topbar-title">
              {NAV_ITEMS.find(n => n.id === activeView)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <Search size={16} />
              <input type="text" placeholder="Search roads..." readOnly />
            </div>
            <button className="topbar-icon-btn" title="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <div className="topbar-user-menu">
              <button className="topbar-user-btn" onClick={() => setShowUserMenu(v => !v)}>
                <div className="topbar-avatar">
                  {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
                </div>
              </button>
              {showUserMenu && (
                <>
                  <div className="dropdown-overlay" onClick={() => setShowUserMenu(false)} />
                  <div className="user-dropdown animate-fade-in">
                    <div className="dropdown-header">
                      <span className="dropdown-name">{currentUser?.fullName}</span>
                      <span className="dropdown-email">{currentUser?.email}</span>
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" onClick={logout}>
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="content-area">
          {renderContent()}
        </div>
      </main>

      {/* Road detail panel */}
      {selectedRoadId && (
        <RoadDetail roadId={selectedRoadId} onClose={handleCloseDetail} />
      )}

      {/* Add road modal */}
      {showAddModal && (
        <AddRoadModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
