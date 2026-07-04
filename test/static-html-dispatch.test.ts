import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStaticHtmlArtifact,
  H,
  serializeStaticPageCss,
  serializeStaticPageHtml,
  validateStaticDispatch,
  validateStaticPage,
} from "../src/static";
import type { StaticDispatchState } from "../src/static";

const planStates: Record<string, StaticDispatchState> = {
  "team-size": {
    title: "How many people are on your team?",
    body: "Pick the closest answer. This plan picker is no-JS dispatch lowering.",
    actions: [
      { id: "solo", label: "Just me", to: "starter-result" },
      { id: "team", label: "2-10 people", to: "pro-result" },
      { id: "enterprise", label: "More than 10", to: "enterprise-result" },
    ],
  },
  "starter-result": {
    title: "Starter",
    body: "Use the Starter plan. The transition happened through a radio input and CSS.",
    actions: [{ id: "restart", label: "Start over", to: "team-size" }],
  },
  "pro-result": {
    title: "Pro",
    body: "Use the Pro plan. Labels target state inputs; there is no JavaScript file.",
    actions: [{ id: "restart", label: "Start over", to: "team-size" }],
  },
  "enterprise-result": {
    title: "Enterprise",
    body: "Talk to sales. This result is public, read-only UI state.",
    actions: [{ id: "restart", label: "Start over", to: "team-size" }],
  },
};

function createDispatchPage() {
  return H.staticPage({
    title: "Machina Static Dispatch",
    body: [
      H.dispatch({
        id: "plan-picker",
        initial: "team-size",
        states: planStates,
      }),
    ],
  });
}

describe("static dispatch authoring", () => {
  it("creates dispatch machines and does not mutate input", () => {
    const input = {
      id: "plan-picker",
      initial: "team-size",
      states: planStates,
    };
    const dispatch = H.dispatch(input);

    expect(dispatch.kind).toBe("dispatch");
    expect(dispatch.states).not.toBe(input.states);
    expect(dispatch.states["team-size"]).not.toBe(input.states["team-size"]);
    expect(dispatch.states["team-size"]?.actions).not.toBe(input.states["team-size"]?.actions);
    expect(input.states["team-size"]?.title).toBe("How many people are on your team?");
  });

  it("accepts dispatch nodes in pages and allows terminal states", () => {
    const page = H.staticPage({
      title: "Terminal",
      body: [
        H.dispatch({
          id: "terminal-picker",
          initial: "done",
          states: {
            done: {
              title: "Done",
              body: "No actions are required.",
            },
          },
        }),
      ],
    });

    expect(page.body[0]?.kind).toBe("dispatch");
    expect(validateStaticPage(page)).toEqual([]);
  });
});

describe("static dispatch validation", () => {
  it("reports empty dispatch, missing initial, invalid ids, empty titles, and empty labels", () => {
    const diagnostics = validateStaticDispatch({
      kind: "dispatch",
      id: "bad id",
      initial: "missing",
      states: {
        "2bad": {
          title: "",
          actions: [{ id: "bad action", label: "", to: "missing" }],
        },
      },
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "InvalidStaticId",
        "MissingInitialState",
        "EmptyStateTitle",
        "EmptyActionLabel",
        "MissingActionTarget",
      ]),
    );

    expect(
      validateStaticDispatch({
        kind: "dispatch",
        id: "empty",
        initial: "anything",
        states: {},
      }).map((entry) => entry.code),
    ).toContain("EmptyDispatch");
  });

  it("reports duplicate action ids within a state and unreachable states as warnings", () => {
    const diagnostics = validateStaticDispatch({
      kind: "dispatch",
      id: "decision",
      initial: "start",
      states: {
        start: {
          title: "Start",
          actions: [
            { id: "go", label: "Go", to: "end" },
            { id: "go", label: "Go again", to: "end" },
          ],
        },
        end: {
          title: "End",
        },
        unreachable: {
          title: "Unreachable",
        },
      },
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["DuplicateActionId", "UnreachableStaticState"]),
    );
    expect(diagnostics.find((entry) => entry.code === "UnreachableStaticState")?.severity).toBe(
      "warning",
    );
  });

  it("warns for explicit raw HTML body and catches page-wide generated input id collisions", () => {
    const rawDispatch = H.dispatch({
      id: "raw-dispatch",
      initial: "raw",
      states: {
        raw: {
          title: "Raw",
          body: { kind: "html", html: "<strong>Trusted</strong>" },
        },
      },
    });

    expect(validateStaticDispatch(rawDispatch).map((entry) => entry.code)).toContain(
      "UnsafeRawHtmlContent",
    );
    expect(serializeStaticPageHtml(H.staticPage({ title: "Raw", body: [rawDispatch] }))).toContain(
      "<strong>Trusted</strong>",
    );

    const pageDiagnostics = validateStaticPage({
      kind: "page",
      title: "Collision",
      body: [
        rawDispatch,
        {
          kind: "tabs",
          id: "raw-dispatch-state",
          initial: "raw",
          tabs: [{ id: "raw", label: "Raw", content: "Raw" }],
        },
      ],
    });

    expect(pageDiagnostics.map((entry) => entry.code)).toContain("DuplicateStaticId");
  });
});

describe("static dispatch serialization", () => {
  it("emits radio inputs, screens, transition labels, and no JavaScript hooks", () => {
    const html = serializeStaticPageHtml(createDispatchPage());

    expect(html).toContain('class="machina-dispatch" id="plan-picker"');
    expect(html.match(/type="radio"/g)?.length).toBe(4);
    expect(html).toContain('name="plan-picker-state"');
    expect(html).toContain('id="plan-picker-state-team-size" checked');
    expect(html).toContain('for="plan-picker-state-starter-result"');
    expect(html).toContain('for="plan-picker-state-pro-result"');
    expect(html).toContain("machina-dispatch__screen machina-dispatch__screen--team-size");
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
  });

  it("omits the actions container for terminal states", () => {
    const html = serializeStaticPageHtml(
      H.staticPage({
        title: "Terminal",
        body: [
          H.dispatch({
            id: "terminal",
            initial: "done",
            states: {
              done: {
                title: "Done",
                body: "Nothing left to choose.",
              },
            },
          }),
        ],
      }),
    );

    expect(html).toContain("machina-dispatch__screen--done");
    expect(html).not.toContain("machina-dispatch__actions");
    expect(html).not.toContain("machina-dispatch__action");
  });

  it("escapes string body, titles, and labels", () => {
    const html = serializeStaticPageHtml(
      H.staticPage({
        title: "A <B>",
        body: [
          H.dispatch({
            id: "safe-dispatch",
            initial: "start",
            states: {
              start: {
                title: "One & Two",
                body: "<img src=x onerror=alert(1)>",
                actions: [{ id: "next", label: "Next & Safe", to: "end" }],
              },
              end: {
                title: "End",
              },
            },
          }),
        ],
      }),
    );

    expect(html).toContain("<title>A &lt;B&gt;</title>");
    expect(html).toContain("One &amp; Two");
    expect(html).toContain("Next &amp; Safe");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("emits hidden-screen base CSS and :checked selectors for each state", () => {
    const css = serializeStaticPageCss(createDispatchPage());

    expect(css).toContain(".machina-dispatch__screen {\n  display: none;");
    expect(css).toContain("#plan-picker-state-team-size:checked");
    expect(css).toContain("#plan-picker-state-starter-result:checked");
    expect(css).toContain("#plan-picker-state-pro-result:checked");
    expect(css).toContain("#plan-picker-state-enterprise-result:checked");
    expect(css).toContain("~ .machina-dispatch__screens .machina-dispatch__screen--team-size");
    expect(css).toContain("display: block;");
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });

  it("creates artifact files containing dispatch HTML and CSS", () => {
    const artifact = createStaticHtmlArtifact(createDispatchPage());

    expect(artifact.files.map((file) => file.path)).toEqual(["index.html", "generated.css"]);
    expect(artifact.files[0]?.text).toContain("machina-dispatch");
    expect(artifact.files[1]?.text).toContain(".machina-dispatch__input");
    expect(validateStaticPage(createDispatchPage()).map((entry) => entry.code)).toEqual([]);
  });
});

describe("static dispatch sample", () => {
  it("checks in generated output matching the serializer and contains no JavaScript", () => {
    const sampleRoot = join(process.cwd(), "samples", "static-dispatch", "dist");
    const html = readFileSync(join(sampleRoot, "index.html"), "utf8");
    const css = readFileSync(join(sampleRoot, "generated.css"), "utf8");
    const page = createDispatchPage();

    expect(html).toBe(serializeStaticPageHtml(page));
    expect(css).toBe(serializeStaticPageCss(page));
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });
});
