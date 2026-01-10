/**
 * Telyx Logo Components
 * Using official logo PNG images
 */

import React from 'react';
import Image from 'next/image';

// Full logo with icon and text (for light backgrounds)
export function TelyxLogoFull({ className = 'h-10', darkMode = false }) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: '3/1' }}>
      <Image
        src="/telyx-logo-full.png"
        alt="Telyx AI"
        fill
        className={`object-contain ${darkMode ? 'brightness-0 invert' : ''}`}
        priority
      />
    </div>
  );
}

// Icon only (white version for dark backgrounds)
export function TelyxIcon({ className = 'w-8 h-8', darkMode = false }) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/telyx-logo-icon-white.png"
        alt="Telyx AI"
        fill
        className={`object-contain ${!darkMode ? 'brightness-0' : ''}`}
        priority
      />
    </div>
  );
}

// Compact version for sidebar - full logo scaled appropriately
export function TelyxLogoCompact({ darkMode = false }) {
  return (
    <div className="relative h-8" style={{ width: '120px' }}>
      <Image
        src="/telyx-logo-full.png"
        alt="Telyx AI"
        fill
        className={`object-contain object-left ${darkMode ? 'brightness-0 invert' : ''}`}
        priority
      />
    </div>
  );
}

// Text only - deprecated, use TelyxLogoFull instead
export function TelyxLogoText({ className = '', darkMode = false }) {
  return <TelyxLogoFull className={className} darkMode={darkMode} />;
}

export default TelyxLogoFull;
