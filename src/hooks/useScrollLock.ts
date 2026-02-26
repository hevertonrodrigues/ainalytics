import { useEffect } from 'react';

/**
 * Hook to lock body scroll when a component is mounted.
 * Useful for modals, overlays, or any component that should block interaction with the background.
 */
export function useScrollLock() {
  useEffect(() => {
    // Get original body overflow
    const originalStyle = window.getComputedStyle(document.body).overflow;
    
    // Prevent scrolling on mount
    document.body.style.overflow = 'hidden';
    
    // Re-enable scrolling on unmount
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
}
