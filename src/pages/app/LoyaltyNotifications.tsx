import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import DataTable from '../../components/UI/DataTable';

export default function LoyaltyNotifications() {
  const { loyaltyNotifications, loyaltyNotificationsLoading, fetchLoyaltyNotifications, createNotification, sendNotification, stores, fetchStores } = useAppStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [storeId, setStoreId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLoyaltyNotifications();
    if (stores.length === 0) fetchStores();
  }, [fetchLoyaltyNotifications, fetchStores, stores.length]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    const { error, notification } = await createNotification({ title: title.trim(), body: body.trim(), store_id: storeId || undefined });
    if (!error && notification?.notification_id) {
      await sendNotification(notification.notification_id);
    }
    setSubmitting(false);
    if (error) return;
    setTitle('');
    setBody('');
    setStoreId('');
  };

  const handleSendDraft = async (id: string) => {
    setSendingId(id);
    await sendNotification(id);
    setSendingId(null);
  };

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'body', label: 'Message' },
    { key: 'store_name', label: 'Store' },
    { key: 'created_at', label: 'Created' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  const storeMap = new Map(stores.map((s) => [s.store_id, s.name]));

  const tableData = loyaltyNotifications.map((n: any) => ({
    ...n,
    store_name: n.store_id ? storeMap.get(n.store_id) || 'Specific Store' : 'All Stores',
    created_at: new Date(n.created_at).toLocaleString('en-GB'),
    status: n.sent_at ? <span className="badge badge-success">Sent</span> : <span className="badge badge-warning">Draft</span>,
    actions: n.sent_at ? (
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Delivered</span>
    ) : (
      <button
        className="btn btn-primary btn-sm"
        onClick={() => handleSendDraft(n.notification_id)}
        disabled={sendingId === n.notification_id}
      >
        {sendingId === n.notification_id ? 'Sending…' : 'Send Now'}
      </button>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Loyalty Notifications</h1>
        <p style={{ color: 'var(--text-muted)' }}>Send messages to customers — shown at the till when their loyalty card is scanned.</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Compose Notification</h3>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend Sale!" />
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. 20% off all items this Saturday!" rows={3} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Target Store</label>
          <select className="form-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">— All Stores —</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleSend} disabled={submitting || !title.trim() || !body.trim()}>
          {submitting ? 'Sending…' : 'Create & Send'}
        </button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <h3 style={{ padding: '16px 16px 0', marginBottom: '12px' }}>History</h3>
        {loyaltyNotificationsLoading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          <DataTable columns={columns} data={tableData} emptyMessage="No notifications sent yet." />
        )}
      </div>
    </div>
  );
}
