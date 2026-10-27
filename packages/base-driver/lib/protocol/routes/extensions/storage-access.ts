import type {MethodMap} from '@appium/types';

import type {ProtocolDriver} from '../protocol-driver';

/**
 * Storage Access.
 * @see https://privacycg.github.io/storage-access/
 */
export const STORAGE_ACCESS_ROUTES = {
  '/session/:sessionId/storageaccess': {
    POST: {command: 'setStorageAccess', payloadParams: {required: ['blocked', 'origin']}},
  },
} as const satisfies MethodMap<ProtocolDriver>;
