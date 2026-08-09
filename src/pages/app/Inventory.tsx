// src/pages/Inventory.tsx
import { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import DataTable from '../../components/UI/DataTable';
import { formatCurrency } from '../../lib/formatCurrency';

export default function Inventory() {
  const { inventory, inventoryLoading, fetchInventory } = useAppStore();

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const columns = [
    { key: 'name', label: 'Product Name' },
    { key: 'barcode_qr', label: 'Barcode / QR' },
    { key: 'store_name', label: 'Location' },
    { key: 'stock_quantity', label: 'Stock Level' },
    { key: 'price', label: 'Price' },
  ];

  const tableData = inventory.map((item) => ({
    ...item,
    price: formatCurrency(item.price),
    stock_quantity: (
      <span className={item.stock_quantity <= 5 ? 'low-stock' : ''} style={{ fontWeight: '600' }}>
        {item.stock_quantity}
      </span>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Global Inventory View</h1>
      </div>

      {inventoryLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No inventory found." />
      )}
    </div>
  );
}
