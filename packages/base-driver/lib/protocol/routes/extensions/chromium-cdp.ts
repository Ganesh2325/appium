import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Chromium devtools protocol passthrough.
 * @see https://chromium.googlesource.com/chromium/src/+/master/chrome/test/chromedriver/server/http_handler.cc
 */
export const CHROMIUM_CDP_ROUTES = {
  '/session/:sessionId/:vendor/cdp/execute': {
    POST: {command: 'executeCdp', payloadParams: {required: ['cmd', 'params']}},
  },
} as const satisfies MethodMap<ProtocolDriver>;
