// src/pages/Stores.tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import DataTable from '../components/UI/DataTable';
import Modal from '../components/UI/Modal';

import { useAuthStore } from '../store/authStore';

export default function Stores() {
  const profile = useAuthStore((s) => s.profile);
  const { stores, storesLoading, fetchStores, addStore, updateStore, deleteStore } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    let submitError = null;

    if (isEditMode && editingStoreId) {
      const res = await updateStore(editingStoreId, {
        name,
        address,
        postcode,
        vat_number: vatNumber,
        is_active: isActive,
      });
      submitError = res.error;
    } else {
      const res = await addStore({
        name,
        address,
        postcode,
        vat_number: vatNumber,
        is_active: isActive,
      });
      submitError = res.error;
    }

    setIsSubmitting(false);

    if (submitError) {
      setError(submitError);
    } else {
      closeModal();
    }
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingStoreId(null);
    setName('');
    setAddress('');
    setPostcode('');
    setVatNumber('');
    setIsActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (store: any) => {
    setIsEditMode(true);
    setEditingStoreId(store.store_id);
    setName(store.name);
    setAddress(store.address);
    setPostcode(store.postcode);
    setVatNumber(store.vat_number);
    setIsActive(store.is_active ?? true);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStoreId(null);
  };

  const columns = [
    { key: 'name', label: 'Store Name' },
    { key: 'address', label: 'Address' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'vat_number', label: 'VAT Number' },
    { key: 'status_badge', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = stores.map((store) => ({
    ...store,
    status_badge: (
      <span className={`badge ${store.is_active !== false ? 'badge-success' : 'badge-error'}`}>
        {store.is_active !== false ? 'Active' : 'Inactive'}
      </span>
    ),
    actions: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-sm btn-ghost"
          onClick={(e) => {
            e.stopPropagation();
            openEditModal(store);
          }}
        >
          Edit
        </button>
        {profile?.role === 'super_user' && (
          <button
            className="btn btn-sm btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete store "${store.name}"?`)) {
                deleteStore(store.store_id);
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Store Management</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add Store
        </button>
      </div>

      {storesLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No stores found." />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditMode ? "Edit Store" : "Create New Store"}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Store Name</label>
            <input
              id="name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">Address</label>
            <textarea
              id="address"
              className="form-input"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="postcode">Postcode</label>
            <input
              id="postcode"
              type="text"
              className="form-input"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vatNumber">VAT Number</label>
            <input
              id="vatNumber"
              type="text"
              className="form-input"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              required
            />
          </div>

          {isEditMode && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Store is Active
              </label>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Store' : 'Create Store')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
