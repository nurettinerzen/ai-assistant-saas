'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import InfoTooltip from '@/components/InfoTooltip';

export default function PageIntro({
  title,
  subtitle,
  help,
  locale = 'tr',
  actions,
  className,
  titleClassName,
  subtitleClassName,
  contentClassName,
}) {
  const hasHelp = Boolean(help?.tooltipTitle || help?.tooltipBody || help?.quickSteps);

  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className={cn('min-w-0', contentClassName)}>
        <h1 className={cn('text-2xl font-semibold text-neutral-900 dark:text-white', titleClassName)}>
          {title}
        </h1>

        {(subtitle || hasHelp) ? (
          <div className="mt-1 flex items-start gap-2">
            {subtitle ? (
              <p className={cn('text-sm text-neutral-600 dark:text-neutral-400', subtitleClassName)}>
                {subtitle}
              </p>
            ) : null}

            {hasHelp ? (
              <InfoTooltip
                locale={locale}
                title={help?.tooltipTitle}
                body={help?.tooltipBody}
                quickSteps={help?.quickSteps}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
