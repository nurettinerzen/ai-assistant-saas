import { describe, expect, it } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';
import { determineTurnOutcome } from '../../src/core/handleIncomingMessage.js';

describe('P0 NOT_FOUND outcome contract', () => {
  it('preserves terminal NOT_FOUND even when guardrail asks for clarification text', () => {
    const outcome = determineTurnOutcome({
      toolLoopResult: {
        _terminalState: ToolOutcome.NOT_FOUND
      },
      guardrailResult: {
        action: 'NEED_MIN_INFO_FOR_TOOL'
      },
      hadToolFailure: false
    });

    expect(outcome).toBe(ToolOutcome.NOT_FOUND);
  });

  it('keeps NEED_MORE_INFO when there is no terminal NOT_FOUND', () => {
    const outcome = determineTurnOutcome({
      toolLoopResult: {
        _terminalState: null
      },
      guardrailResult: {
        action: 'NEED_MIN_INFO_FOR_TOOL'
      },
      hadToolFailure: false
    });

    expect(outcome).toBe(ToolOutcome.NEED_MORE_INFO);
  });
});
