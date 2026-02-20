'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function InfoContent({ title, body, quickSteps, locale }) {
  const quickStepsLabel = locale === 'tr' ? 'Bu sayfada hızlı adımlar' : 'Quick steps on this page';

  const renderBody = () => {
    if (!body) return null;

    if (Array.isArray(body)) {
      return (
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
          {body.map((item, index) => (
            <li key={`tooltip-body-${index}`}>{item}</li>
          ))}
        </ul>
      );
    }

    return body
      .split('\n\n')
      .filter(Boolean)
      .map((paragraph, index) => (
        <p
          key={`tooltip-paragraph-${index}`}
          className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-200"
        >
          {paragraph}
        </p>
      ));
  };

  return (
    <div>
      {title ? (
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h4>
      ) : null}

      {renderBody()}

      {Array.isArray(quickSteps) && quickSteps.length > 0 ? (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {quickStepsLabel}
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
            {quickSteps.map((step, index) => (
              <li key={`quick-step-${index}`}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export default function InfoTooltip({
  title,
  body,
  quickSteps,
  locale = 'tr',
  className,
  triggerClassName,
  ariaLabel,
}) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimeout = useRef(null);

  const handleOpen = useCallback(() => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    closeTimeout.current = setTimeout(() => setOpen(false), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateBreakpoint = () => setIsDesktop(mediaQuery.matches);

    updateBreakpoint();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateBreakpoint);
      return () => mediaQuery.removeEventListener('change', updateBreakpoint);
    }

    mediaQuery.addListener(updateBreakpoint);
    return () => mediaQuery.removeListener(updateBreakpoint);
  }, []);

  const resolvedAriaLabel = ariaLabel || (locale === 'tr' ? 'Sayfa hakkında bilgi' : 'Page information');

  const triggerButton = (
    <button
      type="button"
      aria-label={resolvedAriaLabel}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:border-primary-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-600 dark:text-neutral-300 dark:hover:border-primary-400 dark:hover:text-primary-300',
        triggerClassName
      )}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );

  if (!isDesktop) {
    return (
      <div className={className}>
        <Sheet>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <SheetHeader>
              <SheetTitle className="text-left text-neutral-900 dark:text-white">
                {locale === 'tr' ? 'Sayfa Açıklaması' : 'Page Description'}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <InfoContent
                title={title}
                body={body}
                quickSteps={quickSteps}
                locale={locale}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={(v) => { if (v) handleOpen(); else handleClose(); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={resolvedAriaLabel}
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
            onFocus={handleOpen}
            className={cn(
              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:border-primary-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-600 dark:text-neutral-300 dark:hover:border-primary-400 dark:hover:text-primary-300',
              triggerClassName
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[min(92vw,30rem)] rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          <InfoContent
            title={title}
            body={body}
            quickSteps={quickSteps}
            locale={locale}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
