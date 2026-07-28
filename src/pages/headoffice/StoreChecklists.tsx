import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import DataTable from '../../components/UI/DataTable';

export default function StoreChecklists() {
  const {
    stores, fetchStores,
    checklists, checklistsLoading, fetchChecklists,
    addChecklistTask, updateChecklistTask, deleteChecklistTask,
  } = useAppStore();

  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [filterType, setFilterType] = useState<'start' | 'end'>('start');

  const [newTaskName, setNewTaskName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchChecklists(selectedStoreId, filterType);
    }
  }, [selectedStoreId, filterType, fetchChecklists]);

  const handleAdd = async () => {
    if (!selectedStoreId || !newTaskName.trim()) return;
    const maxOrder = checklists.reduce((max, c: any) => Math.max(max, c.sort_order ?? 0), 0);
    const { error } = await addChecklistTask({
      store_id: selectedStoreId,
      type: filterType,
      task_name: newTaskName.trim(),
      sort_order: maxOrder + 1,
    });
    if (error) return;
    setNewTaskName('');
    fetchChecklists(selectedStoreId, filterType);
  };

  const handleEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await updateChecklistTask(id, { task_name: editName.trim() });
    if (error) return;
    setEditingId(null);
    setEditName('');
    fetchChecklists(selectedStoreId, filterType);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this checklist task?')) return;
    const { error } = await deleteChecklistTask(id);
    if (error) return;
    fetchChecklists(selectedStoreId, filterType);
  };

  const handleMoveUp = async (item: any, index: number) => {
    if (index === 0) return;
    const prev = checklists[index - 1];
    const r1 = await updateChecklistTask(item.checklist_id, { sort_order: (prev as any).sort_order });
    if (r1.error) return;
    const r2 = await updateChecklistTask((prev as any).checklist_id, { sort_order: item.sort_order });
    if (r2.error) return;
    fetchChecklists(selectedStoreId, filterType);
  };

  const handleMoveDown = async (item: any, index: number) => {
    if (index >= checklists.length - 1) return;
    const next = checklists[index + 1];
    const r1 = await updateChecklistTask(item.checklist_id, { sort_order: (next as any).sort_order });
    if (r1.error) return;
    const r2 = await updateChecklistTask((next as any).checklist_id, { sort_order: item.sort_order });
    if (r2.error) return;
    fetchChecklists(selectedStoreId, filterType);
  };

  const columns = [
    { key: 'sort_order', label: 'Order' },
    { key: 'task_name', label: 'Task' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = checklists.map((item: any, idx: number) => ({
    ...item,
    sort_order: (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => handleMoveUp(item, idx)} disabled={idx === 0}>↑</button>
        <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.sort_order}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => handleMoveDown(item, idx)} disabled={idx >= checklists.length - 1}>↓</button>
      </div>
    ),
    task_name: editingId === item.checklist_id ? (
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input className="form-input" style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(item.checklist_id)}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
      </div>
    ) : item.task_name,
    actions: editingId !== item.checklist_id ? (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(item.checklist_id, item.task_name)}>✏️</button>
        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.checklist_id)}>🗑️</button>
      </div>
    ) : null,
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Store Checklists</h1>
        <p style={{ color: 'var(--text-muted)' }}>Configure day-start and day-end tasks per store.</p>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Store</label>
          <select className="form-select" value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
            <option value="">— Select Store —</option>
            {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Type</label>
          <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value as 'start' | 'end')}>
            <option value="start">Day Start</option>
            <option value="end">Day End</option>
          </select>
        </div>
      </div>

      {selectedStoreId && (
        <>
          <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
            <h4 style={{ marginBottom: '12px' }}>Add Task</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Task Name</label>
                <input className="form-input" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="e.g. Turn on all scales" />
              </div>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!newTaskName.trim()}>Add</button>
            </div>
          </div>

          {checklistsLoading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : (
            <DataTable columns={columns} data={tableData} emptyMessage={`No ${filterType === 'start' ? 'day-start' : 'day-end'} tasks configured. Add one above.`} />
          )}
        </>
      )}
    </div>
  );
}
