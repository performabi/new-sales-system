// src/pages/Dashboard.tsx
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import StatsCard from '../../components/UI/StatsCard';

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { stores, users, inventory, logEntries, fetchStores, fetchUsers, fetchInventory, fetchLogbook } = useAppStore();

  useEffect(() => {
    fetchStores();
    fetchUsers();
    fetchInventory();
    fetchLogbook();
  }, [fetchStores, fetchUsers, fetchInventory, fetchLogbook]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Welcome back, {profile?.full_name}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="Total Stores"
          value={stores.length}
          icon="🏪"
          variant="primary"
        />
        <StatsCard
          title="Total Users"
          value={users.length}
          icon="👥"
          variant="secondary"
        />
        <StatsCard
          title="Inventory Items"
          value={inventory.length}
          icon="📦"
          variant="info"
        />
        <StatsCard
          title="System Status"
          value="Online"
          icon="✅"
          variant="success"
        />
      </div>

      <div className="card">
        <h3>Recent System Activity</h3>
        <div style={{ marginTop: '16px' }}>
          {logEntries.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p>Activity feed will appear here as users interact with the system.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {logEntries.slice(0, 5).map((log, i) => (
                <li key={`${log.id}-${i}`} style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, marginRight: '8px' }}>[{log.entity}]</span>
                    <span style={{ color: 'var(--text-medium)' }}>{log.entityLabel}</span>
                    <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
                    <span>{log.action === 'delete' ? log.newValue : log.action === 'create' ? `Created ${log.field}: ${log.newValue}` : `Changed ${log.field} from "${log.oldValue}" to "${log.newValue}"`}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    by {log.username} at {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

