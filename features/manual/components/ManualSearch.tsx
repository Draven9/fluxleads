import React from 'react';
import { Search } from 'lucide-react';

interface ManualSearchProps {
    value: string;
    onChange: (value: string) => void;
}

export const ManualSearch: React.FC<ManualSearchProps> = ({ value, onChange }) => {
    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg leading-5 bg-white dark:bg-slate-800 placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-slate-900 dark:text-white transition duration-150 ease-in-out"
                placeholder="Buscar no manual..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};
