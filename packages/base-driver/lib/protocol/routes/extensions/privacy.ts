import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Global Privacy Control (GPC).
 * @see https://www.w3.org/TR/gpc/
 */
export const PRIVACY_ROUTES = {
  '/session/:sessionId/privacy': {
    GET: {command: 'getGlobalPrivacyControl'},
    POST: {command: 'setGlobalPrivacyControl', payloadParams: {required: ['gpc']}},
  },
} as const satisfies MethodMap<ProtocolDriver>;
