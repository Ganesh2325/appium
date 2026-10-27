import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Device Posture.
 * @see https://www.w3.org/TR/device-posture/
 */
export const DEVICE_POSTURE_ROUTES = {
  '/session/:sessionId/deviceposture': {
    POST: {command: 'setDevicePosture', payloadParams: {required: ['posture']}},
    DELETE: {command: 'clearDevicePosture'},
  },
} as const satisfies MethodMap<ProtocolDriver>;
