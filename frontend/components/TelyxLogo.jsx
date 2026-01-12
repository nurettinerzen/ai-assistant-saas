/**
 * Telyx Logo Components
 * Using official logo PNG images
 */

import React from 'react';
import Image from 'next/image';

// Full logo with icon and text (for light backgrounds)
export function TelyxLogoFull({ className = '', width = 260, height = 75, darkMode = false }) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/telyx-logo-full.png"
        alt="Telyx AI"
        width={width}
        height={height}
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
export function TelyxLogoCompact({ darkMode = false, width = 140, height = 40 }) {
  return (
    <div className="relative">
      <Image
        src="/telyx-logo-full.png"
        alt="Telyx AI"
        width={width}
        height={height}
        className={`object-contain ${darkMode ? 'brightness-0 invert' : ''}`}
        priority
      />
    </div>
  );
}

// Text only - deprecated, use TelyxLogoFull instead
export function TelyxLogoText({ className = '', darkMode = false }) {
  return <TelyxLogoFull className={className} darkMode={darkMode} />;
}

// White version for dark backgrounds (footer, etc) - uses CSS invert
export function TelyxLogoWhite({ width = 180, height = 50 }) {
  return (
    <div className="relative">
      <Image
        src="/telyx-logo-full.png"
        alt="Telyx AI"
        width={width}
        height={height}
        className="object-contain brightness-0 invert"
        priority
      />
    </div>
  );
}

export default TelyxLogoFull;
