/**
 * Sparkline Component
 * Compact line chart for showing trends in metric cards
 */

import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data = [], color = '#4f46e5', height = 40 }) {
  if (!data || data.length === 0) {
    return <div className="w-full" style={{ height }}></div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          animationDuration={300}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
