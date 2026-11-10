import { describe, expect, it } from "vitest";
import { CT, formatArtifactDiagnostics } from "../../src/comptime";
import { nodeArtifactFs } from "../../src/comptime/node";
import { T } from "../../src/concept";
import { Provider } from "./fixtures/generated/provider.concept";
import { providerArtifacts } from "./fixtures/provider.artifacts";

// A table-lowered concept is runtime data, so T.Infer on it is Record<string, unknown>.
// The baked module is a literal, so T.Infer is exact.
const _exact: T.Matches<
  typeof Provider,
  {
    displayName: string;
    slug: string;
    status: "draft" | "live" | "archived";
    contactEmail?: string;
  }
> = true;

describe("baked concept module", () => {
  it("is in sync with its generator and inputs", async () => {
    const diagnostics = await CT.check(providerArtifacts, {
      fs: nodeArtifactFs(),
      root: process.cwd(),
    });
    expect(formatArtifactDiagnostics(diagnostics)).toBe("No artifact diagnostics.");
  });

  it("is still a working concept at runtime", () => {
    expect(
      T.validate(Provider, { displayName: "Acme", slug: "acme", status: "lve" })[0]?.fix,
    ).toEqual({ op: "replace", path: "status", expected: '"live"' });
    const value: unknown = { displayName: "Acme", slug: "acme", status: "live" };
    if (T.is(Provider, value)) {
      const status: "draft" | "live" | "archived" = value.status;
      expect(status).toBe("live");
    }
  });
});
