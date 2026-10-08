import { useSyncExternalStore } from 'react';

/** Tailwind's `md` breakpoint: from here the editor shows sidebars instead of bottom sheets. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/** True while the media query matches; follows changes such as rotating a tablet. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => {
        media.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia(query).matches,
  );
}
