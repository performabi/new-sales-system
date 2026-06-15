// src/components/Layout/AppLayout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppStore } from '../../store/appStore';
import ToastContainer from '../UI/ToastContainer';
import './AppLayout.css';

export default function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

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
