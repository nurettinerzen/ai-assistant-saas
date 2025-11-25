// ============================================================================
// HEATMAP COMPONENT (Custom Implementation)
// ============================================================================
// FILE: frontend/components/charts/Heatmap.jsx
//
// Custom heatmap for peak hours (7 days x 24 hours)
// ============================================================================

import React from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Generate color based on intensity (0-100)
const getColor = (intensity) => {
  if (intensity === 0) return 'bg-gray-100';
  if (intensity < 20) return 'bg-blue-100';
  if (intensity < 40) return 'bg-blue-200';
  if (intensity < 60) return 'bg-blue-300';
  if (intensity < 80) return 'bg-blue-400';
  return 'bg-blue-500';
};

export function Heatmap({ data, title }) {
  // data format: { day: 0-6, hour: 0-23, calls: number }
  // Convert to 2D array
  const maxCalls = Math.max(...data.map(d => d.calls), 1);
  
  const getIntensity = (day, hour) => {
    const cell = data.find(d => d.day === day && d.hour === hour);
    if (!cell || cell.calls === 0) return 0;
    return (cell.calls / maxCalls) * 100;
  };

  const getCalls = (day, hour) => {
    const cell = data.find(d => d.day === day && d.hour === hour);
    return cell ? cell.calls : 0;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex">
            <div className="w-12"></div>
            {HOURS.filter(h => h % 3 === 0).map(hour => (
              <div key={hour} className="w-16 text-center text-xs text-gray-600">
                {hour}:00
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="mt-2">
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center mb-1">
                {/* Day label */}
                <div className="w-12 text-xs text-gray-600 font-medium">
                  {day}
                </div>
                
                {/* Hour cells */}
                <div className="flex gap-1">
                  {HOURS.map(hour => {
                    const intensity = getIntensity(dayIndex, hour);
                    const calls = getCalls(dayIndex, hour);
                    
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className={`w-6 h-6 rounded ${getColor(intensity)} cursor-pointer hover:ring-2 hover:ring-blue-600 transition-all`}
                        title={`${day} ${hour}:00 - ${calls} calls`}
                      >
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-gray-100"></div>
              <div className="w-4 h-4 rounded bg-blue-100"></div>
              <div className="w-4 h-4 rounded bg-blue-200"></div>
              <div className="w-4 h-4 rounded bg-blue-300"></div>
              <div className="w-4 h-4 rounded bg-blue-400"></div>
              <div className="w-4 h-4 rounded bg-blue-500"></div>
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Heatmap;
