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
  const created = new Date(transaction.created_at);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sale Complete">
      <div style={{ minWidth: '300px' }}>
        <div id="receipt-content" style={{
          width: '72mm', margin: '0 auto', padding: '6mm 4mm',
          background: '#fff', color: '#000', borderRadius: '4px',
          fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', lineHeight: 1.4,
        }}>
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>{storeName}</div>
            <div style={{ fontSize: '10px' }}>
              TXN {String(transaction.transaction_id || '').slice(0, 8).toUpperCase()}
            </div>
            <div style={{ fontSize: '10px' }}>
              {created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
              {created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
            <span>ITEM</span>
            <span>AMOUNT</span>
          </div>
          {items.map((item: any, i: number) => {
            const amount = (item.total_price || item.unit_price * item.quantity).toFixed(2);
            const name = `${item.plu_name} ×${item.quantity}`;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '44mm' }}>{name}</span>
                <span>{currencySymbol}{amount}</span>
              </div>
            );
          })}

          <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

          {Number(transaction.discount_amount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount</span>
              <span>-{currencySymbol}{Number(transaction.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px', marginTop: '4px' }}>
            <span>TOTAL</span>
            <span>{currencySymbol}{Number(transaction.total_amount).toFixed(2)}</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10px' }}>
            PAID BY {String(transaction.payment_method || '').toUpperCase()}
            {transaction.payment_note ? ` — ${transaction.payment_note}` : ''}
          </div>

          {(transaction.cash_given != null) && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>CASH GIVEN</span>
                <span>{currencySymbol}{Number(transaction.cash_given).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CHANGE</span>
                <span>{currencySymbol}{Number(transaction.change_due ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}

          <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

          <div style={{ textAlign: 'center', fontSize: '10px' }}>Thank you for your custom!</div>
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
