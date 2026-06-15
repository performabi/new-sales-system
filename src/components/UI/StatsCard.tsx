// src/components/UI/StatsCard.tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  variant?: 'primary' | 'success' | 'secondary' | 'info';
}

export default function StatsCard({ title, value, icon, variant = 'primary' }: StatsCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${variant}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{title}</div>
      </div>
    </div>
  );
}
