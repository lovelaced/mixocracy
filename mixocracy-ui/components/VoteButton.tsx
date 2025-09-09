'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface VoteButtonProps {
  hasVoted: boolean;
  isLoading: boolean;
  onClick: () => void;
  votes: number;
}

export function VoteButton({ hasVoted, isLoading, onClick, votes }: VoteButtonProps) {
  // Simplified approach - always allow clicking when voted
  // The desktop X button will handle unvoting on desktop
  const handleVoteClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!isLoading) {
      // Add vibration feedback for mobile
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }
      onClick();
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <div className="flex items-center gap-xs md:gap-sm">
        {/* Desktop unvote button - moved to left */}
        <AnimatePresence>
          {hasVoted && (
            <motion.div 
              className="relative"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <button
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all group"
                onClick={onClick}
                disabled={isLoading}
                aria-label="Remove vote"
                type="button"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white/90 text-black text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Remove vote
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/90"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="vote-count text-center">
          <motion.div
            key={votes}
            initial={{ scale: 1 }}
            animate={{ scale: 1 }}
            className="text-sm md:text-base font-semibold"
            layoutId={`votes-${votes}`}
          >
            {votes}
          </motion.div>
          <div className="text-xs text-tertiary hidden md:block">votes</div>
        </div>

        <button
          className={`vote-button ${hasVoted ? 'voted' : ''}`}
          onClick={handleVoteClick}
          disabled={isLoading}
          type="button"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.div
                key="loading"
                className="w-full h-full flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </motion.svg>
              </motion.div>
            ) : hasVoted ? (
              <motion.span
                key="voted"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{ pointerEvents: 'none' }}
              >
                ✓
              </motion.span>
            ) : (
              <motion.span
                key="vote"
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                style={{ pointerEvents: 'none' }}
              >
                ↑
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}