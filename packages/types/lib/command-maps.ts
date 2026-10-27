import type {ConditionalPick, MultidimensionalReadonlyArray} from 'type-fest';

import type {CheckedExecuteParams, CheckedPayload, FunctionParams, PluginPayloadStart} from './command-map-params';
import type {Driver, DriverCommand} from './driver';
import type {Plugin, PluginCommand} from './plugin';
import type {StringRecord} from './util';

/**
 * Defines the shape of a payload for a {@linkcode MethodDef}.
 */
export interface PayloadParams {
  wrap?: string;
  unwrap?: string;
  required?: ReadonlyArray<string> | MultidimensionalReadonlyArray<string, 2>;
  optional?: ReadonlyArray<string>;
  validate?: (obj: any, protocol: string) => boolean | string | undefined;
  makeArgs?: (obj: any) => any;
}
/**
 * A mapping of URL paths to HTTP methods to either a {@linkcode DriverMethodDef} or {@linkcode PluginMethodDef}.
 *
 * Extensions can define new methods for the Appium server to map to command names, of the same
 * format as used in Appium's `routes.js`.
 *
 * `required` and `optional` are checked against the command when `T` is a specific driver or plugin
 * and the map is written with literal parameter lists (`as const satisfies MethodMap<MyDriver>` or an
 * annotation). Parameters are passed **in order**: every `required` name must be a required function
 * parameter, then every `optional` name must be optional (a `?` parameter, a parameter whose type
 * includes `undefined`, or a parameter the function does not declare). Further parameters — usually
 * URL parameters such as `elementId`, with `sessionId` last — are not checked. Plugin commands skip
 * a leading `(next, driver)` pair when the method is declared that way.
 *
 * The check is skipped when `makeArgs` builds the argument list, when `required` is several
 * alternative sets of different lengths, or when the command is a rest/`any[]` parameter list
 * (optionality is not visible on those types). Overloaded commands are checked against the last
 * overload. The base {@linkcode Driver} and {@linkcode Plugin} types are not checked, so a map for
 * a concrete extension stays assignable to `MethodMap<Driver>` / `PluginClass`. {@linkcode AnyMethodMap}
 * does not perform this check either; use it when merging maps from several extensions.
 *
 * @example
 * ```ts
 * const newMethodMap = {
 *   '/session/:sessionId/foo': {
 *     POST: {
 *       command: 'doFoo',
 *       payloadParams: {required: ['a', 'b'], optional: ['c']},
 *     },
 *   },
 * } as const satisfies MethodMap<MyDriver>;
 *
 * // required parameters first, then optional ones; URL params may follow
 * async doFoo(a: string, b: string, c?: string) {}
 * ```
 */
export type MethodMap<T extends Plugin | Driver> = T extends Plugin
  ? CheckedOrLooseMethodMap<T, 'plugin'>
  : T extends Driver
    ? CheckedOrLooseMethodMap<T, 'driver'>
    : never;

/**
 * Route table whose commands are not checked against a single extension.
 *
 * This is the merged `newMethodMap` passed to the Appium HTTP server. A {@linkcode MethodMap}
 * for one driver or plugin is assignable to this type.
 */
export type AnyMethodMap = DriverMethodMap<Driver>;

/**
 * A {@linkcode MethodMap} for a {@linkcode Driver}.
 *
 * This is the unchecked route shape (any command name, no parameter comparison). Authoring a map
 * should use {@linkcode MethodMap}, which checks `required` and `optional`.
 */
export interface DriverMethodMap<T extends Driver> {
  [key: string]: {
    GET?: DriverMethodDef<T>;
    POST?: DriverMethodDef<T>;
    DELETE?: DriverMethodDef<T>;
  };
}

/**
 * Both {@linkcode DriverMethodDef} and {@linkcode PluginMethodDef} share these properties.
 */
export interface BaseMethodDef {
  /**
   * If true, this `Method` will never proxy.
   */
  readonly neverProxy?: boolean;
  /**
   * Specifies shape of payload
   */
  readonly payloadParams?: PayloadParams;
  /**
   * If true, this `Method` will be removed and should not be used by clients
   */
  readonly deprecated?: boolean;
  /**
   * Any additional info string or comments to this command.
   */
  readonly info?: string;
}

/**
 * A definition of an exposed API command in a {@linkcode Driver}.
 */
export interface DriverMethodDef<T extends Driver, D extends boolean = boolean> extends BaseMethodDef {
  /**
   * Name of the command.
   */
  readonly command?: D extends true ? string : keyof ConditionalPick<Required<T>, DriverCommand>;
}

/**
 * A definition of an exposed API command in a {@linkcode Plugin}.
 */
export interface PluginMethodDef<T extends Plugin> extends BaseMethodDef {
  /**
   * Name of the command.
   */
  readonly command?: keyof ConditionalPick<Required<T>, PluginCommand>;
}

/**
 * A mapping of URL paths to HTTP methods to {@linkcode PluginMethodDef}.
 *
 * Unlike {@linkcode MethodMap}, this type does not check `required` / `optional` against the
 * command signature. Prefer {@linkcode MethodMap} when authoring an extension.
 */
export interface PluginMethodMap<T extends Plugin> {
  [key: string]: {
    GET?: PluginMethodDef<T>;
    POST?: PluginMethodDef<T>;
    DELETE?: PluginMethodDef<T>;
  };
}

type CommandNames<T, Kind> = keyof ConditionalPick<Required<T>, Kind> & string;

type CommandFn<T, K extends string> = K extends keyof T
  ? NonNullable<Required<T>[K]> extends infer Fn
    ? Fn extends (...args: any) => any
      ? Fn
      : never
    : never
  : never;

type PayloadStart<T, Fn> = T extends Plugin ? PluginPayloadStart<FunctionParams<Fn>> : 0;

type CheckedHttpDef<T, K extends string> = {
  readonly command: K;
  readonly payloadParams?: CheckedPayload<FunctionParams<CommandFn<T, K>>, PayloadStart<T, CommandFn<T, K>>>;
  readonly neverProxy?: boolean;
  readonly deprecated?: boolean;
  readonly info?: string;
};

/** Route entry with no command name (`deprecated: true` removals, for example). */
type BareHttpDef = {
  readonly command?: undefined;
  readonly payloadParams?: BaseMethodDef['payloadParams'];
  readonly neverProxy?: boolean;
  readonly deprecated?: boolean;
  readonly info?: string;
};

type CheckedHttpUnion<T, Keys extends string> = {
  [K in Keys]: CheckedHttpDef<T, K>;
}[Keys];

type CheckedMethodMap<T, Keys extends string> = {
  readonly [route: string]: {
    readonly GET?: BareHttpDef | CheckedHttpUnion<T, Keys>;
    readonly POST?: BareHttpDef | CheckedHttpUnion<T, Keys>;
    readonly DELETE?: BareHttpDef | CheckedHttpUnion<T, Keys>;
  };
};

type IsAny<T> = 0 extends 1 & T ? true : false;

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Skip the parameter check when command names are an open string index, when `T` is `any`, or when
 * `T` is exactly the base {@linkcode Driver} or {@linkcode Plugin} (those slots must stay wide enough
 * for every extension's map). A concrete driver or plugin is checked.
 */
type UseLooseCommandMap<T, Scope extends 'plugin' | 'driver'> =
  IsAny<T> extends true
    ? true
    : string extends CommandNames<T, Scope extends 'plugin' ? PluginCommand : DriverCommand>
      ? true
      : Scope extends 'plugin'
        ? IsExact<T, Plugin>
        : IsExact<T, Driver>;

type CheckedOrLooseMethodMap<T, Scope extends 'plugin' | 'driver'> =
  UseLooseCommandMap<T, Scope> extends true
    ? Scope extends 'plugin'
      ? Readonly<PluginMethodMap<T & Plugin>>
      : Readonly<DriverMethodMap<T & Driver>>
    : CheckedMethodMap<T, CommandNames<T, Scope extends 'plugin' ? PluginCommand : DriverCommand>>;

export interface ExecuteMethodDef<Ext extends Plugin | Driver> {
  command: keyof ConditionalPick<
    Required<Ext>,
    Ext extends Plugin ? PluginCommand : Ext extends Driver ? DriverCommand : never
  >;
}

/**
 * Properties shared by execute method definitions in both plugins and drivers
 */
export interface BaseExecuteMethodDef {
  /**
   * Execute-script arguments.
   *
   * When this definition is part of an {@linkcode ExecuteMethodMap}, `required` and `optional`
   * are checked against the command in order (see {@linkcode MethodMap}).
   */
  params?: {
    required?: ReadonlyArray<string>;
    optional?: ReadonlyArray<string>;
  };

  /**
   * If this is `true`, then the method is marked for deprecation.
   */
  readonly deprecated?: boolean;

  /**
   * Any additional info string or comments to this execute method.
   */
  readonly info?: string;
}

/**
 * A definition of an execute method in a {@linkcode Driver}.
 */
export interface DriverExecuteMethodDef<T extends Driver> extends BaseExecuteMethodDef {
  command: keyof ConditionalPick<T, DriverCommand>;
}

/**
 * A definition of an execute method in a {@linkcode Plugin}.
 */
export interface PluginExecuteMethodDef<T extends Plugin> extends BaseExecuteMethodDef {
  command: keyof ConditionalPick<T, PluginCommand>;
}

type CheckedExecuteDef<T, K extends string> = {
  readonly command: K;
  readonly params?: CheckedExecuteParams<FunctionParams<CommandFn<T, K>>, PayloadStart<T, CommandFn<T, K>>>;
  readonly deprecated?: boolean;
  readonly info?: string;
};

type CheckedExecuteMap<T, Keys extends string> = {
  readonly [script: string]: {
    [K in Keys]: CheckedExecuteDef<T, K>;
  }[Keys];
};

type LooseExecuteMap<T> = T extends Plugin
  ? Readonly<StringRecord<PluginExecuteMethodDef<T>>>
  : Readonly<StringRecord<DriverExecuteMethodDef<T & Driver>>>;

/**
 * Definition of an execute method (which overloads the behavior of the `execute` command) in a {@linkcode Driver} or {@linkcode Plugin}.
 *
 * `params.required` and `params.optional` are checked against the command the same way as
 * {@linkcode MethodMap}: required names first, then optional names. There are no URL parameters.
 * Plugin commands skip a leading `(next, driver)` pair when the method is declared that way.
 *
 * @example
 * ```ts
 * const executeMethodMap = {
 *   'sample: foo': {
 *     command: 'doFoo',
 *     params: {required: ['a', 'b'], optional: ['c']},
 *   },
 * } as const satisfies ExecuteMethodMap<MyDriver>;
 *
 * async doFoo(a: string, b: string, c?: string) {}
 * // async doFoo(a: string, b: string, c: string) {} // error: `c` is optional in the map
 * ```
 */
export type ExecuteMethodMap<T extends Plugin | Driver> = T extends Plugin
  ? UseLooseCommandMap<T, 'plugin'> extends true
    ? LooseExecuteMap<T>
    : CheckedExecuteMap<T, CommandNames<T, PluginCommand>>
  : T extends Driver
    ? UseLooseCommandMap<T, 'driver'> extends true
      ? LooseExecuteMap<T>
      : CheckedExecuteMap<T, CommandNames<T, DriverCommand>>
    : never;

export interface BidiMethodParams {
  required?: readonly string[];
  optional?: readonly string[];
}

export interface BidiMethodDef extends BaseExecuteMethodDef {
  command: string;
  params?: BidiMethodParams;
}

export interface BidiMethodMap {
  [k: string]: BidiMethodDef;
}

export interface BidiModuleMap {
  [k: string]: BidiMethodMap;
}

// https://w3c.github.io/webdriver-bidi/#protocol-definition
export interface GenericBiDiCommandResponse {
  id: number;
  [key: string]: any;
}

export interface BiDiResultData {
  [key: string]: any;
}

export interface SuccessBiDiCommandResponse extends GenericBiDiCommandResponse {
  type: 'success';
  result: BiDiResultData;
}

export interface ErrorBiDiCommandResponse extends GenericBiDiCommandResponse {
  type: 'error';
  error: string;
  message: string;
  stacktrace?: string;
}

export interface RestCommandItemParam {
  /**
   * Command parameter name
   */
  name: string;
  /**
   * True if the parameter is required for the given command
   */
  required: boolean;
}

export interface RestCommandItem {
  /**
   * Command name
   */
  command?: string;
  /**
   * Whether the command is marked for deprecation
   */
  deprecated?: boolean;
  /**
   * Optional infostring about the command's purpose or a comment
   */
  info?: string;
  /**
   * List of command parameters
   */
  params?: RestCommandItemParam[];
}

export interface RestMethodsToCommandsMap {
  /**
   * Method name to command info mapping
   */
  [method: string]: RestCommandItem;
}

export interface RestCommandsMap {
  /**
   * Command paths to methods map in the base driver
   */
  base: Record<string, RestMethodsToCommandsMap>;
  /**
   * Command paths to methods map in the session-specific driver
   */
  driver: Record<string, RestMethodsToCommandsMap>;
  /**
   * Plugin name to command paths to methods map
   */
  plugins?: Record<string, Record<string, RestMethodsToCommandsMap>>;
}

export interface BiDiCommandItemParam {
  /**
   * Command parameter name
   */
  name: string;
  /**
   * True if the parameter is required for the given command
   */
  required: boolean;
}

export interface BiDiCommandItem {
  /**
   * Command name
   */
  command?: string;
  /**
   * Whether the command is marked for deprecation
   */
  deprecated?: boolean;
  /**
   * Optional infostring about the command's purpose or a comment
   */
  info?: string;
  /**
   * List of command parameters
   */
  params?: BiDiCommandItemParam[];
}

export interface BiDiCommandNamesToInfosMap {
  [name: string]: BiDiCommandItem;
}

export interface BiDiCommandsMap {
  /**
   * Domains to BiDi commands mapping in the base driver
   */
  base: Record<string, BiDiCommandNamesToInfosMap>;
  /**
   * Domains to BiDi commands mapping in the session-specific driver
   */
  driver: Record<string, BiDiCommandNamesToInfosMap>;
  /**
   * Plugin name to domains to BiDi commands mapping
   */
  plugins?: Record<string, Record<string, BiDiCommandNamesToInfosMap>>;
}

export interface ListCommandsResponse {
  /**
   * REST APIs mapping
   */
  rest?: RestCommandsMap;
  /**
   * BiDi APIs mapping
   */
  bidi?: BiDiCommandsMap;
}

export interface RestExtensionsMap {
  /**
   * Driver execute methods mapping
   */
  driver: RestMethodsToCommandsMap;
  /**
   * Plugins execute methods mapping
   */
  plugins?: Record<string, RestMethodsToCommandsMap>;
}

export interface ListExtensionsResponse {
  /**
   * Rest extensions mapping
   */
  rest?: RestExtensionsMap;
}
