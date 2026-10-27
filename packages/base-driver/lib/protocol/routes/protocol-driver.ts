import type {ExternalDriver} from '@appium/types';

/**
 * Command surface used to typecheck the built-in protocol routes.
 *
 * Most commands come from {@linkcode ExternalDriver}. A few routes call Appium server methods, or
 * deprecated JSONWP commands that have no implementation on the driver interfaces; those are
 * declared here so `required` / `optional` can still be checked.
 */
export interface ProtocolDriver extends ExternalDriver {
  /** `GET /appium/sessions`, implemented by AppiumDriver. */
  getAppiumSessions?(): Promise<unknown>;
  /** `GET /session/:sessionId/appium/commands`, implemented by AppiumDriver. */
  listCommands?(sessionId?: string): Promise<unknown>;
  /** `GET /session/:sessionId/appium/extensions`, implemented by AppiumDriver. */
  listExtensions?(sessionId?: string): Promise<unknown>;
  /** @deprecated JSONWP IME command. */
  availableIMEEngines?(): Promise<unknown>;
  /** @deprecated JSONWP IME command. */
  getActiveIMEEngine?(): Promise<unknown>;
  /** @deprecated JSONWP IME command. */
  isIMEActivated?(): Promise<unknown>;
  /** @deprecated JSONWP IME command. */
  deactivateIMEEngine?(): Promise<void>;
  /**
   * @deprecated JSONWP IME command.
   * @param engine - the IME engine name
   */
  activateIMEEngine?(engine: string): Promise<void>;
  /**
   * @deprecated JSONWP async script response.
   * @param status - response status
   * @param value - response value
   */
  receiveAsyncResponse?(status: unknown, value: unknown): Promise<void>;
}
