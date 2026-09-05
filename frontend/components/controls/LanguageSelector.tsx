'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageOption } from '@/types/language';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (langCode: string) => void;
  className?: string;
}

export function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  className,
}: LanguageSelectorProps) {
  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)}>
      <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      <select
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        aria-label="Select Assistant Language"
        className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
      >
        {SUPPORTED_LANGUAGES.map((lang: LanguageOption) => (
          <option key={lang.code} value={lang.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
