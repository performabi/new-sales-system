// src/components/UI/DataTable.tsx
interface DataTableProps {
  columns: { key: string; label: string }[];
  data: any[];
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
}

export default function DataTable({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available.',
}: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.id || row.store_id || row.user_id || row.product_id || i}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.key.includes('.')
                      ? col.key.split('.').reduce((o, i) => (o ? o[i] : ''), row)
                      : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
