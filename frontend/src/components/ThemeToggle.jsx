import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle Theme"
      className={`relative p-2 rounded-xl border transition-all duration-200 flex items-center justify-center ${
        isDark
          ? 'bg-slate-800/80 border-slate-700/80 text-amber-400 hover:bg-slate-700 hover:text-amber-300'
          : 'bg-slate-100 border-slate-300 text-indigo-600 hover:bg-slate-200 hover:text-indigo-700 shadow-sm'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
}
