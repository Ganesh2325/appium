import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Custom Handlers (user-agent automation).
 * @see https://html.spec.whatwg.org/multipage/system-state.html#user-agent-automation
 */
export const CUSTOM_HANDLERS_ROUTES = {
  '/session/:sessionId/custom-handlers/set-mode': {
    POST: {command: 'setRPHRegistrationMode', payloadParams: {required: ['mode']}},
  },
} as const satisfies MethodMap<ProtocolDriver>;
