import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRoads } from '../context/RoadsContext';
import { useDatasets } from '../context/DatasetContext';
import {
  LayoutDashboard, Map, ListOrdered, History, LogOut, ChevronLeft, ChevronRight,
  Menu, Bell, Search, MapPin, Upload, Trash2, Database, ChevronDown, Users
} from 'lucide-react';
import Dashboard from './Dashboard';
import MapView from './MapView';
import RoadRegistry from './RoadRegistry';
import RoadDetail from './RoadDetail';
import EditHistory from './EditHistory';
import AddRoadModal from './AddRoadModal';
import DatasetUpload from './DatasetUpload';
import TrashView from './TrashView';
import UserManagement from './UserManagement';

// ─── Role-based access matrix ───────────────────────────────────────────────
// superadmin : Dashboard, Map, Registry, Audit Log, Trash, Upload, User Mgmt
// admin      : Dashboard, Map, Registry, Audit Log, Upload   (NO Trash)
// user       : Road Registry ONLY  (superadmin controls via User Management)
// ─────────────────────────────────────────────────────────────────────────────

export default function Layout() {
  const { currentUser, isAdmin, isSuperAdmin, isRestrictedUser, logout, getRoleLabel } = useAuth();
  const { trash, serverOnline } = useRoads();
  const { datasets, activeDataset, activeDatasetId, switchDataset } = useDatasets();

  // 'user' (restricted) starts at map-only view
  const [activeView, setActiveView] = useState(isRestrictedUser ? 'map' : 'dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRoadId, setSelectedRoadId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);

  const handleSelectRoad = (roadId) => { setSelectedRoadId(roadId); };
  const handleCloseDetail = () => { setSelectedRoadId(null); };
  const handleViewOnMap = (roadId) => { setSelectedRoadId(roadId); setActiveView('map'); };

  // ─── Build nav per role ───
  let navItems = [];

  if (isRestrictedUser) {
    // 'user' role: Map View only — read-only, no attribute table, no editing
    navItems = [
      { id: 'map', label: 'Map View', icon: Map },
    ];
  } else {
    // admin & superadmin share base nav
    navItems = [
      { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard },
      { id: 'map',       label: 'Map View',      icon: Map },
      { id: 'registry',  label: 'Road Registry', icon: ListOrdered },
      { id: 'history',   label: 'Audit Log',     icon: History },
    ];

    // Trash — SuperAdmin only
    if (isSuperAdmin) {
      navItems.push({ id: 'trash', label: 'Trash', icon: Trash2, badge: trash.length || null });
    }

    // Upload Dataset — admin & superadmin
    if (isAdmin) {
      navItems.push({ id: 'upload', label: 'Upload Dataset', icon: Upload });
    }

    // User Management — SuperAdmin only
    if (isSuperAdmin) {
      navItems.push({ id: 'users', label: 'User Management', icon: Users });
    }
  }

  // ─── Render content per role ───
  const renderContent = () => {
    // 'user' role is strictly locked to Map View — no registry, no editing, no detail panel
    if (isRestrictedUser) {
      return (
        <MapView
          selectedRoadId={selectedRoadId}
          onSelectRoad={handleSelectRoad}
        />
      );
    }

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
      case 'trash':
        // Trash is gated to superadmin only
        return isSuperAdmin ? <TrashView /> : <Dashboard onViewOnMap={handleViewOnMap} />;
      case 'upload':
        return isAdmin ? <DatasetUpload /> : <Dashboard onViewOnMap={handleViewOnMap} />;
      case 'users':
        return isSuperAdmin ? <UserManagement /> : <Dashboard onViewOnMap={handleViewOnMap} />;
      default:
        return <Dashboard onViewOnMap={handleViewOnMap} />;
    }
  };

  const roleLabel = getRoleLabel(currentUser?.role);
  const roleClass =
    currentUser?.role === 'superadmin' ? 'superadmin' :
    currentUser?.role === 'admin'      ? 'admin' : 'user';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${showMobileNav ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon"><MapPin size={22} /></div>
            {!sidebarCollapsed && (
              <div className="brand-text">
                <span className="brand-name">Road QGIS</span>
                <span className="brand-sub">Portal</span>
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
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => { setActiveView(item.id); setShowMobileNav(false); }}
              title={item.label}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {item.badge && !sidebarCollapsed && <span className="nav-badge">{item.badge}</span>}
              {item.badge && sidebarCollapsed && <span className="nav-badge-dot" />}
              {activeView === item.id && <div className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!sidebarCollapsed && (
            <div className={`server-status ${serverOnline ? 'online' : 'offline'}`}>
              <span className="server-dot" />
              <span>{serverOnline ? 'Server Connected' : 'Server Offline'}</span>
            </div>
          )}
          <div className={`sidebar-user ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="user-avatar">
              {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">{currentUser?.fullName}</span>
                <span className={`user-role ${roleClass}`}>{roleLabel}</span>
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
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setShowMobileNav(v => !v)}>
              <Menu size={20} />
            </button>
            <h1 className="topbar-title">
              {navItems.find(n => n.id === activeView)?.label || (isRestrictedUser ? 'Road Registry' : 'Dashboard')}
            </h1>
          </div>
          <div className="topbar-right">
            {/* Dataset Selector */}
            {true && (
              <div className="dataset-selector-wrapper">
                <button
                  className="dataset-selector-btn"
                  onClick={() => setShowDatasetPicker(v => !v)}
                  title="Switch Dataset"
                >
                  <Database size={15} />
                  <span className="dataset-selector-name">
                    {activeDataset?.name || 'No Dataset'}
                  </span>
                  <ChevronDown size={14} className={showDatasetPicker ? 'rotate-180' : ''} />
                </button>
                {showDatasetPicker && (
                  <>
                    <div className="dropdown-overlay" onClick={() => setShowDatasetPicker(false)} />
                    <div className="dataset-dropdown animate-fade-in">
                      <div className="dataset-dropdown-header">
                        <span className="dataset-dropdown-title">Select Dataset</span>
                        <span className="dataset-dropdown-count">{datasets.length} available</span>
                      </div>
                      <div className="dataset-dropdown-list">
                        {datasets.length === 0 ? (
                          <div className="dataset-dropdown-empty">
                            No datasets available. Upload a dataset first.
                          </div>
                        ) : (
                          datasets.map(ds => (
                            <button
                              key={ds.id}
                              className={`dataset-dropdown-item ${ds.id === activeDatasetId ? 'active' : ''}`}
                              onClick={() => { switchDataset(ds.id); setShowDatasetPicker(false); }}
                            >
                              <div className="dataset-item-info">
                                <span className="dataset-item-name">{ds.name}</span>
                                <span className="dataset-item-meta">
                                  {ds.roadCount} roads · by {ds.uploadedBy}
                                  {ds.isDefault && ' · Default'}
                                </span>
                              </div>
                              {ds.id === activeDatasetId && <span className="dataset-item-active">✓</span>}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

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
                      <span className={`dropdown-role ${roleClass}`}>{roleLabel}</span>
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

        {/* No dataset warning */}
        {!activeDatasetId && (
          <div className="no-dataset-banner">
            <Database size={18} />
            <span>
              No dataset selected.{' '}
              {isSuperAdmin ? 'Upload a dataset to get started.' : 'Ask your Super Admin to upload a dataset.'}
            </span>
            {isAdmin && (
              <button className="btn-primary btn-sm" onClick={() => setActiveView('upload')}>
                <Upload size={14} /> Upload Dataset
              </button>
            )}
          </div>
        )}

        <div className="content-area">{renderContent()}</div>
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
