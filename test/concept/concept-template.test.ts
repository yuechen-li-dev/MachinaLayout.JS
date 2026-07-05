import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  ConceptError,
  T,
  formatConceptDescription,
  formatConceptDiagnostics,
  formatTemplateDescription,
  validateConceptDefinition,
} from "../../src/concept";

describe("concept field helpers", () => {
  it("creates primitive and literal constraints", () => {
    expect(T.string()).toEqual({ kind: "string" });
    expect(T.number()).toEqual({ kind: "number" });
    expect(T.boolean()).toEqual({ kind: "boolean" });
    expect(T.fn()).toEqual({ kind: "function" });
    expect(T.function()).toEqual({ kind: "function" });
    expect(T.object()).toEqual({ kind: "object" });
    expect(T.array()).toEqual({ kind: "array" });
    expect(T.literal("rect")).toEqual({ kind: "literal", value: "rect" });
    expect(T.literal(2)).toEqual({ kind: "literal", value: 2 });
    expect(T.literal(true)).toEqual({ kind: "literal", value: true });
  });

  it("marks constraints optional without mutating the original", () => {
    const base = T.string();
    const optional = T.optional(base);
    const alreadyOptional = T.optional(optional);

    expect(base).toEqual({ kind: "string" });
    expect(optional).toEqual({ kind: "string", optional: true });
    expect(alreadyOptional).toEqual({ kind: "string", optional: true });
    expect(optional).not.toBe(base);
  });
});

describe("concept authoring", () => {
  it("creates a concept and returns a fresh object", () => {
    const input = {
      id: "HasId",
      description: "Anything with an id.",
      fields: {
        id: T.string(),
      },
    };

    const created = T.concept(input);

    expect(created).toEqual({
      kind: "concept",
      id: "HasId",
      description: "Anything with an id.",
      fields: {
        id: { kind: "string" },
      },
    });
    expect(created).not.toBe(input);
    expect(created.fields).not.toBe(input.fields);
  });

  it("composes concepts, overrides local fields, and preserves composedFrom", () => {
    const Positioned = T.concept({
      id: "Positioned",
      fields: {
        x: T.number(),
        y: T.number(),
        label: T.string(),
      },
    });
    const Sized = T.concept({
      id: "Sized",
      fields: {
        width: T.number(),
        height: T.number(),
        label: T.number(),
      },
    });

    const RectLike = T.compose({
      id: "RectLike",
      concepts: [Positioned, Sized],
      fields: {
        label: T.literal("rect"),
      },
    });

    expect(RectLike.fields).toEqual({
      x: { kind: "number" },
      y: { kind: "number" },
      width: { kind: "number" },
      height: { kind: "number" },
      label: { kind: "literal", value: "rect" },
    });
    expect(RectLike.composedFrom).toEqual([Positioned, Sized]);
  });

  it("reports invalid concept ids and conflicting composed fields", () => {
    const One = T.concept({
      id: "One",
      fields: {
        id: T.string(),
      },
    });
    const Two = T.concept({
      id: "Two",
      fields: {
        id: T.number(),
      },
    });

    const diagnostics = validateConceptDefinition({
      kind: "concept",
      id: " ",
      description: "Broken composed concept.",
      fields: {
        id: T.number(),
      },
      composedFrom: [One, Two],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("InvalidConceptId");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("ConflictingConceptField");
  });
});

describe("concept value validation", () => {
  const HasId = T.concept({
    id: "HasId",
    fields: {
      id: T.string(),
      tag: T.optional(T.string()),
    },
  });
  const HasKind = T.concept({
    id: "HasKind",
    fields: {
      kind: T.literal("rect"),
    },
  });
  const RectLike = T.compose({
    id: "RectLike",
    concepts: [
      T.concept({
        id: "Positioned",
        fields: {
          x: T.number(),
          y: T.number(),
        },
      }),
      T.concept({
        id: "Sized",
        fields: {
          width: T.number(),
          height: T.number(),
        },
      }),
      HasId,
      HasKind,
    ],
  });

  it("accepts valid values", () => {
    expect(
      T.validate(RectLike, {
        id: "a",
        kind: "rect",
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      }),
    ).toEqual([]);
  });

  it("reports missing required fields and keeps optional-missing fields valid", () => {
    const missing = T.validate(HasId, {});

    expect(missing.map((diagnostic) => diagnostic.code)).toContain("MissingConceptField");
    expect(T.validate(HasId, { id: "ok" })).toEqual([]);
  });

  it("reports wrong primitive, function, array, object, and literal mismatches with paths", () => {
    const HasShape = T.concept({
      id: "HasShape",
      fields: {
        name: T.string(),
        count: T.number(),
        enabled: T.boolean(),
        compute: T.fn(),
        items: T.array(),
        meta: T.object(),
        kind: T.literal("shape"),
      },
    });

    const diagnostics = T.validate(HasShape, {
      name: 1,
      count: "2",
      enabled: "yes",
      compute: "nope",
      items: {},
      meta: [],
      kind: "circle",
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidConceptFieldType",
      "InvalidConceptFieldType",
      "InvalidConceptFieldType",
      "InvalidConceptFieldType",
      "InvalidConceptFieldType",
      "InvalidConceptFieldType",
      "InvalidConceptLiteral",
    ]);
    expect(diagnostics.every((diagnostic) => typeof diagnostic.path === "string")).toBe(true);
  });

  it("validates all fields from composed concepts", () => {
    const diagnostics = T.validate(RectLike, {
      id: "a",
      kind: "rect",
      x: 1,
      y: 2,
      width: 3,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("MissingConceptField");
    expect(diagnostics.find((diagnostic) => diagnostic.path === "height")).toBeTruthy();
  });
});

describe("concept assert and description", () => {
  const Positioned = T.concept({
    id: "Positioned",
    fields: {
      x: T.number(),
      y: T.number(),
    },
  });
  const Sized = T.concept({
    id: "Sized",
    fields: {
      width: T.number(),
      height: T.number(),
    },
  });
  const RectLike = T.compose({
    id: "RectLike",
    concepts: [Positioned, Sized],
    description: "Anything rectangle-like.",
  });

  it("asserts valid values and throws ConceptError for invalid ones", () => {
    expect(() =>
      T.assert(RectLike, {
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      }),
    ).not.toThrow();

    try {
      T.assert(RectLike, { x: 1, y: 2, width: 3 });
      expect.unreachable("expected ConceptError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConceptError);
      const conceptError = error as ConceptError;
      expect(conceptError.conceptId).toBe("RectLike");
      expect(conceptError.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        "MissingConceptField",
      );
    }
  });

  it("describes and formats concepts and diagnostics readably", () => {
    const description = T.describe(RectLike);
    const formattedDescription = formatConceptDescription(description);
    const formattedDiagnostics = formatConceptDiagnostics([
      {
        severity: "error",
        code: "MissingConceptField",
        message: "Required concept field 'height' is missing.",
        path: "height",
      },
    ]);

    expect(description).toEqual({
      kind: "concept",
      id: "RectLike",
      description: "Anything rectangle-like.",
      fieldNames: ["x", "y", "width", "height"],
      composedFrom: ["Positioned", "Sized"],
      fieldEntries: ["x: number", "y: number", "width: number", "height: number"],
    });
    expect(formattedDescription).toContain("Concept: RectLike");
    expect(formattedDescription).toContain("Composed from:");
    expect(formattedDescription).toContain("- width: number");
    expect(formattedDiagnostics).toContain("[error] MissingConceptField at height");
  });
});

describe("template records", () => {
  const RectLike = T.compose({
    id: "RectLike",
    concepts: [
      T.concept({
        id: "Positioned",
        fields: {
          x: T.number(),
          y: T.number(),
        },
      }),
      T.concept({
        id: "Sized",
        fields: {
          width: T.number(),
          height: T.number(),
        },
      }),
    ],
  });

  it("creates templates, validates input at runtime, and describes them", () => {
    const renderRect = T.template({
      id: "renderRect",
      requires: RectLike,
      description: "Render a rect summary.",
      run: (rect: { x: number; y: number; width: number; height: number }) =>
        `${rect.x},${rect.y} ${rect.width}x${rect.height}`,
    });

    expect(renderRect).toEqual({
      kind: "template",
      id: "renderRect",
      requires: RectLike,
      description: "Render a rect summary.",
      run: renderRect.run,
    });
    expect(T.runTemplate(renderRect, { x: 1, y: 2, width: 3, height: 4 })).toBe("1,2 3x4");
    expect(() => T.runTemplate(renderRect, { x: 1, y: 2, width: 3 } as never)).toThrow(
      ConceptError,
    );

    const description = T.describeTemplate(renderRect);
    expect(description).toEqual({
      kind: "template",
      id: "renderRect",
      description: "Render a rect summary.",
      requires: T.describe(RectLike),
    });
    expect(formatTemplateDescription(description)).toContain("Template: renderRect");
    expect(formatTemplateDescription(description)).toContain("Requires:");
  });

  it("preserves template output inference and field helper types", () => {
    const renderRect = T.template({
      id: "typedRect",
      requires: RectLike,
      run: (rect: { x: number; y: number; width: number; height: number }) => ({
        area: rect.width * rect.height,
      }),
    });

    const output: { area: number } = T.runTemplate(renderRect, {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
    const fieldKind: "string" = T.string().kind;
    const optionalKind: "number" = T.optional(T.number()).kind;
    void fieldKind;
    void optionalKind;

    expect(output.area).toBe(12);
  });
});

describe("concept exports", () => {
  it("exports the concept namespace only from the concept subpath", () => {
    expect(T.concept).toBeTypeOf("function");
    expect(T.compose).toBeTypeOf("function");
    expect(T.validate).toBeTypeOf("function");
    expect(T.assert).toBeTypeOf("function");
    expect(T.template).toBeTypeOf("function");
    expect(T.runTemplate).toBeTypeOf("function");
    expect("T" in root).toBe(false);
  });
});
