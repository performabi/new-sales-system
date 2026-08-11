import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import DataTable from '../../components/UI/DataTable';
import Modal from '../../components/UI/Modal';

export default function LoyaltyCards() {
  const {
    loyaltyCards, loyaltyCardsLoading, fetchLoyaltyCards,
    createLoyaltyCard, updateLoyaltyCard, stores, fetchStores,
    currencyConfig, fetchCurrencyConfig, addToast,
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [postcode, setPostcode] = useState('');
  const [cashback, setCashback] = useState('0');
  const [preferredStoreId, setPreferredStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  useEffect(() => {
    fetchLoyaltyCards();
    if (stores.length === 0) fetchStores();
    if (!currencyConfig) fetchCurrencyConfig();
  }, [fetchLoyaltyCards, fetchStores, stores.length, currencyConfig, fetchCurrencyConfig]);

  const openCreate = () => {
    setEditingId(null);
    setCustomerName('');
    setPhone('');
    setEmail('');
    setPostcode('');
    setCashback('0');
    setPreferredStoreId('');
    setQrData(null);
    setShowModal(true);
  };

  const openEdit = (card: any) => {
    setEditingId(card.card_id);
    setCustomerName(card.customer_name);
    setPhone(card.phone || '');
    setEmail(card.email || '');
    setPostcode(card.postcode || '');
    setCashback(String(card.cashback_balance));
    setPreferredStoreId(card.store_id || '');
    setQrData(`loyalty:${card.card_number}`);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!customerName.trim()) return;
    const payload: any = {
      customer_name: customerName.trim(),
      phone,
      email,
      cashback_balance: parseFloat(cashback) || 0,
    };
    if (postcode) payload.postcode = postcode;
    if (preferredStoreId) payload.store_id = preferredStoreId;
    if (editingId) {
      await updateLoyaltyCard(editingId, payload);
    } else {
      const result = await createLoyaltyCard(payload);
      if (result?.card_number) {
        setQrData(`loyalty:${result.card_number}`);
      }
    }
    setShowModal(false);
    fetchLoyaltyCards();
  };

  const toggleActive = async (card: any) => {
    await updateLoyaltyCard(card.card_id, { is_active: !card.is_active });
    fetchLoyaltyCards();
  };

  const filtered = loyaltyCards.filter((c: any) =>
    !search || c.customer_name.toLowerCase().includes(search.toLowerCase()) || c.card_number.includes(search)
  );

  const storeMap = new Map(stores.map((s) => [s.store_id, s.name]));

  const registrationLink = (() => {
    const match = window.location.pathname.match(/^\/app\/([^/]+)/);
    return match ? `${window.location.origin}/loyalty/${match[1]}/register` : `${window.location.origin}/loyalty/register`;
  })();

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationLink);
      setShareLinkCopied(true);
      addToast('success', 'Registration link copied!');
      setTimeout(() => setShareLinkCopied(false), 3000);
    } catch (err) {
      console.error('copy failed:', err);
      addToast('error', 'Could not copy link');
    }
  };

  const columns = [
    { key: 'card_number', label: 'Card #' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'store_name', label: 'Preferred Store' },
    { key: 'cashback_balance', label: 'Cashback' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  const currencySymbol = currencyConfig?.symbol || '£';

  const tableData = filtered.map((c: any) => ({
    ...c,
    store_name: c.store_id ? storeMap.get(c.store_id) || '—' : '—',
    cashback_balance: `${currencySymbol}${Number(c.cashback_balance).toFixed(2)}`,
    status: <span className={`badge ${c.is_active ? 'badge-success' : 'badge-error'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>,
    actions: (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>
        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>
          {c.is_active ? '🔴' : '🟢'}
        </button>
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Loyalty Cards</h1>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" style={{ maxWidth: '300px' }} placeholder="Search by name or card number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={openCreate}>+ New Card</button>
          <button className="btn btn-accent-outline" onClick={shareLink}>
            🔗 Share Registration Link
          </button>
          {shareLinkCopied && (
            <span className="copy-chip" onClick={shareLink} title="Click to copy again">
              {registrationLink}
            </span>
          )}
        </div>
      </div>

      {loyaltyCardsLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No loyalty cards found." />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Loyalty Card' : 'New Loyalty Card'}>
        <div className="form-group">
          <label className="form-label">Customer Name</label>
          <input className="form-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Postcode</label>
          <input className="form-input" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Preferred Store</label>
          <select className="form-input" value={preferredStoreId} onChange={(e) => setPreferredStoreId(e.target.value)}>
            <option value="">— None —</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Cashback Balance</label>
          <input className="form-input" type="number" step="0.01" value={cashback} onChange={(e) => setCashback(e.target.value)} />
        </div>
        {qrData && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>QR Code Data: <code>{qrData}</code></p>
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!customerName.trim()}>
            {editingId ? 'Update' : 'Create'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
