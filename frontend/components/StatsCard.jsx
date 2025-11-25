/**
 * StatsCard Component
 * Dashboard statistics card with icon, value, label, and trend indicator
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  loading = false,
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-600',
  };

  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-neutral-500';

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 w-20 bg-neutral-200 rounded mb-3"></div>
          <div className="h-8 w-32 bg-neutral-200 rounded mb-2"></div>
          <div className="h-3 w-24 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600 mb-1">{label}</p>
          <p className="text-3xl font-bold text-neutral-900">{value}</p>
        </div>
        
        {Icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>

      {(trend || trendValue) && (
        <div className="flex items-center gap-1.5">
          {trend === 'up' && <TrendingUp className={`h-4 w-4 ${trendColor}`} />}
          {trend === 'down' && <TrendingDown className={`h-4 w-4 ${trendColor}`} />}
          
          {trendValue && (
            <span className={`text-sm font-medium ${trendColor}`}>
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{trendValue}
            </span>
          )}
          
          <span className="text-sm text-neutral-500">vs last period</span>
        </div>
      )}
    </div>
  );
}
