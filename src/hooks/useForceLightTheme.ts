import { useEffect } from 'react';

/**
 * Forces light theme while the component is mounted.
 * Restores the previous theme on unmount.
 */
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme') || 'dark';

    root.setAttribute('data-theme', 'light');

    return () => {
      root.setAttribute('data-theme', previous);
    };
  }, []);
}
