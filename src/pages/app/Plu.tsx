// src/pages/Plu.tsx
import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Plu, VatClass } from '../../types';
import DataTable from '../../components/UI/DataTable';
import Modal from '../../components/UI/Modal';
import { formatCurrency, getCurrencySymbol } from '../../lib/formatCurrency';

const VAT_OPTIONS: { value: VatClass; label: string }[] = [
  { value: 'standard',  label: 'Standard (20%)' },
  { value: 'zero_rated', label: 'Zero-Rated (0%)' },
  { value: 'exempt',    label: 'Exempt (No VAT)' },
];

const VAT_BADGE: Record<VatClass, string> = {
  standard:  'badge-primary',
  zero_rated: 'badge-success',
  exempt:    'badge-secondary',
};

const VAT_LABEL: Record<VatClass, string> = {
  standard:  '20%',
  zero_rated: '0%',
  exempt:    'No VAT',
};

const STORE_KEYS = [
  'store_001','store_002','store_003','store_004','store_005',
  'store_006','store_007','store_008','store_009',
] as const;

type StoreKey = typeof STORE_KEYS[number];

// Build an empty PLU form payload
function emptyForm() {
  return {
    plu_number: '',
    name: '',
    category_id: null as string | null,
    vat_class: 'standard' as VatClass,
    uses_scale: false,
    ean: '',
    headoffice_price: '' as string,
    store_001: '' as string, store_002: '' as string, store_003: '' as string,
    store_004: '' as string, store_005: '' as string, store_006: '' as string,
    store_007: '' as string, store_008: '' as string, store_009: '' as string,
  };
}

export default function PluPage() {
  const {
    plusItems, plusLoading, fetchPlus, addPlu, updatePlu, deletePlu, getNextPluNumber,
    pluCategories, fetchPluCategories,
    stores, fetchStores,
  } = useAppStore();

  // Filters
  const [selectedStore, setSelectedStore] = useState<'head_office' | string>('head_office');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlus();
    fetchPluCategories();
    fetchStores();
  }, [fetchPlus, fetchPluCategories, fetchStores]);

  // Stores sorted by store_number (head office always first in dropdown)
  const storesWithNumber = useMemo(
    () => [...stores].sort((a, b) => (a.store_number ?? '').localeCompare(b.store_number ?? '')),
    [stores]
  );

  // Get the column key for the currently selected store
  const storeColKey = useMemo((): StoreKey | null => {
    if (selectedStore === 'head_office') return null;
    const store = storesWithNumber.find((s) => s.store_id === selectedStore);
    if (!store?.store_number) return null;
    return `store_${store.store_number}` as StoreKey;
  }, [selectedStore, storesWithNumber]);

  // Filtered + searched PLUs
  const filtered = useMemo(() => {
    let items = plusItems;
    if (selectedCategory !== 'all') {
      items = items.filter((p) => p.category_id === selectedCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) =>
        p.plu_number.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    return items;
  }, [plusItems, selectedCategory, search]);

  // Effective price for the selected store (for display)
  const effectivePrice = (plu: Plu): string => {
    if (!storeColKey) {
      return plu.headoffice_price != null ? formatCurrency(plu.headoffice_price) : '—';
    }
    const storePrice = plu[storeColKey];
    if (storePrice != null) return formatCurrency(storePrice);
    return plu.headoffice_price != null ? `${formatCurrency(plu.headoffice_price)} (HO)` : '—';
  };

  const openCreateModal = async () => {
    setIsEditMode(false);
    setEditingId(null);
    const nextNum = await getNextPluNumber();
    setForm({ ...emptyForm(), plu_number: nextNum });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (plu: Plu) => {
    setIsEditMode(true);
    setEditingId(plu.plu_id);
    setForm({
      plu_number: plu.plu_number,
      name: plu.name,
      category_id: plu.category_id,
      vat_class: plu.vat_class,
      uses_scale: plu.uses_scale,
      ean: plu.ean ?? '',
      headoffice_price: plu.headoffice_price != null ? String(plu.headoffice_price) : '',
      store_001: plu.store_001 != null ? String(plu.store_001) : '',
      store_002: plu.store_002 != null ? String(plu.store_002) : '',
      store_003: plu.store_003 != null ? String(plu.store_003) : '',
      store_004: plu.store_004 != null ? String(plu.store_004) : '',
      store_005: plu.store_005 != null ? String(plu.store_005) : '',
      store_006: plu.store_006 != null ? String(plu.store_006) : '',
      store_007: plu.store_007 != null ? String(plu.store_007) : '',
      store_008: plu.store_008 != null ? String(plu.store_008) : '',
      store_009: plu.store_009 != null ? String(plu.store_009) : '',
    });
    setError(null);
    setIsModalOpen(true);
  };



  const closeModal = () => { 
    setIsModalOpen(false); 
    setEditingId(null); 
  };

  const toNullableDecimal = (v: string) => v === '' ? null : parseFloat(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      plu_number: form.plu_number.trim(),
      name: form.name.trim(),
      category_id: form.category_id || null,
      vat_class: form.vat_class,
      uses_scale: form.uses_scale,
      ean: form.ean.trim() || null,
      headoffice_price: toNullableDecimal(form.headoffice_price),
      store_001: toNullableDecimal(form.store_001),
      store_002: toNullableDecimal(form.store_002),
      store_003: toNullableDecimal(form.store_003),
      store_004: toNullableDecimal(form.store_004),
      store_005: toNullableDecimal(form.store_005),
      store_006: toNullableDecimal(form.store_006),
      store_007: toNullableDecimal(form.store_007),
      store_008: toNullableDecimal(form.store_008),
      store_009: toNullableDecimal(form.store_009),
    };

    let res: { error: string | null };
    if (isEditMode && editingId) {
      res = await updatePlu(editingId, payload);
    } else {
      res = await addPlu(payload);
    }

    setIsSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      closeModal();
    }
  };

  const handleDelete = async (plu: Plu) => {
    if (!confirm(`Delete PLU "${plu.plu_number} — ${plu.name}"?`)) return;
    await deletePlu(plu.plu_id);
  };

  const columns = [
    { key: 'plu_number', label: 'PLU #' },
    { key: 'name', label: 'Name' },
    { key: 'category_name_cell', label: 'Category' },
    { key: 'vat_badge', label: 'VAT' },
    { key: 'scale_cell', label: 'Scale' },
    { key: 'ean_cell', label: 'EAN' },
    { key: 'price_cell', label: selectedStore === 'head_office' ? 'HO Price' : 'Price' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = filtered.map((plu) => ({
    ...plu,
    category_name_cell: plu.category_name
      ? <span className="badge badge-info">{plu.category_name}</span>
      : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>,
    vat_badge: (
      <span className={`badge ${VAT_BADGE[plu.vat_class]}`}>{VAT_LABEL[plu.vat_class]}</span>
    ),
    scale_cell: plu.uses_scale
      ? <span title="Sold by weight" style={{ fontSize: '1.1rem' }}>⚖️</span>
      : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    ean_cell: plu.ean
      ? <code style={{ fontSize: '0.78rem', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>{plu.ean}</code>
      : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    price_cell: (
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{effectivePrice(plu)}</span>
    ),
    actions: (
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEditModal(plu); }}>
          Edit
        </button>
        <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(plu); }}>
          Delete
        </button>
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>PLU Registration &amp; Pricing</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add PLU
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        {/* Store filter */}
        <div className="filter-group">
          <label className="filter-label">Store</label>
          <select
            id="plu-store-filter"
            className="form-select"
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="head_office">Head Office</option>
            {storesWithNumber
              .filter((s) => s.is_active !== false)
              .map((s) => (
                <option key={s.store_id} value={s.store_id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="filter-group">
          <label className="filter-label">Category</label>
          <select
            id="plu-category-filter"
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {pluCategories.map((c) => (
              <option key={c.category_id} value={c.category_id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="filter-group filter-search">
          <label className="filter-label">Search</label>
          <input
            id="plu-search"
            type="text"
            className="form-input"
            placeholder="Search by PLU # or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {plusLoading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No PLUs found." />
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditMode ? `Edit PLU ${form.plu_number}` : 'Register New PLU'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* PLU Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="plu-number">
              PLU Number <span style={{ color: 'var(--text-muted)', textTransform: 'none', fontSize: '0.75rem' }}>(system-suggested, editable)</span>
            </label>
            <input
              id="plu-number"
              type="text"
              className="form-input"
              value={form.plu_number}
              onChange={(e) => setForm((f) => ({ ...f, plu_number: e.target.value }))}
              required
            />
          </div>

          {/* Product Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="plu-name">Product Name</label>
            <input
              id="plu-name"
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label" htmlFor="plu-category">Category</label>
            <select
              id="plu-category"
              className="form-select"
              value={form.category_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}
            >
              <option value="">— No Category —</option>
              {pluCategories.map((c) => (
                <option key={c.category_id} value={c.category_id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* VAT Classification */}
          <div className="form-group">
            <label className="form-label" htmlFor="plu-vat">VAT Classification</label>
            <select
              id="plu-vat"
              className="form-select"
              value={form.vat_class}
              onChange={(e) => setForm((f) => ({ ...f, vat_class: e.target.value as VatClass }))}
            >
              {VAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* EAN / Barcode */}
          <div className="form-group">
            <label className="form-label" htmlFor="plu-ean">EAN / Barcode</label>
            <input
              id="plu-ean"
              type="text"
              className="form-input"
              value={form.ean}
              onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))}
              placeholder="e.g. 5012345678900"
            />
          </div>

          {/* Scale checkbox */}
          <div className="form-group" style={{ margin: '4px 0' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.uses_scale}
                onChange={(e) => setForm((f) => ({ ...f, uses_scale: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>Scale Item (sold in kilos)</span>
            </label>
          </div>

          {/* ── Pricing Section ── */}
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
            {/* Global Price */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <label className="form-label" htmlFor="plu-ho-price" style={{ margin: 0, fontWeight: 600 }}>
                  Global Price ({getCurrencySymbol()})
                </label>
                {/* Question mark trigger for info balloon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const balloon = document.getElementById('price-info-balloon');
                    if (balloon) {
                      balloon.style.display = balloon.style.display === 'none' ? 'block' : 'none';
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--border-medium)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0
                  }}
                  title="Click to see how variable pricing works"
                >
                  ?
                </button>
              </div>

              {/* Info Balloon Container (Excel comment style, toggled inline) */}
              <div
                id="price-info-balloon"
                style={{
                  display: 'none',
                  background: 'var(--bg-input)',
                  borderLeft: '4px solid var(--primary)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                  marginBottom: '10px'
                }}
              >
                💡 <strong>How variable pricing works:</strong> By default, all stores charge the <strong>Global Price</strong>. If you want a specific store to charge a different rate, expand the section below and enter a custom price for that store.
              </div>

              <input
                id="plu-ho-price"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={form.headoffice_price}
                onChange={(e) => setForm((f) => ({ ...f, headoffice_price: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            {/* Variable Store Prices Collapsible */}
            <details style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '10px 14px',
              cursor: 'pointer'
            }}>
              <summary style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>▼</span>
                  <span>Set Variable Prices (Store Overrides)</span>
                </div>
              </summary>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Enter prices below only for stores that charge different rates than the Global Price.
                </p>
                {STORE_KEYS.map((key) => {
                  const storeNum = key.replace('store_', '');
                  const storeObj = storesWithNumber.find((s) => s.store_number === storeNum);
                  
                  // If the store number does not exist in the database, keep it hidden
                  if (!storeObj) return null;

                  const isInactive = storeObj.is_active === false;
                  const storeLabel = isInactive ? `${storeObj.name} (Inactive)` : storeObj.name;

                  return (
                    <div className="form-group" key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: isInactive ? 0.55 : 1 }}>
                      <label className="form-label" htmlFor={`plu-${key}`} style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {storeLabel}
                      </label>
                      <input
                        id={`plu-${key}`}
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={form[key]}
                        disabled={isInactive}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={isInactive ? "Inactive store" : "Inheriting global price"}
                      />
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="modal-actions" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : isEditMode ? 'Update PLU' : 'Register PLU'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
