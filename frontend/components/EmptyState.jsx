/**
 * EmptyState Component
 * Reusable empty state with icon, message, and optional CTA
 */

import React from 'react';
import { Button } from '@/components/ui/button';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {Icon && (
        <div className="mb-4 rounded-full bg-neutral-100 p-4">
          <Icon className="h-8 w-8 text-neutral-400" />
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-500 text-center max-w-md mb-6">
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
