/**
 * Reusable Modal component with consistent styling
 * 
 * Accessibility Features:
 * - role="dialog" and aria-modal="true" for screen readers
 * - aria-labelledby pointing to modal title
 * - Focus trap to keep keyboard focus within modal
 * - Focus returns to trigger element on close
 * - Escape key closes modal
 */
import React, { useId, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FocusTrap, useFocusReturn } from '@/lib/a11y';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional extra classes for the dialog container */
  className?: string;
  /** Optional extra classes for the body wrapper (useful for scroll/height) */
  bodyClassName?: string;
  /** Optional ID for aria-labelledby (auto-generated if not provided) */
  labelledById?: string;
  /** Optional ID for aria-describedby */
  describedById?: string;
  /** Initial element to focus (CSS selector or false to disable) */
  initialFocus?: string | false;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className,
  bodyClassName,
  labelledById,
  describedById,
  initialFocus,
}) => {
  // Generate unique ID for title if not provided
  const generatedId = useId();
  const titleId = labelledById || `modal-title-${generatedId}`;
  
  // Restore focus to trigger element on close
  useFocusReturn({ enabled: isOpen });

  // Handle Escape key
  const handleEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <FocusTrap 
      active={isOpen} 
      onEscape={handleEscape}
      initialFocus={initialFocus}
      returnFocus={true}
    >
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        onClick={handleBackdropClick}
        aria-hidden="false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={describedById}
          className={cn(
            'bg-white dark:bg-dark-card',
            'border border-slate-200 dark:border-white/10',
            'rounded-2xl shadow-2xl w-full flex flex-col',
            'animate-in zoom-in-95 duration-200',
            sizeClasses[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center shrink-0">
            <h2 
              id={titleId}
              className="text-lg font-bold text-slate-900 dark:text-white font-display"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors focus-visible-ring rounded-lg p-1"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className={cn('p-5', bodyClassName)}>{children}</div>
        </div>
      </div>
    </FocusTrap>
  );
};

// ============ MODAL FORM WRAPPER ============

interface ModalFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export const ModalForm: React.FC<ModalFormProps> = ({ children, className, ...props }) => (
  <form className={cn('space-y-4', className)} {...props}>
    {children}
  </form>
);
