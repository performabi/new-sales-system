import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import PinPrompt from '../../components/Pos/PinPrompt';

export default function PosClock() {
  const { clockStatus, clockStatusLoading, fetchClockStatus, clockIn, clockOut } = useAppStore();
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [user, setUser] = useState<{ user_id: string; full_name: string } | null>(null);

  const storeId = sessionStorage.getItem('pos_store_id');
  const storeName = sessionStorage.getItem('pos_store_name') || 'Store';

  useEffect(() => {
    setShowPin(true);
  }, []);

  useEffect(() => {
    if (user?.user_id) {
      fetchClockStatus(user.user_id);
    }
  }, [user?.user_id, fetchClockStatus]);

  const openEntry = Array.isArray(clockStatus) ? clockStatus.find((e: any) => !e.clock_out) : null;
  const isClockedIn = !!openEntry;
  const todayEntries = Array.isArray(clockStatus) ? clockStatus : [];

  const handleClockIn = async () => {
    if (!storeId || !user?.user_id) return;
    setSubmitting(true);
    const { error } = await clockIn(storeId, user.user_id);
    setSubmitting(false);
    if (error) return;
    fetchClockStatus(user.user_id);
  };

  const handleClockOut = async () => {
    if (!user?.user_id) return;
    setSubmitting(true);
    const { error } = await clockOut(user.user_id);
    setSubmitting(false);
    if (error) return;
    fetchClockStatus(user.user_id);
  };

  const formatDuration = (start: string, end?: string) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = Math.floor((e - s) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Clock In / Out</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{storeName}</p>
      </div>

      {!user ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Enter your PIN to use the clock</p>
          <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <>
          <div className="card" style={{ textAlign: 'center', padding: '40px', marginBottom: '24px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{isClockedIn ? '⏰' : '🕐'}</div>
            <h3 style={{ marginBottom: '8px' }}>
              {isClockedIn ? 'You are clocked in' : 'You are clocked out'}
            </h3>
            {openEntry && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                Since {new Date(openEntry.clock_in).toLocaleTimeString('en-GB')} · {formatDuration(openEntry.clock_in)}
              </p>
            )}
            {user && <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>{user.full_name}</p>}
            <button
              className={`btn ${isClockedIn ? 'btn-danger' : 'btn-primary'}`}
              style={{ padding: '14px 48px', fontSize: '1.1rem', marginTop: '12px' }}
              onClick={isClockedIn ? handleClockOut : handleClockIn}
              disabled={submitting || clockStatusLoading}
            >
              {submitting ? 'Processing…' : isClockedIn ? 'Clock Out' : 'Clock In'}
            </button>
          </div>

          {todayEntries.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>Recent Activity</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Duration</th>
                    <th>Store</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {todayEntries.map((entry: any) => (
                    <tr key={entry.timesheet_id}>
                      <td>{new Date(entry.clock_in).toLocaleDateString('en-GB')}</td>
                      <td>{new Date(entry.clock_in).toLocaleTimeString('en-GB')}</td>
                      <td>{entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString('en-GB') : '—'}</td>
                      <td>{entry.clock_out ? formatDuration(entry.clock_in, entry.clock_out) : 'Active'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{storeName}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{user?.full_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <PinPrompt
        isOpen={showPin}
        onClose={() => { setShowPin(false); }}
        onSuccess={(u) => { setUser(u); setShowPin(false); }}
        title="Enter PIN to access Clock"
      />
    </div>
  );
}
