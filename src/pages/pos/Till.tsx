import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { apiFetch } from '../../lib/api';
import { deviceManager } from '../../devices/DeviceManager';
import CategoryBar from '../../components/Pos/CategoryBar';
import PluGrid from '../../components/Pos/PluGrid';
import ScanInput from '../../components/Pos/ScanInput';
import WeightMonitor from '../../components/Pos/WeightMonitor';
import BasketPanel from '../../components/Pos/BasketPanel';
import PaymentModal from '../../components/Pos/PaymentModal';
import ReceiptModal from '../../components/Pos/ReceiptModal';
import TillNotificationBar from '../../components/Pos/TillNotificationBar';
import type { Plu } from '../../types';

const NAV_ITEMS = [
  { path: '/pos/dashboard',  icon: '🏠', label: 'Home' },
  { path: '/pos/till',       icon: '🧾', label: 'Till' },
  { path: '/pos/transactions', icon: '📋', label: 'Transactions' },
  { path: '/pos/clock',      icon: '⏰', label: 'Clock' },
  { path: '/pos/checklists', icon: '✅', label: 'Checklists' },
  { path: '/pos/goods-in',   icon: '🚚', label: 'Goods In' },
];

export default function Till() {
  const storeId = sessionStorage.getItem('pos_store_id');
  const storeName = sessionStorage.getItem('pos_store_name') || 'Store';
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pluCategories = useAppStore((s) => s.pluCategories);
  const fetchPluCategories = useAppStore((s) => s.fetchPluCategories);
  const plusItems = useAppStore((s) => s.plusItems);
  const fetchPlus = useAppStore((s) => s.fetchPlus);
  const basketTabs = useAppStore((s) => s.basketTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const openNewBasket = useAppStore((s) => s.openNewBasket);
  const addToBasket = useAppStore((s) => s.addToBasket);
  const createSale = useAppStore((s) => s.createSale);
  const setBasketLoyalty = useAppStore((s) => s.setBasketLoyalty);
  const lookupLoyaltyCard = useAppStore((s) => s.lookupLoyaltyCard);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinTitle, setPinTitle] = useState('');
  const [pinCallback, setPinCallback] = useState<((user: any) => void) | null>(null);
  const [currencyConfig, setCurrencyConfig] = useState<any>(null);
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);

  useEffect(() => {
    if (storeId) {
      fetchPluCategories();
      fetchPlus();
    }
    const scale = deviceManager.getScale();
    if (scale) {
      const read = async () => {
        const w = await scale.readWeight();
        if (w !== null) setScaleWeight(w);
      };
      read();
      const interval = setInterval(read, 2000);
      return () => clearInterval(interval);
    }
    apiFetch('/api/settings/currency')
      .then((r) => r.json())
      .then((c) => setCurrencyConfig(c))
      .catch(() => {});
  }, [storeId]);

  const getEffectivePrice = useCallback((plu: Plu): number => {
    if (!storeId) return plu.headoffice_price ?? 0;
    const storeKey = `store_${storeId}` as keyof Plu;
    const storePrice = plu[storeKey];
    if (typeof storePrice === 'number' && storePrice > 0) return storePrice;
    return plu.headoffice_price ?? 0;
  }, [storeId]);

  const filteredPlu = plusItems.filter((plu) => {
    if (activeCategory && plu.category_id !== activeCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!plu.name.toLowerCase().includes(q) && !plu.plu_number.toLowerCase().includes(q) && !(plu.ean || '').includes(q)) return false;
    }
    return true;
  });

  const handlePluSelect = (plu: Plu) => {
    if (!activeTabId) {
      setPinTitle('Enter PIN to open basket');
      setPinCallback(() => (user: any) => {
        openNewBasket(user.user_id, user.full_name);
        addBasketItem(plu);
      });
      setShowPinPrompt(true);
      return;
    }
    addBasketItem(plu);
  };

  const addBasketItem = (plu: Plu) => {
    const price = getEffectivePrice(plu);
    addToBasket({
      plu_id: plu.plu_id,
      name: plu.name,
      plu_number: plu.plu_number,
      unit_price: price,
      total_price: price,
      uses_scale: plu.uses_scale,
      quantity: plu.uses_scale ? 0 : 1,
    });
    if (plu.uses_scale && scaleWeight !== null) {
      // On scale items, immediately set weight
      useAppStore.getState().updateBasketItemQty(plu.plu_id, scaleWeight);
    }
  };

  const handleBarcodeLookup = async (barcode: string): Promise<Plu | null> => {
    const plu = plusItems.find((p) => p.ean === barcode);
    if (plu) return plu;
    // Try fetching via API
    try {
      const res = await apiFetch(`/api/plu/ean/${encodeURIComponent(barcode)}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {}
    return null;
  };

  const handleBarcodeScan = (plu: Plu) => {
    handlePluSelect(plu);
  };

  const handleFinalise = () => {
    if (!basketTabs.find((t) => t.tabId === activeTabId)?.items.length) return;
    setShowPayment(true);
  };

  const handlePay = async (method: string, note?: string, _amountTendered?: number) => {
    const tab = basketTabs.find((t) => t.tabId === activeTabId);
    if (!tab) return;
    const subtotal = tab.items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0);
    const total = Math.max(0, subtotal - (tab.discount || 0));

    const result = await createSale({
      store_id: storeId,
      staff_user_id: tab.staffUserId,
      items: tab.items.map((i: any) => ({
        plu_id: i.plu_id,
        plu_name: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.unit_price * i.quantity,
      })),
      total_amount: total,
      discount_amount: tab.discount || 0,
      payment_method: method,
      payment_note: note || '',
      loyalty_card_id: tab.loyaltyCardId,
    });

    setShowPayment(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    setLastTransaction(result.transaction);
    setShowReceipt(true);
    useAppStore.getState().closeBasket(activeTabId!);
  };

  const handlePrint = () => {
    const receiptEl = document.getElementById('receipt-content');
    if (!receiptEl) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html><head><title>Receipt</title>
      <style>body{font-family:monospace;font-size:12px;width:80mm;margin:0;padding:8px}
      @media print{@page{margin:0}}hr{border:none;border-top:1px dashed #999}
      </style></head><body>
      ${receiptEl.innerHTML}
      <script>window.onload=function(){window.print();window.close()}</scr'+'ipt>
    </body></html>`);
    printWin.document.close();
  };

  const handleAddLoyalty = () => {
    setPinTitle('Enter PIN to add loyalty');
    setPinCallback(() => async (_user: any) => {
      const code = prompt('Scan or type loyalty card number:');
      if (!code) return;
      const card = await lookupLoyaltyCard(code);
      if (!card) {
        alert('Card not found');
        return;
      }
      if (activeTabId) {
        setBasketLoyalty(activeTabId, card.card_id, card.customer_name, card.cashback_balance);
      }
    });
    setShowPinPrompt(true);
  };

  const handleNewTab = () => {
    setPinTitle('Enter PIN to open new tab');
    setPinCallback(() => (user: any) => {
      openNewBasket(user.user_id, user.full_name);
    });
    setShowPinPrompt(true);
  };

  const handlePinSuccess = (user: any) => {
    setShowPinPrompt(false);
    pinCallback?.(user);
    setPinCallback(null);
  };

  const symbol = currencyConfig?.symbol || '£';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
    }}>
      {/* Scan Input */}
      <div style={{ flexShrink: 0 }}>
        <TillNotificationBar storeId={storeId} />
        <ScanInput onPluFound={handleBarcodeScan} onBarcodeLookup={handleBarcodeLookup} />
      </div>

      {/* Category Bar */}
      <div style={{ flexShrink: 0 }}>
        <CategoryBar categories={pluCategories} activeCategory={activeCategory} onSelect={setActiveCategory} />
      </div>

      {/* Search */}
      <div style={{ padding: '4px 8px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search products…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff',
          }}
        />
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left column: Header → PLU Grid → Nav Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '80%', alignSelf: 'flex-start' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', background: 'linear-gradient(135deg, #004f6d, #088f8f)',
            borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{storeName}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span style={{ opacity: 0.7 }}>Till</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <WeightMonitor weight={scaleWeight} />
            </div>
          </div>
          <PluGrid items={filteredPlu} storeId={storeId} onSelect={handlePluSelect} getEffectivePrice={getEffectivePrice} />
          <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-medium)',
            borderBottom: '1px solid var(--border-medium)', padding: '6px 0',
            flexShrink: 0,
          }}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                className="btn btn-ghost"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem',
                  color: location.pathname === item.path ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  border: 'none', background: 'none', cursor: 'pointer',
                }}
                onClick={() => navigate(item.path)}
              >
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
        </div>
        {/* Right column: Basket Panel */}
        <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, height: '80%', alignSelf: 'flex-start' }}>
          <BasketPanel
            onFinalise={handleFinalise}
            onAddLoyalty={handleAddLoyalty}
            onNewTab={handleNewTab}
            showPinPrompt={showPinPrompt}
            pinTitle={pinTitle}
            onPinSuccess={handlePinSuccess}
            onClosePin={() => { setShowPinPrompt(false); setPinCallback(null); }}
            currencySymbol={symbol}
          />
        </div>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onPay={handlePay}
        total={basketTabs.find((t) => t.tabId === activeTabId)?.items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0) - (basketTabs.find((t) => t.tabId === activeTabId)?.discount || 0) || 0}
        currencySymbol={symbol}
      />

      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        onPrint={handlePrint}
        transaction={lastTransaction}
        currencySymbol={symbol}
        storeName={storeName}
      />
    </div>
  );
}
