import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { getCleanDomain } from '../utils/pwaLogic';

interface PWAIconProps {
  icon?: string;
  name: string;
  url?: string;
  customIcon?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PWAIcon: React.FC<PWAIconProps> = ({
  icon,
  name,
  url,
  customIcon,
  size = 'sm',
  className = '',
}) => {
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px] rounded',
    sm: 'w-5 h-5 text-xs rounded',
    md: 'w-7 h-7 text-sm rounded-md',
    lg: 'w-9 h-9 text-base rounded-lg',
    xl: 'w-14 h-14 text-xl rounded-xl', // Protagonist Card View (56x56 px)
  }[size];

  const rawCandidate = (customIcon || icon || '').trim();
  const domain = url ? getCleanDomain(url) : '';

  // Build ordered list of candidate icon URLs
  const candidateSources: string[] = [];

  if (rawCandidate) {
    candidateSources.push(rawCandidate);
  }

  if (domain && domain !== 'seu-app.com') {
    const googleS2Favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    if (!candidateSources.includes(googleS2Favicon)) {
      candidateSources.push(googleS2Favicon);
    }
    const duckDuckGoFavicon = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    if (!candidateSources.includes(duckDuckGoFavicon)) {
      candidateSources.push(duckDuckGoFavicon);
    }
  }

  // Reset fallback index when candidate inputs change
  useEffect(() => {
    setCurrentSourceIndex(0);
  }, [rawCandidate, url]);

  const activeSrc = candidateSources[currentSourceIndex] || null;
  const isExhausted = !activeSrc || currentSourceIndex >= candidateSources.length;

  const initial = (name.trim().charAt(0) || 'P').toUpperCase();

  // Consistent color for fallback initial badge based on name string
  const getInitialBg = (str: string) => {
    const hues = [
      'bg-blue-900/60 text-blue-300 border-blue-700/50',
      'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
      'bg-purple-900/60 text-purple-300 border-purple-700/50',
      'bg-amber-900/60 text-amber-300 border-amber-700/50',
      'bg-rose-900/60 text-rose-300 border-rose-700/50',
      'bg-cyan-900/60 text-cyan-300 border-cyan-700/50',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hues[Math.abs(hash) % hues.length];
  };

  // If all image sources fail or no sources exist, render colored initial badge
  if (isExhausted || !activeSrc) {
    return (
      <div
        className={`${sizeClasses} shrink-0 rounded flex items-center justify-center font-bold border ${getInitialBg(name)} ${className}`}
        title={name}
        aria-hidden="true"
      >
        {name ? initial : <Globe className="w-3 h-3 opacity-70" />}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} shrink-0 rounded bg-neutral-900/80 border border-neutral-800 p-0.5 flex items-center justify-center overflow-hidden shadow-xs ${className}`}
    >
      <img
        key={activeSrc}
        src={activeSrc}
        alt={`Ícone de ${name}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="w-full h-full object-contain"
        onError={() => setCurrentSourceIndex((prev) => prev + 1)}
      />
    </div>
  );
};
