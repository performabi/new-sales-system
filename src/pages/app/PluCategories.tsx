// src/pages/PluCategories.tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import DataTable from '../../components/UI/DataTable';
import Modal from '../../components/UI/Modal';

export default function PluCategories() {
  const {
    pluCategories,
    pluCategoriesLoading,
    fetchPluCategories,
    addPluCategory,
    updatePluCategory,
    deletePluCategory,
  } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPluCategories();
  }, [fetchPluCategories]);

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setName('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: any) => {
    setIsEditMode(true);
    setEditingId(cat.category_id);
    setName(cat.name);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);

    let res: { error: string | null };
    if (isEditMode && editingId) {
      res = await updatePluCategory(editingId, name.trim());
    } else {
      res = await addPluCategory(name.trim());
    }

    setIsSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      closeModal();
    }
  };

  const handleDelete = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?\n\nThis will fail if any PLUs are assigned to it.`)) return;
    const res = await deletePluCategory(cat.category_id);
    if (res.error) {
      alert(res.error);
    }
  };

  const columns = [
    { key: 'name', label: 'Category Name' },
    { key: 'creator_username_badge', label: 'Created By' },
    { key: 'created_at_fmt', label: 'Created' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = pluCategories.map((cat) => ({
    ...cat,
    creator_username_badge: (
      <span className="badge badge-info">{cat.creator_username ?? 'System'}</span>
    ),
    created_at_fmt: new Date(cat.created_at).toLocaleDateString('en-GB'),
    actions: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-sm btn-ghost"
          onClick={(e) => { e.stopPropagation(); openEditModal(cat); }}
        >
          Edit
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={(e) => { e.stopPropagation(); handleDelete(cat); }}
        >
          Delete
        </button>
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>PLU Categories</h1>
          <p style={{ marginTop: 4, fontSize: '0.88rem' }}>
            Manage categories used to group PLU products. Categories cannot be deleted while products are assigned to them.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add Category
        </button>
      </div>

      {pluCategoriesLoading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={tableData}
          emptyMessage="No categories yet. Add your first category to get started."
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditMode ? 'Edit Category' : 'New Category'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cat-name">Category Name</label>
            <input
              id="cat-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Food, Beverages, Household…"
              required
              autoFocus
            />
          </div>

          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditMode ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
