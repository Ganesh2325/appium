import {expectAssignable, expectError} from 'tsd';

import type {
  AnyMethodMap,
  Driver,
  ExecuteMethodMap,
  ExternalDriver,
  MethodMap,
  NextPluginCallback,
  Plugin,
  PluginCommand,
} from '..';

interface SampleDriver extends Driver {
  doFoo(a: string, b: string, c?: string): Promise<void>;
  /** Optional payload parameter is declared as `T | undefined` rather than `?`. */
  doFooUndef(a: string, b: string | undefined): Promise<void>;
  doFooShort(a: string, b: string): Promise<void>;
  setThing(thing: string): Promise<null>;
  /** Body parameter, then a required URL parameter the map does not list. */
  withUrl(text: string, elementId: string): Promise<void>;
  activate(appId: string, options?: unknown): Promise<void>;
  customArgs(ignored: string): Promise<void>;
  loose(...args: unknown[]): Promise<void>;
}

interface SamplePlugin extends Plugin {
  plug(next: NextPluginCallback, driver: ExternalDriver, socket: string, extra?: string): Promise<string>;
}

const executeMethodMap = {
  'sample: foo': {
    command: 'doFoo',
    params: {required: ['a', 'b'], optional: ['c']},
  },
  'sample: undef': {
    command: 'doFooUndef',
    params: {required: ['a'], optional: ['b']},
  },
  'sample: omitted': {
    command: 'doFooShort',
    params: {required: ['a', 'b'], optional: ['unused']},
  },
  'sample: thing': {
    command: 'setThing',
    params: {required: ['thing']},
  },
  'sample: custom': {
    command: 'customArgs',
    params: {required: ['ignored'], makeArgs: () => ['built']},
  },
} as const satisfies ExecuteMethodMap<SampleDriver>;

expectAssignable<ExecuteMethodMap<SampleDriver>>(executeMethodMap);

const newMethodMap = {
  '/session/:sessionId/foo': {
    POST: {
      command: 'doFoo',
      payloadParams: {required: ['a', 'b'], optional: ['c']},
    },
  },
  '/session/:sessionId/element/:elementId/value': {
    POST: {command: 'withUrl', payloadParams: {required: ['text']}},
  },
  '/session/:sessionId/activate': {
    POST: {
      command: 'activate',
      payloadParams: {required: [['appId'], ['bundleId']], optional: ['options']},
    },
  },
  '/session/:sessionId/custom': {
    POST: {
      command: 'customArgs',
      payloadParams: {required: ['whatever'], makeArgs: () => ['built']},
    },
  },
  '/session/:sessionId/loose': {
    POST: {command: 'loose', payloadParams: {required: ['data']}},
  },
  '/session/:sessionId/removed': {
    GET: {deprecated: true},
  },
} as const satisfies MethodMap<SampleDriver>;

// Annotation (no `as const`) still accepts a matching literal map.
const annotated: MethodMap<SampleDriver> = {
  '/session/:sessionId/foo': {
    POST: {command: 'doFoo', payloadParams: {required: ['a', 'b'], optional: ['c']}},
  },
};

expectAssignable<MethodMap<SampleDriver>>(newMethodMap);
expectAssignable<MethodMap<SampleDriver>>(annotated);
expectAssignable<MethodMap<any>>(newMethodMap);
expectAssignable<ExecuteMethodMap<any>>(executeMethodMap);
expectAssignable<AnyMethodMap>(newMethodMap);

// A script lookup is a union of per-command entries. Read `command` directly; spreading a
// possibly-missing union drops the property.
declare const declaredScripts: ExecuteMethodMap<SampleDriver> | undefined;
const lookedUp = declaredScripts?.['sample: foo'];
if (lookedUp?.command) {
  expectAssignable<string>(lookedUp.command);
}

// Plugins typed with an open command index keep the loose map, so a lookup can be spread.
type OpenPlugin = Plugin & Record<string, PluginCommand>;
declare const openScripts: ExecuteMethodMap<OpenPlugin> | undefined;
const spreadOpen = {...openScripts?.['sample: plug']};
expectAssignable<string | undefined>(spreadOpen.command);
expectAssignable<AnyMethodMap>({
  '/unknown': {POST: {command: 'notOnThisDriver', payloadParams: {required: ['a']}}},
});

const pluginExecuteMap = {
  'sample: plug': {
    command: 'plug',
    params: {required: ['socket'], optional: ['extra']},
  },
} as const satisfies ExecuteMethodMap<SamplePlugin>;

expectAssignable<ExecuteMethodMap<SamplePlugin>>(pluginExecuteMap);

interface RequiredCDriver extends Driver {
  doFoo(a: string, b: string, c: string): Promise<void>;
}

// `c` is required in the implementation but optional in the map.
expectError({
  'sample: foo': {
    command: 'doFoo',
    params: {required: ['a', 'b'], optional: ['c']},
  },
} as const satisfies ExecuteMethodMap<RequiredCDriver>);

// `c` is listed as required but is optional on the command.
expectError({
  'sample: foo': {
    command: 'doFoo',
    params: {required: ['a', 'b', 'c']},
  },
} as const satisfies ExecuteMethodMap<SampleDriver>);

// Optional list starts on a required parameter.
expectError({
  'sample: foo': {
    command: 'doFoo',
    params: {required: ['a'], optional: ['b']},
  },
} as const satisfies ExecuteMethodMap<SampleDriver>);

expectError({
  '/session/:sessionId/rect': {
    POST: {
      command: 'doFoo',
      payloadParams: {optional: ['a', 'b', 'c']},
    },
  },
} as const satisfies MethodMap<SampleDriver>);

expectError({
  '/nope': {POST: {command: 'missing', payloadParams: {required: ['a']}}},
} as const satisfies MethodMap<SampleDriver>);

// Plugin payload must not be aligned at `next` (which is required). `extra` is optional.
expectError({
  'sample: plug': {
    command: 'plug',
    params: {required: ['socket', 'extra']},
  },
} as const satisfies ExecuteMethodMap<SamplePlugin>);
