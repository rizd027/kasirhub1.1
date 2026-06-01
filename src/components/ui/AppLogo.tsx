'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface AppLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'sidebar' | 'desktop-brand' | 'mobile-brand' | 'splash';
  iconClassName?: string;
}

export function AppLogo({
  variant = 'sidebar',
  className,
  iconClassName,
  ...props
}: AppLogoProps) {
  // SVG Path from kasirhub-logo.svg
  const svgPath = "M6.984375 2.9863281 A 1.0001 1.0001 0 0 0 6 4L6 7L5 7C3.3550302 7 2 8.3550302 2 10L2 24C2 25.64497 3.3550302 27 5 27L25 27C26.64497 27 28 25.64497 28 24L28 10C28 8.3550302 26.64497 7 25 7L24 7L24 4 A 1.0001 1.0001 0 0 0 22.984375 2.9863281 A 1.0001 1.0001 0 0 0 22 4L22 7L20 7L20 4C20 3.448 19.552 3 19 3L18 3C17.448 3 17 3.448 17 4L17 7L15 7L15 4C15 3.448 14.552 3 14 3L11 3C10.448 3 10 3.448 10 4L10 7L8 7L8 4 A 1.0001 1.0001 0 0 0 6.984375 2.9863281 z M 5 9L6.8320312 9 A 1.0001 1.0001 0 0 0 7.1582031 9L22.832031 9 A 1.0001 1.0001 0 0 0 23.158203 9L25 9C25.56503 9 26 9.4349698 26 10L26 24C26 24.56503 25.56503 25 25 25L5 25C4.4349698 25 4 24.56503 4 24L4 10C4 9.4349698 4.4349698 9 5 9 z M 6.984375 10.986328 A 1.0001 1.0001 0 0 0 6.8398438 11L6 11L6 12L6 13L6 22 A 1.0001 1.0001 0 1 0 8 22L8 13L8 12L8 11L7.1542969 11 A 1.0001 1.0001 0 0 0 6.984375 10.986328 z M 22.984375 10.986328 A 1.0001 1.0001 0 0 0 22.839844 11L22 11L22 12L22 13L22 22 A 1.0001 1.0001 0 1 0 24 22L24 13L24 12L24 11L23.154297 11 A 1.0001 1.0001 0 0 0 22.984375 10.986328 z M 10 11L10 22C10 22.552 10.448 23 11 23L14 23C14.552 23 15 22.552 15 22L15 11L10 11 z M 17 11L17 22C17 22.552 17.448 23 18 23L19 23C19.552 23 20 22.552 20 22L20 11L17 11 z";

  if (variant === 'sidebar') {
    return (
      <div
        className={cn(
          "size-11 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-100/50 hover:shadow-indigo-300/80 active:scale-95 transition-all duration-300 border border-white/10 relative overflow-hidden group select-none shrink-0",
          className
        )}
        {...props}
      >
        {/* Sleek gloss effect overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 30 30"
          className={cn(
            "size-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform duration-300 group-hover:scale-110",
            iconClassName
          )}
        >
          <path d={svgPath} fill="currentColor" />
        </svg>
      </div>
    );
  }

  if (variant === 'desktop-brand') {
    return (
      <div
        className={cn(
          "size-12 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 border border-indigo-400/25 relative overflow-hidden group hover:scale-[1.03] active:scale-95 transition-all duration-300 select-none shrink-0",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 30 30"
          className={cn(
            "size-6.5 text-white drop-shadow-[0_2px_5px_rgba(79,70,229,0.3)] transition-transform duration-300 group-hover:scale-110",
            iconClassName
          )}
        >
          <path d={svgPath} fill="currentColor" />
        </svg>
      </div>
    );
  }

  if (variant === 'mobile-brand') {
    return (
      <div
        className={cn(
          "size-16 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200/80 active:scale-95 transition-all duration-300 relative overflow-hidden group border border-indigo-100/50 select-none shrink-0",
          className
        )}
        {...props}
      >
        {/* Subtle decorative concentric circle lines */}
        <div className="absolute size-28 rounded-full border border-white/5 -top-6 -right-6 pointer-events-none" />
        <div className="absolute size-20 rounded-full border border-white/10 -bottom-4 -left-4 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 30 30"
          className={cn(
            "size-9 text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.15)] transition-transform duration-300 group-hover:scale-110",
            iconClassName
          )}
        >
          <path d={svgPath} fill="currentColor" />
        </svg>
      </div>
    );
  }

  // Splash variant
  return (
    <div
      className={cn(
        "relative flex items-center justify-center size-20 select-none shrink-0",
        className
      )}
      {...props}
    >
      {/* Outer breathing aura pulse */}
      <div className="absolute inset-0 bg-indigo-600/35 rounded-2xl blur-xl animate-pulse" />
      
      {/* Decorative pulse ring */}
      <div className="absolute -inset-2.5 bg-indigo-100/10 rounded-[1.75rem] border border-indigo-600/20 animate-ping opacity-75" style={{ animationDuration: '3s' }} />

      {/* Main card containing logo */}
      <div className="relative size-16 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 border border-white/20 overflow-hidden">
        {/* Animated ambient backdrop light */}
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-35 animate-pulse" style={{ animationDuration: '4s' }} />
        
        {/* Breathing logo SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 30 30"
          className={cn(
            "size-9 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] animate-pulse",
            iconClassName
          )}
          style={{ animationDuration: '2s' }}
        >
          <path d={svgPath} fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
