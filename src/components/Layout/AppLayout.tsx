// src/components/Layout/AppLayout.tsx
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppStore } from '../../store/appStore';
import ToastContainer from '../UI/ToastContainer';
import './AppLayout.css';

export default function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const applyDueScheduledChanges = useAppStore((s) => s.applyDueScheduledChanges);

  useEffect(() => {
    document.title = 'Head Office';
    applyDueScheduledChanges();
    const interval = setInterval(applyDueScheduledChanges, 60_000);
    return () => clearInterval(interval);
  }, [applyDueScheduledChanges]);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
