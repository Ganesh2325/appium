/**
 * Type-level checking of `required` / `optional` lists against a command function.
 *
 * Argument order matches the server: required payload parameters, then optional payload
 * parameters, then (for HTTP routes) URL parameters. URL parameters are not part of the
 * lists, so parameters after the lists are not checked. This module is an implementation
 * detail of {@linkcode MethodMap} and {@linkcode ExecuteMethodMap}.
 */

/** Highest parameter index checked (0-based). Longer lists fall through to the last supported slot. */
type ParamLimit = 16;

type IncTable = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

type Inc<N extends number> = N extends keyof IncTable ? IncTable[N] : never;

type StringTuple<N extends number, Acc extends readonly string[] = []> = Acc['length'] extends N
  ? Acc
  : StringTuple<N, readonly [...Acc, string]>;

type Add<A extends number, B extends number> = [...StringTuple<A>, ...StringTuple<B>]['length'] & number;

type At<P extends readonly unknown[], I extends number> = `${I}` extends keyof P ? P[`${I}` & keyof P] : never;

/**
 * `'required'` when the argument must be passed, `'optional'` when it may be omitted,
 * `'absent'` when the function does not declare that slot (extra arguments are ignored).
 */
type ParamKind<P extends readonly unknown[], I extends number> = `${I}` extends keyof P
  ? {} extends Pick<P, `${I}` & keyof P>
    ? 'optional'
    : 'required'
  : 'absent';

/**
 * Optional payload entries may be a `?` parameter, a parameter whose type includes `undefined`
 * (the server still passes the argument), or absent from the signature.
 */
type OptionalSlot<P extends readonly unknown[], I extends number> =
  ParamKind<P, I> extends 'optional' | 'absent' ? true : undefined extends At<P, I> ? true : false;

type IsFixedTuple<P> = P extends readonly unknown[] ? (number extends P['length'] ? false : true) : false;

type CheckRequired<
  P extends readonly unknown[],
  Start extends number,
  Count extends number,
  I extends number = 0,
> = I extends Count
  ? true
  : ParamKind<P, Add<Start, I>> extends 'required'
    ? CheckRequired<P, Start, Count, Inc<I>>
    : false;

type PayloadFields = {
  wrap?: string;
  unwrap?: string;
  validate?: (obj: any, protocol: string) => boolean | string | undefined;
};

type ExactPayload<R extends number, O extends number> = PayloadFields &
  (R extends 0 ? {required?: readonly []} : {required: StringTuple<R>}) &
  (O extends 0 ? {optional?: readonly []} : {optional: StringTuple<O>});

/** Used once declared parameters run out: further optional names are not required parameters. */
type OpenPayload<R extends number> = PayloadFields &
  (R extends 0 ? {required?: readonly []} : {required: StringTuple<R>}) & {optional?: readonly string[]};

type MultiPayload<R extends number, O extends number> = R extends 0
  ? never
  : PayloadFields & {required: readonly StringTuple<R>[]} & (O extends 0
        ? {optional?: readonly []}
        : {optional: StringTuple<O>});

type OpenMultiPayload<R extends number> = R extends 0
  ? never
  : PayloadFields & {required: readonly StringTuple<R>[]; optional?: readonly string[]};

type MakeArgsPayload = PayloadFields & {
  required?: readonly string[] | readonly (readonly string[])[];
  optional?: readonly string[];
  makeArgs: (obj: any) => any;
};

/** Payload shape accepted when the parameter list is a rest/`any[]` and optionality cannot be read. */
type WidePayload = PayloadFields & {
  required?: readonly string[] | readonly (readonly string[])[];
  optional?: readonly string[];
  makeArgs?: (obj: any) => any;
};

/**
 * `true` for HTTP payloads, which allow several `required` sets and `makeArgs`.
 * Execute methods only accept a single list of names (plus an optional `makeArgs` escape hatch).
 */
type CollectOptional<
  Http extends boolean,
  P extends readonly unknown[],
  Start extends number,
  R extends number,
  O extends number = 0,
  Acc = ExactPayload<R, 0> | (Http extends true ? MultiPayload<R, 0> : never),
> = O extends ParamLimit
  ? Acc
  : OptionalSlot<P, Add<Start, Add<R, O>>> extends true
    ? ParamKind<P, Add<Start, Add<R, O>>> extends 'absent'
      ? Acc | OpenPayload<R> | (Http extends true ? OpenMultiPayload<R> : never)
      : CollectOptional<
          Http,
          P,
          Start,
          R,
          Inc<O>,
          Acc | ExactPayload<R, Inc<O>> | (Http extends true ? MultiPayload<R, Inc<O>> : never)
        >
    : Acc;

type CollectRequired<
  Http extends boolean,
  P extends readonly unknown[],
  Start extends number,
  R extends number = 0,
  Acc = never,
> = R extends ParamLimit
  ? Acc
  : CheckRequired<P, Start, R> extends true
    ? CollectRequired<Http, P, Start, Inc<R>, Acc | CollectOptional<Http, P, Start, R>>
    : Acc;

/**
 * `makeArgs` on an execute method replaces positional checking, same as an HTTP route.
 * `required` stays a flat list so the entry stays assignable to {@linkcode BaseExecuteMethodDef}.
 */
type ExecuteMakeArgsPayload = {
  required?: readonly string[];
  optional?: readonly string[];
  makeArgs: (obj: any) => any;
};

/** Execute-method params when the command is a rest/`any[]` parameter list. */
type WideExecuteParams = {
  required?: readonly string[];
  optional?: readonly string[];
  makeArgs?: (obj: any) => any;
};

/**
 * Payload shapes whose `required` / `optional` lengths agree with `P`, starting at `Start`
 * (plugin commands skip the leading `next` and `driver` arguments).
 */
export type CheckedPayload<P extends readonly unknown[], Start extends number = 0> = [IsFixedTuple<P>] extends [false]
  ? WidePayload
  : CollectRequired<true, P, Start> | MakeArgsPayload;

/**
 * Same length check as {@linkcode CheckedPayload}, without HTTP-only fields (`wrap`, multiple
 * `required` sets). Safe to read as `BaseExecuteMethodDef['params']`.
 */
export type CheckedExecuteParams<P extends readonly unknown[], Start extends number = 0> = [IsFixedTuple<P>] extends [
  false,
]
  ? WideExecuteParams
  : CollectRequired<false, P, Start> | ExecuteMakeArgsPayload;

export type FunctionParams<Fn> = Fn extends (...args: infer P) => any
  ? P extends readonly unknown[]
    ? P
    : never
  : readonly [];

/**
 * Plugin execute/HTTP handlers are invoked as `(next, driver, ...payloadArgs)`.
 * When the function actually starts with that pair, payload lists are aligned to argument 2.
 */
export type PluginPayloadStart<P extends readonly unknown[]> = P extends readonly [
  infer Next,
  infer Second,
  ...unknown[],
]
  ? Next extends (...args: any) => any
    ? Second extends object
      ? 2
      : 0
    : 0
  : 0;
