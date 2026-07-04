import React from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => React.createElement("rn-view", props, children),
  Text: ({ children, ...props }: any) => React.createElement("rn-text", props, children),
}));

import { parseMachinaText } from "../src/text";
import { summarizeMachinaDom } from "../src/inspect";
import { assertNever, enumTable, matchEnum } from "../src/match";
import { S, serializeMachinaStyleSheet, validateMachinaStyleSheet } from "../src/style";
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
    expect(serializeMachinaStyleSheet).toBeTypeOf("function");
    expect(validateMachinaStyleSheet).toBeTypeOf("function");
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
