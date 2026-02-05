import React, { useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { Check } from 'lucide-react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
        return (
            <div className="relative flex items-center">
                <input
                    type="checkbox"
                    className={cn(
                        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                        "appearance-none bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 checked:bg-primary-600 checked:border-primary-600",
                        className
                    )}
                    ref={ref}
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                <Check
                    className={cn(
                        "absolute top-0 left-0 w-4 h-4 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity",
                        className
                    )}
                    strokeWidth={3}
                />
            </div>
        );
    }
);
Checkbox.displayName = 'Checkbox';
