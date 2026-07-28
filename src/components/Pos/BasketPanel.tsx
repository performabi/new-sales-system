import { useAppStore } from '../../store/appStore';
import PinPrompt from './PinPrompt';

interface BasketPanelProps {
  onFinalise: () => void;
  onAddLoyalty: () => void;
  onNewTab: () => void;
  showPinPrompt: boolean;
  pinTitle: string;
  onPinSuccess: (user: any) => void;
  onClosePin: () => void;
}

export default function BasketPanel({ onFinalise, onAddLoyalty, onNewTab, showPinPrompt, pinTitle, onPinSuccess, onClosePin }: BasketPanelProps) {
  const basketTabs = useAppStore((s) => s.basketTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const switchBasket = useAppStore((s) => s.switchBasket);
  const closeBasket = useAppStore((s) => s.closeBasket);
  const updateBasketItemQty = useAppStore((s) => s.updateBasketItemQty);
  const removeFromBasket = useAppStore((s) => s.removeFromBasket);
  const setBasketDiscount = useAppStore((s) => s.setBasketDiscount);

  const activeTab = basketTabs.find((t) => t.tabId === activeTabId);

  const subtotal = activeTab?.items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0) ?? 0;
  const discount = activeTab?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div style={{
      width: '360px', display: 'flex', flexDirection: 'column',
      background: 'rgba(0,0,0,0.2)', borderRadius: '8px', flex: 1, minHeight: 0,
    }}>
      {/* Basket tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 8px 0', overflowX: 'auto', flexShrink: 0 }}>
        {basketTabs.map((tab) => (
          <div key={tab.tabId} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className={`btn ${tab.tabId === activeTabId ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              onClick={() => switchBasket(tab.tabId)}
            >
              {tab.staffName}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--error)', opacity: 0.6 }}
              onClick={() => closeBasket(tab.tabId)}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          onClick={() => onNewTab()}
        >
          + New
        </button>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', minHeight: 0 }}>
        {!activeTab && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Open a basket tab to start
          </div>
        )}
        {activeTab?.items.map((item: any) => (
          <div key={item.plu_id} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                £{item.unit_price.toFixed(2)} × {item.quantity}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                onClick={() => updateBasketItemQty(item.plu_id, item.quantity - 1)}
              >
                −
              </button>
              <span style={{ minWidth: '24px', textAlign: 'center', fontFamily: 'monospace' }}>
                {item.quantity}
              </span>
              <button
                className="btn btn-ghost"
                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                onClick={() => updateBasketItemQty(item.plu_id, item.quantity + 1)}
              >
                +
              </button>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, minWidth: '60px', textAlign: 'right' }}>
              £{(item.unit_price * item.quantity).toFixed(2)}
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--error)', opacity: 0.5 }}
              onClick={() => removeFromBasket(item.plu_id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
          <span>Subtotal</span>
          <span>£{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--accent)' }}>
            <span>Discount</span>
            <span>-£{discount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 700, margin: '8px 0' }}>
          <span>Total</span>
          <span>£{total.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onFinalise} disabled={!activeTab?.items.length}>
            Pay £{total.toFixed(2)}
          </button>
        </div>
        {activeTab && activeTab.loyaltyCustomerName && (
          <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(103,255,166,0.1)', borderRadius: '6px', fontSize: '0.8rem' }}>
            <div><strong>{activeTab.loyaltyCustomerName}</strong></div>
            <div>Cashback: £{activeTab.loyaltyCashback.toFixed(2)}</div>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Discount:</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={activeTab.loyaltyCashback}
                value={discount}
                onChange={(e) => setBasketDiscount(activeTab.tabId, Math.min(activeTab.loyaltyCashback, Math.max(0, Number(e.target.value) || 0)))}
                style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'monospace' }}
              />
              <span>max £{activeTab.loyaltyCashback.toFixed(2)}</span>
            </div>
          </div>
        )}
        {activeTab && !activeTab.loyaltyCustomerName && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: '4px', fontSize: '0.8rem' }} onClick={onAddLoyalty}>
            + Add Loyalty Card
          </button>
        )}

        {activeTab && activeTab.loyaltyCustomerName && (
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            onClick={() => {
              setBasketDiscount(activeTab.tabId, 0);
              useAppStore.getState().setBasketLoyalty(activeTab.tabId, null as any, null as any, 0);
            }}
          >
            Remove Loyalty
          </button>
        )}
      </div>

      <PinPrompt isOpen={showPinPrompt} onClose={onClosePin} onSuccess={onPinSuccess} title={pinTitle} />
    </div>
  );
}
