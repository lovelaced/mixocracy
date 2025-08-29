import React, { useState, useEffect } from 'react';

interface MobileVoteHintProps {
  show: boolean;
}

const MobileVoteHint: React.FC<MobileVoteHintProps> = ({ show }) => {
  // Track hydration state to avoid SSR mismatches
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Set mounted state
    setIsMounted(true);

    // Check if mobile/touch device
    const checkMobile = () => {
      // Check for touch capability using multiple methods
      const hasTouch = window.matchMedia('(pointer: coarse)').matches || 
                       'ontouchstart' in window || 
                       navigator.maxTouchPoints > 0;
      
      // Also check viewport for responsive behavior
      const isMobileWidth = window.innerWidth < 768;
      
      setIsMobile(hasTouch || isMobileWidth);
    };

    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Don't render on server or if not mounted
  if (!isMounted) {
    return null;
  }

  // Don't render if not mobile or shouldn't show
  if (!isMobile || !show) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-accent-primary text-white py-3 px-4 text-center z-50 shadow-lg">
      <p className="text-sm font-medium">Tap any ✓ to remove your vote</p>
    </div>
  );
};

export default MobileVoteHint;