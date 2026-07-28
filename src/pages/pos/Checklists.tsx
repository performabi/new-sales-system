import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

export default function PosChecklists() {
  const { checklists, checklistsLoading, fetchChecklists } = useAppStore();

  const storeId = sessionStorage.getItem('pos_store_id');
  const storeName = sessionStorage.getItem('pos_store_name') || 'Store';

  const defaultType = new Date().getHours() < 12 ? 'start' : 'end';
  const [checklistType, setChecklistType] = useState<'start' | 'end'>(defaultType);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (storeId) {
      fetchChecklists(storeId, checklistType);
      setAcknowledged(new Set());
    }
  }, [storeId, checklistType, fetchChecklists]);

  const toggleAcknowledge = (id: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allDone = checklists.length > 0 && checklists.every((c: any) => acknowledged.has(c.checklist_id));

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Checklists</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{storeName}</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={`btn ${checklistType === 'start' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setChecklistType('start')}
        >☀️ Day Start</button>
        <button
          className={`btn ${checklistType === 'end' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setChecklistType('end')}
        >🌙 Day End</button>
      </div>

      {checklistsLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : checklists.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No {checklistType === 'start' ? 'day-start' : 'day-end'} tasks configured for this store.
        </div>
      ) : (
        <>
          {allDone && (
            <div className="card" style={{ textAlign: 'center', padding: '24px', marginBottom: '16px', background: 'rgba(52, 211, 153, 0.1)', borderColor: 'var(--success)' }}>
              <h3 style={{ color: 'var(--success)' }}>✅ All tasks acknowledged</h3>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {checklists.map((item: any) => {
              const done = acknowledged.has(item.checklist_id);
              return (
                <div
                  key={item.checklist_id}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 18px',
                    opacity: done ? 0.6 : 1,
                    cursor: 'pointer',
                    borderColor: done ? 'var(--success)' : 'var(--border-light)',
                  }}
                  onClick={() => toggleAcknowledge(item.checklist_id)}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    border: `2px solid ${done ? 'var(--success)' : 'var(--border-medium)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', flexShrink: 0,
                    background: done ? 'var(--success)' : 'transparent',
                    color: done ? '#fff' : 'transparent',
                  }}>
                    {done ? '✓' : ''}
                  </div>
                  <span style={{
                    flex: 1, fontSize: '0.95rem', fontWeight: 500,
                    textDecoration: done ? 'line-through' : 'none',
                    color: 'var(--text-primary)',
                  }}>
                    {item.task_name}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
