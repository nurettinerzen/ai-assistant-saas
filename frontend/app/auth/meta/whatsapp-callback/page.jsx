'use client';

import { useEffect } from 'react';

export default function WhatsAppMetaCallbackPage() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const errorMessage = params.get('error_message') || params.get('error_description') || null;

    if (window.opener && !window.opener.closed) {
      if (code) {
        window.opener.postMessage({
          type: 'TELYX_META_WHATSAPP_CODE',
          code,
        }, window.location.origin);
      } else {
        window.opener.postMessage({
          type: 'TELYX_META_WHATSAPP_ERROR',
          error: error || 'missing_code',
          errorMessage: errorMessage || 'Meta did not return an authorization code.',
        }, window.location.origin);
      }
    }

    window.setTimeout(() => {
      window.close();
    }, 150);
  }, []);

  return (
    <main className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">Completing WhatsApp connection</h1>
        <p className="text-sm text-neutral-600">
          You can close this window if it does not close automatically.
        </p>
      </div>
    </main>
  );
}
