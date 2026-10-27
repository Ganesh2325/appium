import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Selenium/Chromium browser log retrieval.
 */
export const SELENIUM_ROUTES = {
  '/session/:sessionId/se/log': {
    POST: {command: 'getLog', payloadParams: {required: ['type']}},
  },
  '/session/:sessionId/se/log/types': {
    GET: {command: 'getLogTypes'},
  },
} as const satisfies MethodMap<ProtocolDriver>;
