'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LABELS = {
  tr: {
    today: 'Bugün',
    last7: 'Son 7 Gün',
    last30: 'Son 30 Gün',
    thisMonth: 'Bu Ay',
    placeholder: 'Tarih aralığı seç...',
  },
  en: {
    today: 'Today',
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    thisMonth: 'This month',
    placeholder: 'Select date range...',
  },
};

function DateRangePicker({ dateRange, onDateRangeChange, locale = 'tr', className }) {
  const [open, setOpen] = React.useState(false);
  const labels = LABELS[locale] || LABELS.tr;
  const dateFnsLocale = locale === 'tr' ? tr : enUS;

  const formatRange = () => {
    if (!dateRange?.from) return labels.placeholder;
    if (!dateRange.to) return format(dateRange.from, 'd MMM yyyy', { locale: dateFnsLocale });
    // Same month+year: "15 - 20 Şub 2026"
    if (dateRange.from.getMonth() === dateRange.to.getMonth() && dateRange.from.getFullYear() === dateRange.to.getFullYear()) {
      return `${format(dateRange.from, 'd', { locale: dateFnsLocale })} - ${format(dateRange.to, 'd MMM yyyy', { locale: dateFnsLocale })}`;
    }
    return `${format(dateRange.from, 'd MMM', { locale: dateFnsLocale })} - ${format(dateRange.to, 'd MMM yyyy', { locale: dateFnsLocale })}`;
  };

  const handlePreset = (preset) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from, to;
    switch (preset) {
      case 'today':
        from = today; to = today; break;
      case 'last7':
        from = new Date(today.getTime() - 6 * 86400000); to = today; break;
      case 'last30':
        from = new Date(today.getTime() - 29 * 86400000); to = today; break;
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1); to = today; break;
      default:
        from = undefined; to = undefined;
    }
    onDateRangeChange({ from, to });
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onDateRangeChange({ from: undefined, to: undefined });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal h-9',
            !dateRange?.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{formatRange()}</span>
          {dateRange?.from && (
            <X
              className="ml-2 h-3 w-3 shrink-0 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-1.5 p-3 border-b flex-wrap">
          {[
            ['today', labels.today],
            ['last7', labels.last7],
            ['last30', labels.last30],
            ['thisMonth', labels.thisMonth],
          ].map(([key, label]) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={onDateRangeChange}
          numberOfMonths={2}
          locale={dateFnsLocale}
          disabled={{ after: new Date() }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

DateRangePicker.displayName = 'DateRangePicker';

export { DateRangePicker };
