import React from 'react';

export default function Logo({ size = 'large', theme = 'light', className = '' }) {
  const isDark = theme === 'dark';
  const logoSrc = isDark ? '/logos/logo-dark-bg.png' : '/logos/logo-transparent.png';
  const heightClass = size === 'small' ? 'h-8' : size === 'medium' ? 'h-12' : 'h-16';

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <img
        src={logoSrc}
        alt="Vende & más | Hazlo ya, invierte"
        className={`${heightClass} w-auto object-contain`}
      />
    </div>
  );
}

