import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHtmlArtifact, H } from "../../../dist/static/index.js";

export const searchForm = H.httpAction({
  id: "site-search",
  method: "GET",
  action: "/search",
  title: "Search",
  description:
    "This form submits a native browser GET request. The server response is normal page navigation.",
  submitLabel: "Search",
  fields: [
    {
      id: "q",
      kind: "search",
      label: "Query",
      placeholder: "machina static",
      required: true,
      autocomplete: "off",
    },
  ],
});

export const contactForm = H.httpAction({
  id: "contact-form",
  method: "POST",
  action: "/contact",
  title: "Contact",
  description:
    "This form submits a native browser POST request. Handling, persistence, and validation beyond HTML attributes belong to the server.",
  submitLabel: "Send",
  fields: [
    {
      id: "source",
      kind: "hidden",
      value: "machina-static",
    },
    {
      id: "email",
      kind: "email",
      label: "Email",
      required: true,
      autocomplete: "email",
    },
    {
      id: "message",
      kind: "textarea",
      label: "Message",
      required: true,
      placeholder: "What should the server receive?",
    },
  ],
});

export const docsLink = H.httpLink({
  id: "docs-link",
  href: "/docs",
  label: "Read docs",
});

export const page = H.staticPage({
  title: "Machina Static HTTP",
  body: [searchForm, contactForm, docsLink],
});

const artifact = createStaticHtmlArtifact(page);
const sampleRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(sampleRoot, "dist");

mkdirSync(distRoot, { recursive: true });
for (const file of artifact.files) {
  writeFileSync(join(distRoot, file.path), file.text);
}
