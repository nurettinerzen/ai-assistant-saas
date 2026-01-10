/**
 * Telyx Logo Components
 * Icon-only, full logo with text, and text-only variants
 */

import React from 'react';

// Brand colors
const BRAND_DARK = '#1a2e3b';
const BRAND_ACCENT = '#00b5b5';

// Icon only (T shape with dot)
export function TelyxIcon({ className = 'w-8 h-8', darkMode = false }) {
  const fillColor = darkMode ? '#ffffff' : BRAND_DARK;

  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 15 L80 15 L80 28 L58 28 L58 35 L70 47 L70 85 L50 65 L50 35 L38 28 L20 28 Z"
        fill={fillColor}
      />
      <circle cx="78" cy="38" r="8" fill={BRAND_ACCENT}/>
    </svg>
  );
}

// Full logo with icon and text
export function TelyxLogoFull({ className = 'h-8', darkMode = false }) {
  const textColor = darkMode ? '#ffffff' : BRAND_DARK;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TelyxIcon className="w-8 h-8" darkMode={darkMode} />
      <span className="text-lg font-semibold tracking-wide">
        <span style={{ color: textColor }}>TELYX</span>
        <span style={{ color: BRAND_ACCENT }}> AI</span>
      </span>
    </div>
  );
}

// Text only (TELYX AI)
export function TelyxLogoText({ className = '', darkMode = false }) {
  const textColor = darkMode ? '#ffffff' : BRAND_DARK;

  return (
    <span className={`font-semibold tracking-wide ${className}`}>
      <span style={{ color: textColor }}>TELYX</span>
      <span style={{ color: BRAND_ACCENT }}> AI</span>
    </span>
  );
}

// Compact version for sidebar
export function TelyxLogoCompact({ darkMode = false }) {
  const textColor = darkMode ? '#ffffff' : BRAND_DARK;

  return (
    <div className="flex items-center gap-2.5">
      <TelyxIcon className="w-8 h-8" darkMode={darkMode} />
      <span className="text-lg font-semibold">
        <span style={{ color: textColor }}>Telyx</span>
        <span style={{ color: BRAND_ACCENT }}>.AI</span>
      </span>
    </div>
  );
}

export default TelyxLogoFull;
