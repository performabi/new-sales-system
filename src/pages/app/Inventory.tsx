// src/pages/Inventory.tsx
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import DataTable from '../../components/UI/DataTable';
import { formatCurrency } from '../../lib/formatCurrency';

export default function Inventory() {
  const { inventory, inventoryLoading, fetchInventory, stores, fetchStores, pluCategories, fetchPluCategories } = useAppStore();
  const [storeFilter, setStoreFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchStores();
    fetchPluCategories();
  }, [fetchInventory, fetchStores, fetchPluCategories]);

  const filtered = useMemo(() => {
    return inventory.filter((item) => {
      if (storeFilter && item.store_id !== storeFilter) return false;
      if (categoryFilter && item.category_name !== categoryFilter) return false;
      return true;
    });
  }, [inventory, storeFilter, categoryFilter]);

  const columns = [
    { key: 'product_name', label: 'Product Name' },
    { key: 'plu_number', label: 'PLU Number' },
    { key: 'category_name', label: 'Category' },
    { key: 'barcode_qr', label: 'Barcode / QR' },
    { key: 'store_name', label: 'Location' },
    { key: 'stock_quantity', label: 'Stock Level' },
    { key: 'price', label: 'Price' },
  ];

  const tableData = filtered.map((item) => ({
    ...item,
    stock_quantity: (
      <span className={item.stock_quantity <= 5 ? 'low-stock' : ''} style={{ fontWeight: '600' }}>
        {item.stock_quantity}
      </span>
    ),
    price: formatCurrency(item.price),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Global Inventory View</h1>
      </div>

      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-group" style={{ minWidth: '220px' }}>
          <label className="filter-label">Store</label>
          <select className="form-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ minWidth: '220px' }}>
          <label className="filter-label">Category</label>
          <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {pluCategories.map((c) => (
              <option key={c.category_id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end', paddingBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {inventoryLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No inventory found." />
      )}
    </div>
  );
}