import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRoads } from '../context/RoadsContext';
import { useDatasets } from '../context/DatasetContext';
import {
  LayoutDashboard, Map, ListOrdered, History, LogOut, ChevronLeft, ChevronRight,
  Menu, Bell, Search, MapPin, Upload, Trash2, Database, ChevronDown, Users,
  Wifi, WifiOff, Plus
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

export default function Layout() {
  const { currentUser, isAdmin, isSuperAdmin, isRestrictedUser, logout, getRoleLabel } = useAuth();
  const { trash, serverOnline } = useRoads();
  const { datasets, activeDataset, activeDatasetId, switchDataset } = useDatasets();

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

  let navItems = [];

  if (isRestrictedUser) {
    navItems = [{ id: 'map', label: 'Map View', icon: Map, section: 'main' }];
  } else {
    navItems = [
      { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, section: 'main' },
      { id: 'map',       label: 'Map View',      icon: Map,             section: 'main' },
      { id: 'registry',  label: 'Road Registry', icon: ListOrdered,     section: 'main' },
      { id: 'history',   label: 'Audit Log',     icon: History,         section: 'main' },
    ];
    if (isSuperAdmin) navItems.push({ id: 'trash',  label: 'Trash',           icon: Trash2, badge: trash.length || null, section: 'manage' });
    if (isAdmin)      navItems.push({ id: 'upload', label: 'Upload Dataset',   icon: Upload,                              section: 'manage' });
    if (isSuperAdmin) navItems.push({ id: 'users',  label: 'User Management',  icon: Users,                               section: 'manage' });
  }

  const mainNav   = navItems.filter(i => i.section === 'main'   || !i.section);
  const manageNav = navItems.filter(i => i.section === 'manage');

  const renderContent = () => {
    if (isRestrictedUser) {
      return <MapView selectedRoadId={selectedRoadId} onSelectRoad={handleSelectRoad} />;
    }
    switch (activeView) {
      case 'dashboard': return <Dashboard onViewOnMap={handleViewOnMap} />;
      case 'map':       return <MapView selectedRoadId={selectedRoadId} onSelectRoad={handleSelectRoad} />;
      case 'registry':  return <RoadRegistry onSelectRoad={handleSelectRoad} onAddRoad={() => setShowAddModal(true)} onViewOnMap={handleViewOnMap} />;
      case 'history':   return <EditHistory />;
      case 'trash':     return isSuperAdmin ? <TrashView />      : <Dashboard onViewOnMap={handleViewOnMap} />;
      case 'upload':    return isAdmin      ? <DatasetUpload />  : <Dashboard onViewOnMap={handleViewOnMap} />;
      case 'users':     return isSuperAdmin ? <UserManagement /> : <Dashboard onViewOnMap={handleViewOnMap} />;
      default:          return <Dashboard onViewOnMap={handleViewOnMap} />;
    }
  };

  const roleLabel      = getRoleLabel(currentUser?.role);
  const roleClass      = currentUser?.role === 'superadmin' ? 'superadmin' : currentUser?.role === 'admin' ? 'admin' : 'user';
  const currentNavItem = navItems.find(n => n.id === activeView);

  const NavBtn = ({ item }) => (
    <button
      className={`pnav-item ${activeView === item.id ? 'active' : ''}`}
      onClick={() => { setActiveView(item.id); setShowMobileNav(false); }}
      title={sidebarCollapsed ? item.label : undefined}
    >
      <span className="pnav-icon"><item.icon size={18} /></span>
      {!sidebarCollapsed && <span className="pnav-label">{item.label}</span>}
      {item.badge && !sidebarCollapsed && <span className="pnav-badge">{item.badge}</span>}
      {item.badge && sidebarCollapsed  && <span className="pnav-badge-dot" />}
    </button>
  );

  return (
    <div className="app-layout">

      {/* ── Sidebar ── */}
      <aside className={`psidebar ${sidebarCollapsed ? 'collapsed' : ''} ${showMobileNav ? 'mobile-open' : ''}`}>

        {/* Brand */}
        <div className="psidebar-header">
          <div className="psidebar-brand">
            <div className="pbrand-icon"><MapPin size={20} /></div>
            {!sidebarCollapsed && (
              <div className="pbrand-text">
                <span className="pbrand-name">Smart Road</span>
                <span className="pbrand-sub">GIS Portal</span>
              </div>
            )}
          </div>
          <button
            className="psidebar-toggle"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Active dataset chip */}
        {!sidebarCollapsed && activeDataset && (
          <div className="psidebar-dataset">
            <Database size={12} />
            <span className="psidebar-ds-name">{activeDataset.name}</span>
            <span className="psidebar-ds-count">{activeDataset.roadCount}</span>
          </div>
        )}

        {/* Navigation */}
        <nav className="psidebar-nav">
          {!sidebarCollapsed && mainNav.length > 0 && (
            <span className="pnav-section-label">Navigation</span>
          )}
          {mainNav.map(item => <NavBtn key={item.id} item={item} />)}

          {manageNav.length > 0 && (
            <>
              {!sidebarCollapsed && <span className="pnav-section-label">Manage</span>}
              {manageNav.map(item => <NavBtn key={item.id} item={item} />)}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="psidebar-footer">
          {/* Server status pill */}
          <div className={`pserver-status ${serverOnline ? 'online' : 'offline'}`}>
            {serverOnline
              ? <Wifi size={sidebarCollapsed ? 14 : 12} />
              : <WifiOff size={sidebarCollapsed ? 14 : 12} />}
            {!sidebarCollapsed && <span>{serverOnline ? 'Server Online' : 'Server Offline'}</span>}
          </div>

          {/* User card */}
          <div className={`psidebar-user ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="puser-avatar">
              {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="puser-info">
                <span className="puser-name">{currentUser?.fullName}</span>
                <span className={`puser-role ${roleClass}`}>{roleLabel}</span>
              </div>
            )}
            {!sidebarCollapsed && (
              <button className="plogout-btn" onClick={logout} title="Sign Out">
                <LogOut size={15} />
              </button>
            )}
          </div>

          {/* Collapsed logout */}
          {sidebarCollapsed && (
            <button
              className="pnav-item"
              onClick={logout}
              title="Sign Out"
              style={{ color: '#ef4444', marginTop: '4px' }}
            >
              <span className="pnav-icon"><LogOut size={18} /></span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {showMobileNav && (
        <div className="sidebar-overlay" onClick={() => setShowMobileNav(false)} />
      )}

      {/* ── Main content ── */}
      <main className="main-content">

        {/* Topbar */}
        <header className="ptopbar">
          <div className="ptopbar-left">
            <button className="pmobile-menu-btn" onClick={() => setShowMobileNav(v => !v)}>
              <Menu size={20} />
            </button>
            <div className="ptopbar-page">
              {currentNavItem && (
                <span className="ptopbar-page-icon">
                  <currentNavItem.icon size={16} />
                </span>
              )}
              <h1 className="ptopbar-title">
                {currentNavItem?.label || (isRestrictedUser ? 'Map View' : 'Dashboard')}
              </h1>
            </div>
          </div>

          <div className="ptopbar-right">

            {/* Dataset selector */}
            <div className="pdataset-wrapper">
              <button
                className="pdataset-btn"
                onClick={() => setShowDatasetPicker(v => !v)}
                title="Switch dataset"
              >
                <Database size={14} />
                <span className="pdataset-name">{activeDataset?.name || 'No Dataset'}</span>
                <ChevronDown size={13} className={showDatasetPicker ? 'rotate-180' : ''} />
              </button>
              {showDatasetPicker && (
                <>
                  <div className="dropdown-overlay" onClick={() => setShowDatasetPicker(false)} />
                  <div className="pdataset-dropdown animate-fade-in">
                    <div className="pdataset-dropdown-header">
                      <span>Select Dataset</span>
                      <span className="pdataset-count">{datasets.length} available</span>
                    </div>
                    <div className="pdataset-list">
                      {datasets.length === 0 ? (
                        <div className="pdataset-empty">No datasets available</div>
                      ) : (
                        datasets.map(ds => (
                          <button
                            key={ds.id}
                            className={`pdataset-item ${ds.id === activeDatasetId ? 'active' : ''}`}
                            onClick={() => { switchDataset(ds.id); setShowDatasetPicker(false); }}
                          >
                            <div
                              className="pdataset-item-dot"
                              style={{ background: ds.id === activeDatasetId ? 'var(--primary)' : 'var(--border)' }}
                            />
                            <div className="pdataset-item-info">
                              <span className="pdataset-item-name">{ds.name}</span>
                              <span className="pdataset-item-meta">
                                {ds.roadCount} roads · {ds.uploadedBy}
                                {ds.isDefault && ' · Default'}
                              </span>
                            </div>
                            {ds.id === activeDatasetId && <span className="pdataset-check">✓</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Search bar */}
            <div className="ptopbar-search">
              <Search size={14} />
              <input type="text" placeholder="Search roads..." readOnly />
            </div>

            {/* Add Road — admin+ on registry view */}
            {isAdmin && activeView === 'registry' && (
              <button
                className="ptopbar-add-btn"
                onClick={() => setShowAddModal(true)}
                title="Add new road"
              >
                <Plus size={15} />
                <span>Add Road</span>
              </button>
            )}

            {/* Notifications */}
            <button className="ptopbar-icon-btn" title="Notifications">
              <Bell size={17} />
              <span className="pnotif-dot" />
            </button>

            {/* User menu */}
            <div className="ptopbar-user-menu">
              <button className="ptopbar-avatar-btn" onClick={() => setShowUserMenu(v => !v)}>
                <div className="ptopbar-avatar">
                  {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="ptopbar-user-text">
                  <span className="ptopbar-user-name">{currentUser?.fullName}</span>
                  <span className={`ptopbar-role ${roleClass}`}>{roleLabel}</span>
                </div>
                <ChevronDown size={13} className={showUserMenu ? 'rotate-180' : ''} />
              </button>
              {showUserMenu && (
                <>
                  <div className="dropdown-overlay" onClick={() => setShowUserMenu(false)} />
                  <div className="puser-dropdown animate-fade-in">
                    <div className="puser-dropdown-header">
                      <div className="puser-dropdown-avatar">
                        {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="puser-dropdown-info">
                        <div className="puser-dropdown-name">{currentUser?.fullName}</div>
                        <div className="puser-dropdown-email">{currentUser?.email}</div>
                        <span className={`puser-dropdown-role ${roleClass}`}>{roleLabel}</span>
                      </div>
                    </div>
                    <div className="pdropdown-divider" />
                    <button className="pdropdown-item danger" onClick={logout}>
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* No dataset warning */}
        {!activeDatasetId && (
          <div className="pno-dataset-banner">
            <Database size={16} />
            <span>
              No dataset selected.{' '}
              {isSuperAdmin
                ? 'Upload a dataset to get started.'
                : 'Ask your Super Admin to upload a dataset.'}
            </span>
            {isAdmin && (
              <button className="btn-primary btn-sm" onClick={() => setActiveView('upload')}>
                <Upload size={13} /> Upload Dataset
              </button>
            )}
          </div>
        )}

        <div className="content-area">{renderContent()}</div>
      </main>

      {/* Road detail panel */}
      {selectedRoadId && (
        <RoadDetail roadId={selectedRoadId} onClose={handleCloseDetail} onSelectRoad={handleSelectRoad} />
      )}

      {/* Add road modal */}
      {showAddModal && (
        <AddRoadModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
