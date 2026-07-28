import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

interface TillNotificationBarProps {
  storeId: string | null;
}

export default function TillNotificationBar({ storeId }: TillNotificationBarProps) {
  const unseenNotifications = useAppStore((s) => s.unseenNotifications);
  const fetchUnseenNotifications = useAppStore((s) => s.fetchUnseenNotifications);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (storeId) {
      fetchUnseenNotifications(storeId);
    }
  }, [storeId, fetchUnseenNotifications]);

  const visible = unseenNotifications.filter((n) => !dismissed.has(n.notification_id));

  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 16px', flexShrink: 0 }}>
      {visible.map((n) => (
        <div
          key={n.notification_id}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(103,255,166,0.12)', border: '1px solid rgba(103,255,166,0.3)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{n.title}</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>{n.body}</div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: '0.75rem', flexShrink: 0 }}
            onClick={() => setDismissed((prev) => new Set(prev).add(n.notification_id))}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
