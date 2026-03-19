import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const FINISH_EVENTS = new Set([
  'FINISH',
  'FINISH_ONLY_WABA',
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
]);

const CANCEL_EVENTS = new Set([
  'CANCEL',
  'CANCELLED',
]);

const WHATSAPP_EMBEDDED_SIGNUP_SCOPE = 'business_management,whatsapp_business_management,whatsapp_business_messaging';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMetaMessageOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();

    return hostname === 'facebook.com' || hostname.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

function isSameOriginMessage(origin) {
  if (typeof window === 'undefined' || !origin || typeof origin !== 'string') {
    return false;
  }

  return origin === window.location.origin;
}

function normalizeEmbeddedSignupPayload(payload = {}) {
  const rawPayload = isPlainObject(payload) ? payload : {};
  const rawData = isPlainObject(rawPayload.data) ? rawPayload.data : rawPayload;

  return {
    type: rawPayload.type || null,
    event: rawPayload.event || null,
    version: rawPayload.version || null,
    wabaId: rawData.waba_id || rawData.wabaId || null,
    phoneNumberId: rawData.phone_number_id || rawData.phoneNumberId || null,
    metaBusinessId: rawData.business_id || rawData.businessId || rawData.meta_business_id || rawData.metaBusinessId || null,
    displayPhoneNumber: rawData.display_phone_number || rawData.displayPhoneNumber || rawData.phone_number || rawData.phoneNumber || null,
    currentStep: rawData.current_step || rawData.currentStep || null,
    rawPayload,
  };
}

function getEmbeddedSignupLocale() {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en_US';
  }

  const [language = 'en', region = 'US'] = String(navigator.language).split('-');
  return `${language.toLowerCase()}_${region.toUpperCase()}`;
}

function buildEmbeddedSignupPopupUrl({ appId, configId, graphApiVersion, redirectUri, sessionId }) {
  const version = String(graphApiVersion || 'v22.0');
  const params = new URLSearchParams({
    app_id: appId,
    client_id: appId,
    config_id: configId,
    display: 'popup',
    response_type: 'code',
    override_default_response_type: 'true',
    redirect_uri: redirectUri,
    fallback_redirect_uri: redirectUri,
    scope: WHATSAPP_EMBEDDED_SIGNUP_SCOPE,
    extras: JSON.stringify({
      sessionInfoVersion: '3',
      version: 'v3',
      setup: {},
    }),
    locale: getEmbeddedSignupLocale(),
    state: sessionId,
  });

  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}

function buildTelemetrySnapshot(value, depth = 0) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 2000 ? `${value.slice(0, 2000)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, 10);
    if (depth >= 2) {
      return items.map((item) => typeof item);
    }

    return items.map((item) => buildTelemetrySnapshot(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  const entries = Object.entries(value).slice(0, 20);
  if (depth >= 2) {
    return Object.fromEntries(entries.map(([key, item]) => [key, typeof item]));
  }

  return Object.fromEntries(entries.map(([key, item]) => [key, buildTelemetrySnapshot(item, depth + 1)]));
}

function extractAuthorizationCodeFromString(messageData) {
  if (typeof messageData !== 'string') {
    return null;
  }

  const trimmedValue = messageData.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
    try {
      return extractAuthorizationCode(JSON.parse(trimmedValue));
    } catch {
      // Fall through to query-string style parsing.
    }
  }

  const candidates = [trimmedValue];

  try {
    const decoded = decodeURIComponent(trimmedValue);
    if (decoded !== trimmedValue) {
      candidates.push(decoded);
    }
  } catch {
    // Keep the original value only.
  }

  for (const candidate of candidates) {
    if (!candidate.includes('code=')) {
      continue;
    }

    const normalizedValue = candidate.replace(/^[?#]/, '');
    const params = new URLSearchParams(normalizedValue);
    let code = params.get('code');

    if (!code) {
      const nestedData = params.get('data');
      if (nestedData) {
        code = extractAuthorizationCode(nestedData);
      }
    }

    if (code) {
      return code;
    }
  }

  return null;
}

function extractAuthorizationCode(payload, seen = new WeakSet()) {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return extractAuthorizationCodeFromString(payload);
  }

  if (!isPlainObject(payload)) {
    return null;
  }

  if (seen.has(payload)) {
    return null;
  }

  seen.add(payload);

  const directCandidates = [
    payload.code,
    payload.authorization_code,
    payload.authorizationCode,
    payload.authCode,
    payload?.authResponse?.code,
    payload?.authResponse?.authorizationCode,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const nestedCandidates = [
    payload.data,
    payload.payload,
    payload.response,
    payload.params,
    payload.authResponse,
    payload.message,
  ];

  for (const candidate of nestedCandidates) {
    const code = extractAuthorizationCode(candidate, seen);
    if (code) {
      return code;
    }
  }

  return null;
}

async function cancelEmbeddedSignupSession({ sessionId, reason, currentStep, eventPayload }) {
  if (!sessionId) {
    return;
  }

  try {
    await apiClient.post('/api/integrations/whatsapp/embedded-signup/cancel', {
      sessionId,
      reason,
      currentStep,
      eventPayload,
    });
  } catch (error) {
    // Session cancellation is best-effort. The backend also has TTL cleanup semantics.
  }
}

export function useWhatsAppEmbeddedSignup({
  onCancel,
  onError,
  onSuccess,
} = {}) {
  const queryClient = useQueryClient();
  const [flowState, setFlowState] = useState('idle');
  const [flowError, setFlowError] = useState(null);

  const listenerRef = useRef(null);
  const sessionRef = useRef(null);
  const codeRef = useRef(null);
  const eventPayloadRef = useRef(null);
  const completionStartedRef = useRef(false);
  const completionTimeoutRef = useRef(null);
  const settledRef = useRef(false);

  const cleanupListener = useCallback(() => {
    if (listenerRef.current && typeof window !== 'undefined') {
      window.removeEventListener('message', listenerRef.current);
      listenerRef.current = null;
    }
  }, []);

  const clearCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current && typeof window !== 'undefined') {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  const trackTelemetry = useCallback(async (stage, details = {}) => {
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) {
      return;
    }

    try {
      await apiClient.post('/api/integrations/whatsapp/embedded-signup/telemetry', {
        sessionId,
        stage,
        details: buildTelemetrySnapshot({
          ...details,
          flowState: details.flowState || flowState,
        }),
      });
    } catch {
      // Telemetry is best-effort only.
    }
  }, [flowState]);

  const resetFlow = useCallback(() => {
    cleanupListener();
    clearCompletionTimeout();
    sessionRef.current = null;
    codeRef.current = null;
    eventPayloadRef.current = null;
    completionStartedRef.current = false;
    settledRef.current = false;
    setFlowError(null);
    setFlowState('idle');
  }, [cleanupListener, clearCompletionTimeout]);

  const finalizeError = useCallback((error) => {
    settledRef.current = true;
    cleanupListener();
    clearCompletionTimeout();
    setFlowError(error);
    setFlowState('error');
    onError?.(error);
  }, [cleanupListener, clearCompletionTimeout, onError]);

  const finalizeCancel = useCallback(async (payload, reason = 'USER_CANCELLED') => {
    if (settledRef.current) {
      return;
    }

    settledRef.current = true;
    cleanupListener();
    clearCompletionTimeout();
    setFlowError(null);
    setFlowState('cancelled');

    await cancelEmbeddedSignupSession({
      sessionId: sessionRef.current?.sessionId,
      reason,
      currentStep: payload?.currentStep || null,
      eventPayload: payload?.rawPayload || null,
    });

    onCancel?.(payload || null);
  }, [cleanupListener, clearCompletionTimeout, onCancel]);

  const armCompletionTimeout = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    clearCompletionTimeout();

    completionTimeoutRef.current = window.setTimeout(async () => {
      if (settledRef.current || completionStartedRef.current || !eventPayloadRef.current || codeRef.current) {
        return;
      }

      await trackTelemetry('completion_timeout', {
        hasEventPayload: true,
        hasAuthorizationCode: false,
        event: eventPayloadRef.current?.event || null,
        currentStep: eventPayloadRef.current?.currentStep || null,
      });

      const error = new Error('Meta completed the WhatsApp signup flow, but Telyx did not receive the authorization code needed to finish the connection.');
      error.code = 'META_AUTH_CODE_MISSING';
      finalizeError(error);
    }, 8000);
  }, [clearCompletionTimeout, finalizeError, trackTelemetry]);

  const completeIfReady = useCallback(async () => {
    if (completionStartedRef.current || !sessionRef.current?.sessionId || (!codeRef.current && !eventPayloadRef.current)) {
      return;
    }

    completionStartedRef.current = true;
    clearCompletionTimeout();
    setFlowError(null);
    setFlowState('completing');

    try {
      const response = await apiClient.post('/api/integrations/whatsapp/embedded-signup/complete', {
        sessionId: sessionRef.current.sessionId,
        code: codeRef.current,
        eventPayload: eventPayloadRef.current?.rawPayload || null,
      });

      settledRef.current = true;
      cleanupListener();
      clearCompletionTimeout();
      setFlowState('success');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integrations'] }),
        queryClient.invalidateQueries({ queryKey: ['integrations', 'whatsapp', 'status'] }),
      ]);

      onSuccess?.(response.data?.connection || null);
    } catch (error) {
      completionStartedRef.current = false;
      finalizeError(error);
    }
  }, [cleanupListener, clearCompletionTimeout, finalizeError, onSuccess, queryClient]);

  const startEmbeddedSignup = useCallback(async () => {
    if (flowState === 'preparing' || flowState === 'loading_sdk' || flowState === 'launching' || flowState === 'awaiting_completion' || flowState === 'completing') {
      return;
    }

    cleanupListener();
    clearCompletionTimeout();
    sessionRef.current = null;
    codeRef.current = null;
    eventPayloadRef.current = null;
    completionStartedRef.current = false;
    settledRef.current = false;
    setFlowError(null);
    setFlowState('preparing');

    try {
      const redirectUri = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/meta/whatsapp-callback`
        : null;
      const sessionResponse = await apiClient.post('/api/integrations/whatsapp/embedded-signup/session', {
        redirectUri,
      });
      const sessionData = sessionResponse.data || {};

      sessionRef.current = sessionData;
      setFlowState('launching');

      listenerRef.current = async (event) => {
        if (isSameOriginMessage(event.origin) && isPlainObject(event.data)) {
          if (event.data.type === 'TELYX_META_WHATSAPP_CODE' && event.data.code) {
            void trackTelemetry('same_origin_code_message', {
              origin: event.origin,
              hasAuthorizationCode: true,
              payload: event.data,
            });
            codeRef.current = event.data.code;
            clearCompletionTimeout();
            setFlowState(eventPayloadRef.current ? 'completing' : 'awaiting_completion');
            await completeIfReady();
            return;
          }

          if (event.data.type === 'TELYX_META_WHATSAPP_ERROR') {
            void trackTelemetry('same_origin_error_message', {
              origin: event.origin,
              payload: event.data,
            });
            const error = new Error(event.data.errorMessage || 'Meta WhatsApp onboarding did not return an authorization code.');
            finalizeError(error);
            return;
          }
        }

        if (!isMetaMessageOrigin(event.origin)) {
          return;
        }

        const authorizationCode = extractAuthorizationCode(event.data);

        if (authorizationCode) {
          void trackTelemetry('meta_message_with_code', {
            origin: event.origin,
            hasAuthorizationCode: true,
            payload: event.data,
          });
          codeRef.current = authorizationCode;
          clearCompletionTimeout();
          setFlowState(eventPayloadRef.current ? 'completing' : 'awaiting_completion');
          await completeIfReady();
        }

        let parsedPayload = event.data;
        if (typeof parsedPayload === 'string') {
          try {
            parsedPayload = JSON.parse(parsedPayload);
          } catch {
            return;
          }
        }

        if (!isPlainObject(parsedPayload) || parsedPayload.type !== 'WA_EMBEDDED_SIGNUP') {
          return;
        }

        const normalizedPayload = normalizeEmbeddedSignupPayload(parsedPayload);
        const normalizedEventName = String(normalizedPayload.event || '').toUpperCase();

        if (FINISH_EVENTS.has(normalizedEventName)) {
          void trackTelemetry('finish_event_received', {
            origin: event.origin,
            hasAuthorizationCode: Boolean(codeRef.current),
            payload: normalizedPayload.rawPayload,
          });
          eventPayloadRef.current = normalizedPayload;
          setFlowState(codeRef.current ? 'completing' : 'awaiting_completion');
          if (!codeRef.current) {
            armCompletionTimeout();
          }
          await completeIfReady();
          return;
        }

        if (CANCEL_EVENTS.has(normalizedEventName)) {
          await finalizeCancel(normalizedPayload, normalizedEventName || 'USER_CANCELLED');
          return;
        }

        const error = new Error('Meta WhatsApp onboarding returned an unexpected event.');
        error.metaEvent = normalizedPayload;
        finalizeError(error);
      };

      window.addEventListener('message', listenerRef.current);

      const popupUrl = buildEmbeddedSignupPopupUrl({
        appId: sessionData.appId,
        configId: sessionData.configId,
        graphApiVersion: sessionData.graphApiVersion,
        redirectUri: sessionData.redirectUri,
        sessionId: sessionData.sessionId,
      });
      const popup = window.open(
        popupUrl,
        'telyx-whatsapp-embedded-signup',
        'width=680,height=820,menubar=no,toolbar=no,status=no,scrollbars=yes,resizable=yes'
      );

      void trackTelemetry('manual_popup_opened', {
        popupUrl,
        redirectUri: sessionData.redirectUri,
      });

      if (!popup) {
        throw new Error('The Meta signup popup was blocked by the browser. Please allow popups and try again.');
      }

      popup.focus();
      setFlowState('awaiting_completion');
    } catch (error) {
      finalizeError(error);
    }
  }, [armCompletionTimeout, cleanupListener, clearCompletionTimeout, completeIfReady, finalizeCancel, finalizeError, flowState, trackTelemetry]);

  useEffect(() => {
    return () => {
      cleanupListener();
    };
  }, [cleanupListener]);

  return {
    flowState,
    flowError,
    isBusy: ['preparing', 'loading_sdk', 'launching', 'awaiting_completion', 'completing'].includes(flowState),
    startEmbeddedSignup,
    resetFlow,
  };
}

export default useWhatsAppEmbeddedSignup;
