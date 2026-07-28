import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import type { TenantPlan } from '../../types';

export default function AdminPlans() {
  const { userType } = useAuthStore();
  const [plans, setPlans] = useState<TenantPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((r) => r.json())
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Plans</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          Subscription tiers for tenant companies
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {plans.map((plan) => (
            <div className="card" key={plan.plan_id} style={{
              padding: '24px',
              borderTop: plan.name === 'Enterprise' ? '3px solid #088f8f' : '1px solid var(--border-medium)',
            }}>
              <h3 style={{ margin: '0 0 4px' }}>{plan.name}</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#088f8f', marginBottom: '16px' }}>
                £{Number(plan.price).toFixed(2)}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                <div>🏪 Up to {plan.max_stores === 999 ? 'unlimited' : plan.max_stores} stores</div>
                <div>👥 Up to {plan.max_users === 999 ? 'unlimited' : plan.max_users} users</div>
                {plan.features && Object.entries(plan.features).map(([key, val]) => (
                  <div key={key}>{val ? '✅' : '❌'} {key.replace(/_/g, ' ')}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {userType === 'super_admin' && (
        <div className="card" style={{ marginTop: '24px', padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Plan management coming soon
        </div>
      )}
    </div>
  );
}
