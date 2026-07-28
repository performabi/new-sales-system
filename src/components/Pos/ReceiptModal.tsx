import Modal from '../UI/Modal';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  transaction: any;
  currencySymbol: string;
  storeName: string;
}

export default function ReceiptModal({ isOpen, onClose, onPrint, transaction, currencySymbol, storeName }: ReceiptModalProps) {
  if (!transaction) return null;

  const items = transaction.sale_items || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sale Complete">
      <div style={{ minWidth: '300px' }}>
        <div id="receipt-content" style={{
          fontFamily: 'monospace', fontSize: '0.8rem', padding: '16px',
          background: '#fff', color: '#000', borderRadius: '4px', maxWidth: '300px', margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{storeName}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
              {new Date(transaction.created_at).toLocaleString()}
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed #999' }} />
          <div style={{ margin: '8px 0' }}>
            {items.map((item: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{item.plu_name} ×{item.quantity}</span>
                <span>{currencySymbol}{(item.total_price || item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed #999' }} />
          {transaction.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount</span>
              <span>-{currencySymbol}{Number(transaction.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem', marginTop: '4px' }}>
            <span>TOTAL</span>
            <span>{currencySymbol}{Number(transaction.total_amount).toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.65rem', opacity: 0.6 }}>
            {transaction.payment_method?.toUpperCase()} — {transaction.payment_note || ''}
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed #999' }} />
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.65rem', opacity: 0.7 }}>
            Thank you for your custom!
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onPrint}>
            🖨 Print Receipt
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
