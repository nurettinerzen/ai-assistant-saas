// ============================================================================
// BAR CHART COMPONENT
// ============================================================================
// FILE: frontend/components/charts/BarChart.jsx
//
// Reusable bar chart for categorical data (call reasons, etc.)
// ============================================================================

import React from 'react';
import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function BarChart({ data, dataKey = 'value', xAxisKey = 'name', title, color = '#667eea', height = 300, horizontal = false }) {
  if (horizontal) {
    return (
      <div className="w-full">
        {title && (
          <h3 className="text-lg font-semibold mb-4">{title}</h3>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBar data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis type="number" stroke="#666" style={{ fontSize: '12px' }} />
            <YAxis 
              type="category" 
              dataKey={xAxisKey} 
              stroke="#666" 
              style={{ fontSize: '12px' }}
              width={120}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 8, 8, 0]} />
          </RechartsBar>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBar data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey={xAxisKey} 
            stroke="#666" 
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#666" 
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;
