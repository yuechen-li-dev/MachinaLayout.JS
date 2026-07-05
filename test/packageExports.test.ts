import React from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => React.createElement("rn-view", props, children),
  Text: ({ children, ...props }: any) => React.createElement("rn-text", props, children),
}));

import { parseMachinaText } from "../src/text";
import { summarizeMachinaDom } from "../src/inspect";
import {
  assertNever,
  enumTable,
  matchDiscriminated,
  matchEnum,
  matchKind,
  MatchUnionError,
} from "../src/match";
import {
  A,
  formatAsyncTaskDescription,
  formatAsyncTaskDiagnostics,
  formatAsyncTaskTrace,
  validateAsyncTask,
} from "../src/async";
import {
  formatIterDiagnostics,
  formatIterMachineDescription,
  formatIterTrace,
  I,
  validateIterMachine,
} from "../src/iter";
import {
  ConceptError,
  formatConceptDescription,
  formatConceptDiagnostics,
  formatTemplateDescription,
  T,
  validateConceptDefinition,
  validateConceptValue,
} from "../src/concept";
import type {
  All,
  Assert,
  ConceptType,
  Equal,
  Extends,
  HasField,
  HasId,
  HasKind,
  OptionalField,
  Satisfies,
} from "../src/concept";
import {
  CT,
  type Assert as CompileTimeAssert,
  type DiscriminantValues,
  type Equal as CompileTimeEqual,
  type Extends as CompileTimeExtends,
  type IsNonEmptyTuple,
  type KebabCase,
  type KindValues,
  type KeysOf,
  type NonEmptyTuple,
  type Not,
  type Or,
  type TupleValues,
  type ValueOf,
} from "../src/comptime";
import {
  C,
  formatCaptureDiagnostics,
  formatCaptureTaskDescription,
  validateCaptureTask,
} from "../src/capture";
import {
  createMachinaClassNames,
  createMachinaStyleArtifact,
  S,
  serializeMachinaStyleSheet,
  validateMachinaStyleSheet,
} from "../src/style";
import {
  createStaticHtmlArtifact,
  H,
  serializeStaticPageCss,
  serializeStaticPageHtml,
  validateStaticPage,
} from "../src/static";
import { writeMachinaHandoffBundle } from "../src/handoff";
import {
  assertDeusStatePath,
  createDeusSnapshot,
  createMachinaDebugOverlayMachine,
  defineDeusMachine,
  getMachinaDebugOverlayBehavior,
  hasDeusStatePath,
  hydrateDeusSnapshot,
  judgeUtility,
  parseDeusPath,
  stepDeusMachine,
} from "../src/deus";
import { useDeusMachine as useReactDeusMachine } from "../src/react";
import { useDeusMachine as useNativeDeusMachine } from "../src/react-native";
import { useDeusMachine as useVueDeusMachine } from "../src/vue";

type _conceptTypeExportSmoke = Assert<
  Extends<
    All<[HasField<"id", string>, OptionalField<"name", string>]>,
    { readonly id: string; readonly name?: string }
  >
>;
type _conceptTypeExportSmokeReverse = Assert<
  Extends<
    { readonly id: string; readonly name?: string },
    All<[HasField<"id", string>, OptionalField<"name", string>]>
  >
>;
type _conceptAliasExportSmoke = Assert<Equal<HasId, { readonly id: string }>>;
type _conceptKindExportSmoke = Assert<Equal<HasKind<"image">, { readonly kind: "image" }>>;
type _conceptShapeExportSmoke = Assert<Equal<ConceptType<{ value: number }>, { value: number }>>;
type _conceptExtendsExportSmoke = Assert<Equal<Extends<{ readonly id: string }, HasId>, true>>;
type _conceptSatisfiesExportSmoke = Assert<
  Equal<Satisfies<{ readonly id: string }, HasId>, { readonly id: string }>
>;
type _comptimeAssertExportSmoke = CompileTimeAssert<
  CompileTimeEqual<KebabCase<"ButtonPrimary">, "button-primary">
>;
type _comptimeExtendsExportSmoke = CompileTimeAssert<
  CompileTimeExtends<TupleValues<readonly ["a", "b"]>, "a" | "b">
>;
type _comptimeValueOfExportSmoke = CompileTimeAssert<
  CompileTimeEqual<ValueOf<{ a: 1; b: 2 }>, 1 | 2>
>;
type _comptimeKeysOfExportSmoke = CompileTimeAssert<
  CompileTimeEqual<KeysOf<{ a: 1; b: 2 }>, "a" | "b">
>;
type _comptimeDiscriminantExportSmoke = CompileTimeAssert<
  CompileTimeEqual<
    DiscriminantValues<{ type: "a"; value: 1 } | { type: "b"; value: 2 }, "type">,
    "a" | "b"
  >
>;
type _comptimeKindExportSmoke = CompileTimeAssert<
  CompileTimeEqual<
    KindValues<{ kind: "rect"; value: 1 } | { kind: "circle"; value: 2 }>,
    "rect" | "circle"
  >
>;
type _comptimeNotExportSmoke = CompileTimeAssert<CompileTimeEqual<Not<false>, true>>;
type _comptimeOrExportSmoke = CompileTimeAssert<CompileTimeEqual<Or<[false, true]>, true>>;
type _comptimeNonEmptyExportSmoke = CompileTimeAssert<CompileTimeEqual<NonEmptyTuple<[1]>, [1]>>;
type _comptimeIsNonEmptyExportSmoke = CompileTimeAssert<
  CompileTimeEqual<IsNonEmptyTuple<[1]>, true>
>;

describe("package export entrypoints", () => {
  it("keeps text barrel framework-neutral", async () => {
    const textCore = await import("../src/text");
    expect(parseMachinaText).toBeTypeOf("function");
    expect("MachinaTextView" in textCore).toBe(false);
    expect("MachinaNativeTextView" in textCore).toBe(false);
    expect("MachinaVueTextView" in textCore).toBe(false);
  });

  it("exposes inspect and handoff subpath utilities", () => {
    expect(summarizeMachinaDom).toBeTypeOf("function");
    expect(writeMachinaHandoffBundle).toBeTypeOf("function");
  });

  it("exposes match subpath utilities", () => {
    expect(matchEnum).toBeTypeOf("function");
    expect(matchDiscriminated).toBeTypeOf("function");
    expect(matchKind).toBeTypeOf("function");
    expect(enumTable).toBeTypeOf("function");
    expect(assertNever).toBeTypeOf("function");
    expect(MatchUnionError).toBeTypeOf("function");
  });

  it("exposes style subpath utilities", () => {
    expect(S.style).toBeTypeOf("function");
    expect(S.with).toBeTypeOf("function");
    expect(S.token).toBeTypeOf("function");
    expect(S.classes).toBeTypeOf("function");
    expect(S.stateful).toBeTypeOf("function");
    expect(S.responsive).toBeTypeOf("function");
    expect(S.resolveState).toBeTypeOf("function");
    expect(S.resolveStates).toBeTypeOf("function");
    expect(S.resolveResponsive).toBeTypeOf("function");
    expect(S.resolveResponsiveVariants).toBeTypeOf("function");
    expect(S.dataState).toBeTypeOf("function");
    expect(createMachinaClassNames).toBeTypeOf("function");
    expect(createMachinaStyleArtifact).toBeTypeOf("function");
    expect(serializeMachinaStyleSheet).toBeTypeOf("function");
    expect(validateMachinaStyleSheet).toBeTypeOf("function");
  });

  it("exposes capture subpath utilities", () => {
    expect(C.task).toBeTypeOf("function");
    expect(C.run).toBeTypeOf("function");
    expect(C.withEnv).toBeTypeOf("function");
    expect(C.map).toBeTypeOf("function");
    expect(C.describe).toBeTypeOf("function");
    expect(C.validate).toBeTypeOf("function");
    expect(formatCaptureTaskDescription).toBeTypeOf("function");
    expect(validateCaptureTask).toBeTypeOf("function");
    expect(formatCaptureDiagnostics).toBeTypeOf("function");
  });

  it("exposes async subpath utilities", () => {
    expect(A.task).toBeTypeOf("function");
    expect(A.ok).toBeTypeOf("function");
    expect(A.err).toBeTypeOf("function");
    expect(A.cancelled).toBeTypeOf("function");
    expect(A.timeout).toBeTypeOf("function");
    expect(A.createController).toBeTypeOf("function");
    expect(A.run).toBeTypeOf("function");
    expect(A.describe).toBeTypeOf("function");
    expect(A.validate).toBeTypeOf("function");
    expect(formatAsyncTaskDescription).toBeTypeOf("function");
    expect(validateAsyncTask).toBeTypeOf("function");
    expect(formatAsyncTaskDiagnostics).toBeTypeOf("function");
    expect(formatAsyncTaskTrace).toBeTypeOf("function");
  });

  it("exposes iter subpath utilities", () => {
    expect(I.machine).toBeTypeOf("function");
    expect(I.yield).toBeTypeOf("function");
    expect(I.done).toBeTypeOf("function");
    expect(I.fail).toBeTypeOf("function");
    expect(I.createController).toBeTypeOf("function");
    expect(I.next).toBeTypeOf("function");
    expect(I.collect).toBeTypeOf("function");
    expect(I.reset).toBeTypeOf("function");
    expect(I.describe).toBeTypeOf("function");
    expect(I.validate).toBeTypeOf("function");
    expect(formatIterMachineDescription).toBeTypeOf("function");
    expect(validateIterMachine).toBeTypeOf("function");
    expect(formatIterDiagnostics).toBeTypeOf("function");
    expect(formatIterTrace).toBeTypeOf("function");
  });

  it("exposes concept subpath utilities", () => {
    expect(T.concept).toBeTypeOf("function");
    expect(T.compose).toBeTypeOf("function");
    expect(T.validate).toBeTypeOf("function");
    expect(T.assert).toBeTypeOf("function");
    expect(T.describe).toBeTypeOf("function");
    expect(T.template).toBeTypeOf("function");
    expect(T.runTemplate).toBeTypeOf("function");
    expect(T.describeTemplate).toBeTypeOf("function");
    expect(T.fields).toBeTypeOf("function");
    expect(T.string).toBeTypeOf("function");
    expect(T.number).toBeTypeOf("function");
    expect(T.boolean).toBeTypeOf("function");
    expect(T.fn).toBeTypeOf("function");
    expect(T.function).toBeTypeOf("function");
    expect(T.object).toBeTypeOf("function");
    expect(T.array).toBeTypeOf("function");
    expect(T.literal).toBeTypeOf("function");
    expect(T.optional).toBeTypeOf("function");
    expect(validateConceptDefinition).toBeTypeOf("function");
    expect(validateConceptValue).toBeTypeOf("function");
    expect(formatConceptDescription).toBeTypeOf("function");
    expect(formatConceptDiagnostics).toBeTypeOf("function");
    expect(formatTemplateDescription).toBeTypeOf("function");
    expect(ConceptError).toBeTypeOf("function");
  });

  it("exposes compile-time helper utilities", () => {
    expect(CT.tuple).toBeTypeOf("function");
    expect(CT.object).toBeTypeOf("function");
    expect(CT.keys).toBeTypeOf("function");
  });

  it("exposes static subpath utilities", () => {
    expect(H.tabs).toBeTypeOf("function");
    expect(H.accordion).toBeTypeOf("function");
    expect(H.httpAction).toBeTypeOf("function");
    expect(H.httpLink).toBeTypeOf("function");
    expect(H.page).toBeTypeOf("function");
    expect(H.staticPage).toBeTypeOf("function");
    expect(createStaticHtmlArtifact).toBeTypeOf("function");
    expect(serializeStaticPageHtml).toBeTypeOf("function");
    expect(serializeStaticPageCss).toBeTypeOf("function");
    expect(validateStaticPage).toBeTypeOf("function");
  });

  it("exposes deus subpath utilities", () => {
    expect(judgeUtility).toBeTypeOf("function");
    expect(defineDeusMachine).toBeTypeOf("function");
    expect(createDeusSnapshot).toBeTypeOf("function");
    expect(hydrateDeusSnapshot).toBeTypeOf("function");
    expect(stepDeusMachine).toBeTypeOf("function");
    expect(parseDeusPath).toBeTypeOf("function");
    expect(hasDeusStatePath).toBeTypeOf("function");
    expect(assertDeusStatePath).toBeTypeOf("function");
    expect(createMachinaDebugOverlayMachine).toBeTypeOf("function");
    expect(getMachinaDebugOverlayBehavior).toBeTypeOf("function");
  });

  it("exposes Deus framework bindings only from adapter subpaths", async () => {
    const root = await import("../src");
    const deus = await import("../src/deus");
    expect(useReactDeusMachine).toBeTypeOf("function");
    expect(useNativeDeusMachine).toBeTypeOf("function");
    expect(useVueDeusMachine).toBeTypeOf("function");
    expect("useDeusMachine" in root).toBe(false);
    expect("useDeusMachine" in deus).toBe(false);
  });
});
