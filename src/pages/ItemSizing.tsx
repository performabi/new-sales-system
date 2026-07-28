// src/pages/ItemSizing.tsx
import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import DataTable from '../components/UI/DataTable';
import Modal from '../components/UI/Modal';
import { getSizingName, calculateCaseTotal } from '../lib/sizingUtils';

export default function ItemSizing() {
  const { itemSizing, itemSizingLoading, fetchItemSizing, createItemSizing, updateItemSizing, deleteItemSizing } = useAppStore();
  useEffect(() => { fetchItemSizing(); }, [fetchItemSizing]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<'each' | 'kg'>('each');
  const [unitsPerPack, setUnitsPerPack] = useState('');
  const [packsPerCase, setPacksPerCase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const autoName = packsPerCase && unitsPerPack ? getSizingName(unitType, Number(unitsPerPack), Number(packsPerCase)) : '';

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setUnitType('each');
    setUnitsPerPack('');
    setPacksPerCase('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (sizing: any) => {
    setIsEditMode(true);
    setEditingId(sizing.id);
    setUnitType(sizing.unit_type);
    setUnitsPerPack(String(sizing.units_per_pack));
    setPacksPerCase(String(sizing.packs_per_case));
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uPerPack = Number(unitsPerPack);
    const pPerCase = Number(packsPerCase);
    if (!uPerPack || !pPerCase || uPerPack <= 0 || pPerCase <= 0) {
      setError('Both values must be greater than 0');
      return;
    }
    if (unitType === 'each') {
      if (!Number.isInteger(uPerPack) || !Number.isInteger(pPerCase)) {
        setError('For "each" items, values must be whole numbers');
        return;
      }
    }
    setIsSubmitting(true);
    setError(null);

    const payload = { unit_type: unitType, units_per_pack: uPerPack, packs_per_case: pPerCase };
    let result: { error: string | null };

    if (isEditMode && editingId) {
      result = await updateItemSizing(editingId, payload);
    } else {
      result = await createItemSizing(payload);
    }

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      closeModal();
    }
  };

  const handleDelete = async (sizing: any) => {
    const name = getSizingName(sizing.unit_type, sizing.units_per_pack, sizing.packs_per_case);
    if (!confirm(`Delete item sizing "${name}"?`)) return;
    const res = await deleteItemSizing(sizing.id);
    if (res.error) alert(res.error);
  };

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return itemSizing;
    const q = searchQ.toLowerCase();
    return itemSizing.filter((s) => {
      const name = getSizingName(s.unit_type, s.units_per_pack, s.packs_per_case);
      return name.toLowerCase().includes(q) || s.unit_type.toLowerCase().includes(q);
    });
  }, [itemSizing, searchQ]);

  const columns = [
    { key: 'name_display', label: 'Name' },
    { key: 'unit_type_badge', label: 'Unit Type' },
    { key: 'packs_per_case', label: 'Packs / Case' },
    { key: 'units_per_pack', label: 'Units / Pack' },
    { key: 'total_per_case', label: 'Total / Case' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = filtered.map((s) => ({
    ...s,
    name_display: getSizingName(s.unit_type, s.units_per_pack, s.packs_per_case),
    unit_type_badge: (
      <span className={`badge ${s.unit_type === 'kg' ? 'badge-error' : 'badge-primary'}`}>
        {s.unit_type}
      </span>
    ),
    total_per_case: calculateCaseTotal(s.packs_per_case, s.units_per_pack),
    actions: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEditModal(s); }}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(s); }}>Delete</button>
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Item Sizing</h1>
          <p style={{ marginTop: 4, fontSize: '0.88rem' }}>
            Define packaging conversions — Cases, Packs, and Units — for use in Purchase Orders.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add Sizing
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ maxWidth: 300 }}
          placeholder="Search sizing…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      {itemSizingLoading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No sizing configurations yet. Add your first sizing to get started." />
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditMode ? 'Edit Item Sizing' : 'New Item Sizing'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="unit-type">Unit Type</label>
            <select id="unit-type" className="form-select" value={unitType} onChange={(e) => setUnitType(e.target.value as 'each' | 'kg')}>
              <option value="each">Each (countable)</option>
              <option value="kg">Kg (weight)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="packs-per-case">Packs per Case</label>
              <input
                id="packs-per-case"
                type="number"
                className="form-input"
                value={packsPerCase}
                onChange={(e) => setPacksPerCase(e.target.value)}
                step={unitType === 'each' ? '1' : 'any'}
                min={unitType === 'each' ? '1' : '0.01'}
                required
                placeholder="e.g. 4"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="units-per-pack">Units per Pack</label>
              <input
                id="units-per-pack"
                type="number"
                className="form-input"
                value={unitsPerPack}
                onChange={(e) => setUnitsPerPack(e.target.value)}
                step={unitType === 'each' ? '1' : 'any'}
                min={unitType === 'each' ? '1' : '0.01'}
                required
                placeholder="e.g. 6"
              />
            </div>
          </div>

          {autoName && (
            <div style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Preview: <strong>{autoName}</strong> — {calculateCaseTotal(Number(packsPerCase), Number(unitsPerPack))} {unitType} per case
            </div>
          )}

          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditMode ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
