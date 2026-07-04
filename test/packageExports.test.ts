import React from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => React.createElement("rn-view", props, children),
  Text: ({ children, ...props }: any) => React.createElement("rn-text", props, children),
}));

import { parseMachinaText } from "../src/text";
import { summarizeMachinaDom } from "../src/inspect";
import { assertNever, enumTable, matchEnum } from "../src/match";
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
  createDeusSnapshot,
  createMachinaDebugOverlayMachine,
  defineDeusMachine,
  getMachinaDebugOverlayBehavior,
  judgeUtility,
  stepDeusMachine,
} from "../src/deus";
import { useDeusMachine as useReactDeusMachine } from "../src/react";
import { useDeusMachine as useNativeDeusMachine } from "../src/react-native";
import { useDeusMachine as useVueDeusMachine } from "../src/vue";

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
    expect(enumTable).toBeTypeOf("function");
    expect(assertNever).toBeTypeOf("function");
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

  it("exposes static subpath utilities", () => {
    expect(H.tabs).toBeTypeOf("function");
    expect(H.accordion).toBeTypeOf("function");
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
    expect(stepDeusMachine).toBeTypeOf("function");
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
