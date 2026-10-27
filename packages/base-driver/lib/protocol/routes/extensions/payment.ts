import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Secure Payment Confirmation.
 * @see https://www.w3.org/TR/secure-payment-confirmation/
 */
export const PAYMENT_ROUTES = {
  '/session/:sessionId/secure-payment-confirmation/set-mode': {
    POST: {command: 'setSPCTransactionMode', payloadParams: {required: ['mode']}},
  },
} as const satisfies MethodMap<ProtocolDriver>;
