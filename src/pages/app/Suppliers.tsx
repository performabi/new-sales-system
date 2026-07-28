// src/pages/Suppliers.tsx
import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import DataTable from '../components/UI/DataTable';
import Modal from '../components/UI/Modal';

export default function Suppliers() {
  const {
    suppliers, suppliersLoading, fetchSuppliers, addSupplier, updateSupplier,
    supplierProducts, supplierProductsLoading, fetchSupplierProducts,
    linkSupplierProduct, unlinkSupplierProduct,
    plusItems, fetchPlus,
  } = useAppStore();

  // Supplier CRUD modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [terms, setTerms] = useState('');
  const [vat, setVat] = useState('');
  const [companyReg, setCompanyReg] = useState('');
  const [bankName, setBankName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Products modal
  const [productsModalSupplierId, setProductsModalSupplierId] = useState<string | null>(null);
  const [productsModalSupplierName, setProductsModalSupplierName] = useState('');
  const [addPluId, setAddPluId] = useState('');
  const [addCost, setAddCost] = useState('');
  const [addLeadTime, setAddLeadTime] = useState('3');
  const [addSku, setAddSku] = useState('');
  const [addPreferred, setAddPreferred] = useState(true);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchPlus();
  }, [fetchSuppliers, fetchPlus]);

  // Re-fetch supplier products when modal opens for a supplier
  const openProductsModal = useCallback((supplierId: string, supplierName: string) => {
    setProductsModalSupplierId(supplierId);
    setProductsModalSupplierName(supplierName);
    setAddPluId('');
    setAddCost('');
    setAddLeadTime('3');
    setAddSku('');
    setAddPreferred(true);
    fetchSupplierProducts(supplierId);
  }, [fetchSupplierProducts]);

  const closeProductsModal = useCallback(() => {
    setProductsModalSupplierId(null);
    setProductsModalSupplierName('');
  }, []);

  const handleLinkProduct = async () => {
    if (!productsModalSupplierId || !addPluId || !addCost) return;
    setIsLinking(true);
    const result = await linkSupplierProduct({
      supplier_id: productsModalSupplierId,
      plu_id: addPluId,
      supplier_sku: addSku || undefined,
      cost_price: parseFloat(addCost),
      is_preferred: addPreferred,
      lead_time_days: parseInt(addLeadTime, 10) || 3,
    });
    setIsLinking(false);
    if (!result.error) {
      setAddPluId('');
      setAddCost('');
      setAddLeadTime('3');
      setAddSku('');
      setAddPreferred(true);
      fetchSupplierProducts(productsModalSupplierId);
    }
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Remove this product from the supplier?')) return;
    const result = await unlinkSupplierProduct(id);
    if (!result.error && productsModalSupplierId) {
      fetchSupplierProducts(productsModalSupplierId);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setName(''); setEmail(''); setPhone(''); setAddress('');
    setTerms(''); setVat(''); setCompanyReg('');
    setBankName(''); setSortCode(''); setAccountNumber('');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: any) => {
    setEditingId(supplier.supplier_id);
    setName(supplier.name);
    setEmail(supplier.contact_email);
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setTerms(supplier.payment_terms || '');
    setVat(supplier.vat_number || '');
    setCompanyReg(supplier.company_reg_number || '');
    setBankName(supplier.bank_details?.bank_name || '');
    setSortCode(supplier.bank_details?.sort_code || '');
    setAccountNumber(supplier.bank_details?.account_number || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      name,
      contact_email: email,
      phone: phone || undefined,
      address: address || undefined,
      payment_terms: terms || undefined,
      vat_number: vat || undefined,
      company_reg_number: companyReg || undefined,
      bank_details: {
        bank_name: bankName || undefined,
        sort_code: sortCode || undefined,
        account_number: accountNumber || undefined,
      },
    };
    let result;
    if (editingId) {
      result = await updateSupplier(editingId, payload);
    } else {
      result = await addSupplier(payload);
    }
    setIsSubmitting(false);
    if (!result.error) {
      setIsModalOpen(false);
    }
  };

  const linkedPluIds = new Set(supplierProducts.map((sp) => sp.plu_id));
  const availablePlus = plusItems.filter((p) => !linkedPluIds.has(p.plu_id));

  const columns = [
    { key: 'name', label: 'Supplier Name' },
    { key: 'contact_email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'payment_terms', label: 'Terms' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = suppliers.map((sup) => ({
    ...sup,
    actions: (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(sup)}>Edit / Details</button>
        <button className="btn btn-ghost btn-sm" onClick={() => openProductsModal(sup.supplier_id, sup.name)}>Products</button>
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Suppliers Configuration</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your corporate vendors and billing parameters.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add Supplier</button>
      </div>

      {suppliersLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No suppliers configured." />
      )}

      {/* Supplier CRUD Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Supplier' : 'Add New Supplier'}>
        <form onSubmit={handleSubmit} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Supplier Name *</label>
            <input type="text" className="form-input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="text" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Postal / Billing Address</label>
            <textarea className="form-input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Terms</label>
            <input type="text" className="form-input" placeholder="e.g. Net 30, COD" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">VAT Reg Number</label>
            <input type="text" className="form-input" value={vat} onChange={(e) => setVat(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Company Registration Number</label>
            <input type="text" className="form-input" value={companyReg} onChange={(e) => setCompanyReg(e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-light)', marginTop: '8px', paddingTop: '8px' }}>
            <h4 style={{ marginBottom: '8px' }}>Bank Remittance Details (Optional)</h4>
          </div>
          <div className="form-group">
            <label className="form-label">Bank Name</label>
            <input type="text" className="form-input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Sort Code</label>
            <input type="text" className="form-input" placeholder="00-00-00" value={sortCode} onChange={(e) => setSortCode(e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Account Number</label>
            <input type="text" className="form-input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Products Management Modal */}
      <Modal isOpen={!!productsModalSupplierId} onClose={closeProductsModal} title={`Products — ${productsModalSupplierName}`}>
        {supplierProductsLoading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          <>
            {/* Existing linked products */}
            {supplierProducts.length === 0 && (
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>No products linked yet.</p>
            )}
            {supplierProducts.map((sp) => (
              <div key={sp.supplier_product_id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', marginBottom: '8px',
                background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {(sp.plu as any)?.plu_number} — {(sp.plu as any)?.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    SKU: {sp.supplier_sku || '—'} &middot; Cost: £{Number(sp.cost_price).toFixed(2)} &middot; Lead: {sp.lead_time_days}d &middot;
                    {sp.is_preferred ? ' Preferred' : ' Not preferred'}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleUnlink(sp.supplier_product_id)}>Remove</button>
              </div>
            ))}

            {/* Add new product form */}
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              <h4 style={{ marginBottom: '12px' }}>Link a Product</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                  <label className="form-label">PLU</label>
                  <select className="form-select" value={addPluId} onChange={(e) => setAddPluId(e.target.value)}>
                    <option value="">— Select PLU —</option>
                    {availablePlus.map((p) => (
                      <option key={p.plu_id} value={p.plu_id}>{p.plu_number} — {p.name}</option>
                    ))}
                  </select>
                  {availablePlus.length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>All PLUs are already linked.</span>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cost Price (£) *</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={addCost} onChange={(e) => setAddCost(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Lead Time (days)</label>
                  <input type="number" min="1" className="form-input" value={addLeadTime} onChange={(e) => setAddLeadTime(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplier SKU</label>
                  <input type="text" className="form-input" value={addSku} onChange={(e) => setAddSku(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                  <label className="checkbox-label" style={{ width: '100%' }}>
                    <input type="checkbox" checked={addPreferred} onChange={(e) => setAddPreferred(e.target.checked)} />
                    Preferred Supplier
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={handleLinkProduct} disabled={isLinking || !addPluId || !addCost}>
                  {isLinking ? 'Linking…' : 'Link Product'}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
