// Ornamental icon set for the royal-fantasy design pass — inline SVG, stroke
// uses currentColor so callers control tint via text-* utility classes.
// Deliberately hand-drawn/simple rather than a full icon library import: this
// is a small, fixed vocabulary (pokeball, crest, compass, mountain, flame)
// reused across the marketing pages, not a general-purpose icon system.

import type { CSSProperties } from "react";

interface IconProps {
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function PokeballIcon({ className, strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M2.75 12h6.25M15 12h6.25" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function CrestIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5 19.5 5v6c0 5-3.3 8.6-7.5 10.5C7.8 19.6 4.5 16 4.5 11V5L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 7.5 13.4 10.4 16.6 10.9 14.3 13.2 14.9 16.4 12 14.9 9.1 16.4 9.7 13.2 7.4 10.9 10.6 10.4 12 7.5Z" fill="currentColor" />
    </svg>
  );
}

export function CompassIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15.2 8.8 13 13l-4.2 2.2L11 11l4.2-2.2Z" fill="currentColor" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

export function MountainIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M2.5 18.5 8.8 8l3 4.2L14.4 8l6.6 10.5H2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m8.8 8 1.7 2.4-1.2 1.7-2-2.7L8.8 8Z" fill="currentColor" />
      <path d="m14.4 8 1.9 2.6-1.3 1.8-2.1-3 1.5-1.4Z" fill="currentColor" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5c1 2.4-.4 3.7-1.6 5-1.4 1.5-2.9 3.2-2.9 6a4.5 4.5 0 0 0 9 0c0-1.7-.7-2.8-1.5-3.8.3 1.6-.3 2.6-1.2 3.2-.2-1.5-1-2.2-1.9-3-1-1-1.9-2-.9-7.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}
