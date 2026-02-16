import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyLabel, PHONE_OUTBOUND_V1_LABELS } from './labelClassifier.js';
import { detectOffTopic, shouldOfferAgentCallback } from './policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLOWS_PATH = path.join(__dirname, 'flows.v1.json');

const FLOWS_CONFIG = JSON.parse(fs.readFileSync(FLOWS_PATH, 'utf8'));

const DEFAULT_CALL_TYPE = 'BILLING_REMINDER';

function safeCallType(callType = '') {
  const normalized = String(callType || '').toUpperCase();
  if (FLOWS_CONFIG.callTypes[normalized]) {
    return normalized;
  }
  return DEFAULT_CALL_TYPE;
}

function getFlowByType(callType) {
  const safeType = safeCallType(callType);
  return {
    callType: safeType,
    flow: FLOWS_CONFIG.callTypes[safeType],
    defaults: FLOWS_CONFIG.defaults || {}
  };
}

function normalizeState(flowState, callType, defaults = {}) {
  return {
    started: Boolean(flowState?.started),
    turn: Number.isFinite(flowState?.turn) ? flowState.turn : 0,
    retryCount: Number.isFinite(flowState?.retryCount) ? flowState.retryCount : 0,
    closed: Boolean(flowState?.closed),
    lastLabel: flowState?.lastLabel || null,
    callType: safeCallType(flowState?.callType || callType),
    maxSteps: Number.isFinite(flowState?.maxSteps) ? flowState.maxSteps : (defaults.maxSteps || 3),
    maxRetry: Number.isFinite(flowState?.maxRetry) ? flowState.maxRetry : (defaults.maxRetry || 2)
  };
}

function renderTemplate(template = '', templateVars = {}) {
  return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = templateVars[key];
    return value == null ? '' : String(value);
  }).trim();
}

function buildTemplateVars(business = {}, callSession = {}) {
  return {
    businessName: business.name || 'İşletme',
    customerName: callSession.customerName || 'Müşteri',
    customerPhone: callSession.phoneE164 || callSession.callerPhone || '',
    callType: callSession.callType || DEFAULT_CALL_TYPE
  };
}

function buildCloseActions({ label, callType, callSession, state, offTopicDetected = false }) {
  const actions = [
    {
      name: 'log_call_outcome',
      args: {
        label,
        callType,
        callId: callSession.callId || callSession.conversationId || null,
        sessionId: callSession.sessionId || callSession.callId || null,
        metadata: {
          offTopicDetected,
          turn: state.turn,
          retryCount: state.retryCount
        }
      }
    }
  ];

  if (label === 'ASK_AGENT') {
    actions.push({
      name: 'create_callback',
      args: {
        customerName: callSession.customerName || 'Müşteri',
        customerPhone: callSession.phoneE164 || callSession.callerPhone || null,
        topic: `PHONE_OUTBOUND_V1_${callType}`
      }
    });
  }

  if (label === 'DONT_CALL') {
    actions.push({
      name: 'set_do_not_call',
      args: {
        phoneE164: callSession.phoneE164 || callSession.callerPhone || null,
        source: 'PHONE_OUTBOUND_V1'
      }
    });
  }

  if (label === 'LATER') {
    actions.push({
      name: 'schedule_followup',
      args: {
        customerName: callSession.customerName || 'Müşteri',
        customerPhone: callSession.phoneE164 || callSession.callerPhone || null,
        callType,
        delayHours: 24
      }
    });
  }

  return actions;
}

function closeState(baseState, label) {
  return {
    ...baseState,
    closed: true,
    started: true,
    turn: baseState.turn + 1,
    lastLabel: label
  };
}

function continueState(baseState, label) {
  return {
    ...baseState,
    started: true,
    turn: baseState.turn + 1,
    lastLabel: label
  };
}

export async function runFlowStep({
  business,
  callSession,
  userUtterance,
  dtmfDigits,
  flowState,
  classifierMode = 'KEYWORD_ONLY'
} = {}) {
  const { callType, flow, defaults } = getFlowByType(callSession?.callType || flowState?.callType);
  const state = normalizeState(flowState, callType, defaults);
  const templateVars = buildTemplateVars(business, { ...callSession, callType });

  if (state.closed) {
    const closedScript = renderTemplate(flow.closingByLabel?.[state.lastLabel || 'UNKNOWN'], templateVars);
    return {
      nextScriptText: closedScript || renderTemplate(flow.closingByLabel?.UNKNOWN, templateVars),
      nextState: state,
      label: state.lastLabel || 'UNKNOWN',
      actions: [],
      isTerminal: true
    };
  }

  if (!state.started) {
    const opening = renderTemplate(flow.opening, templateVars);
    const cta = renderTemplate(flow.cta, templateVars);

    return {
      nextScriptText: `${opening} ${cta}`.trim(),
      nextState: continueState(state, 'UNKNOWN'),
      label: 'UNKNOWN',
      actions: [],
      isTerminal: false
    };
  }

  const allowedLabels = Array.isArray(flow.allowedLabels) && flow.allowedLabels.length > 0
    ? flow.allowedLabels
    : PHONE_OUTBOUND_V1_LABELS;

  let label = await classifyLabel({
    utterance: userUtterance,
    dtmfDigits,
    dtmfMap: flow.dtmfMap || null,
    allowedLabels,
    classifierMode
  });

  const offTopicDetected = detectOffTopic(userUtterance || '');
  if (offTopicDetected && label !== 'ASK_AGENT' && shouldOfferAgentCallback(userUtterance || '')) {
    label = 'ASK_AGENT';
  }

  if (offTopicDetected && label !== 'ASK_AGENT') {
    const offTopicScript = renderTemplate(flow.offTopicRedirect, templateVars);

    if (state.retryCount < state.maxRetry && state.turn < state.maxSteps) {
      return {
        nextScriptText: offTopicScript,
        nextState: {
          ...continueState(state, 'UNKNOWN'),
          retryCount: state.retryCount + 1
        },
        label: 'UNKNOWN',
        actions: [],
        isTerminal: false
      };
    }

    const closingScript = renderTemplate(flow.closingByLabel?.UNKNOWN, templateVars);
    return {
      nextScriptText: closingScript,
      nextState: closeState(state, 'UNKNOWN'),
      label: 'UNKNOWN',
      actions: buildCloseActions({
        label: 'UNKNOWN',
        callType,
        callSession,
        state,
        offTopicDetected: true
      }),
      isTerminal: true
    };
  }

  if (label !== 'UNKNOWN') {
    const closingScript = renderTemplate(flow.closingByLabel?.[label], templateVars)
      || renderTemplate(flow.closingByLabel?.UNKNOWN, templateVars);

    return {
      nextScriptText: closingScript,
      nextState: closeState(state, label),
      label,
      actions: buildCloseActions({
        label,
        callType,
        callSession,
        state,
        offTopicDetected
      }),
      isTerminal: true
    };
  }

  const canRetry = state.retryCount < state.maxRetry && state.turn < state.maxSteps;
  if (canRetry) {
    const retryScript = renderTemplate(flow.cta, templateVars);
    return {
      nextScriptText: retryScript,
      nextState: {
        ...continueState(state, 'UNKNOWN'),
        retryCount: state.retryCount + 1
      },
      label: 'UNKNOWN',
      actions: [],
      isTerminal: false
    };
  }

  const unknownClosing = renderTemplate(flow.closingByLabel?.UNKNOWN, templateVars);
  return {
    nextScriptText: unknownClosing,
    nextState: closeState(state, 'UNKNOWN'),
    label: 'UNKNOWN',
    actions: buildCloseActions({
      label: 'UNKNOWN',
      callType,
      callSession,
      state,
      offTopicDetected
    }),
    isTerminal: true
  };
}

export default {
  runFlowStep
};
