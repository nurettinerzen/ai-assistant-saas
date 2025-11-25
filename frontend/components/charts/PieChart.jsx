// ============================================================================
// PIE CHART COMPONENT
// ============================================================================
// FILE: frontend/components/charts/PieChart.jsx
//
// Reusable pie chart for sentiment distribution, etc.
// ============================================================================

import React from 'react';
import { PieChart as RechartsPie, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DEFAULT_COLORS = ['#4caf50', '#9e9e9e', '#f44336', '#667eea', '#ff9800'];

export function PieChart({ data, dataKey = 'value', nameKey = 'name', title, colors = DEFAULT_COLORS, height = 300 }) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPie>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Legend />
        </RechartsPie>
      </ResponsiveContainer>
    </div>
  );
}

export default PieChart;
