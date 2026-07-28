import { useNavigate } from 'react-router-dom';
import PinPrompt from '../../components/Pos/PinPrompt';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';

export default function PosDashboard() {
  const navigate = useNavigate();
  const storeName = sessionStorage.getItem('pos_store_name') || 'Store';
  const openNewBasket = useAppStore((s) => s.openNewBasket);
  const [showPin, setShowPin] = useState(false);

  const handleNewSale = (user: any) => {
    openNewBasket(user.user_id, user.full_name);
    navigate('/pos/till');
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Store Terminal</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          {storeName} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px', cursor: 'pointer' }} onClick={() => setShowPin(true)}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🧾</div>
          <h3>New Sale</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Open the till to process transactions</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '32px', cursor: 'pointer' }} onClick={() => navigate('/pos/goods-in')}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🚚</div>
          <h3>Goods In</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Confirm incoming purchase orders</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '32px', cursor: 'pointer' }} onClick={() => navigate('/pos/clock')}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏰</div>
          <h3>Clock In / Out</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Manage your shifts</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '32px', cursor: 'pointer' }} onClick={() => navigate('/pos/checklists')}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
          <h3>Checklists</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Complete day start / end tasks</p>
        </div>
      </div>

      <PinPrompt
        isOpen={showPin}
        onClose={() => setShowPin(false)}
        onSuccess={handleNewSale}
        title="Enter PIN to open till"
      />
    </div>
  );
}
