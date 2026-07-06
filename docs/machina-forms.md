# Machina Forms

`machinalayout/form` adds a narrow bridge from columnar field tables to explicit form field render records.

Core thesis:

- forms are tables of fields
- author fields as rows
- validate by cell
- lower to render records
- JSX is the lowering target, not the source of truth

MachinaForm does not manage form state. It makes field definitions table-shaped and validates them by cell.

## Projecting concepts into form fields

Concept-to-form projection does not manage form state. It maps concept records into field records using caller-supplied values and projection options.

Core thesis:

- concepts are source records
- form fields are projection records
- value binding is supplied by the caller
- there is no path parser
- there is no form state manager
- there is no renderer
- your app renders `FormFieldRecord[]`

Project concepts directly when you already have `ConceptRecord[]`:

```ts
import { T } from "machinalayout/concept";
import { Form } from "machinalayout/form";

const concepts = T.conceptsFromTable(providerConcepts);

const fields = Form.fieldsFromConcepts(concepts, {
  values: {
    displayName: draft.provider.displayName,
    slug: draft.provider.slug,
    timeZoneId: draft.provider.timeZoneId,
    contactEmail: draft.provider.contactEmail,
    description: draft.provider.description,
  },
  disabled: () => !onProviderFieldChange || !entities.provider,
  inputIdPrefix: "setup-provider",
  testIdPrefix: "setup-provider",
});
```

`fieldsFromConcepts(...)` only projects records:

- `field` comes from `concept.concept`
- `label` comes from `concept.label`
- `changeKey` falls back to `concept.concept`
- `controlHint` may map to `"input"` or `"textarea"`
- values come from `values` or `valueForConcept`

Render manually at the app boundary:

```tsx
{fields.map((field) => (
  <div key={field.field}>
    <Label htmlFor={field.inputId}>{field.label}</Label>
    {field.control === "textarea" ? (
      <Textarea
        id={field.inputId}
        disabled={field.disabled}
        value={String(field.value ?? "")}
        onChange={(event) => onChange(field.changeKey, event.target.value)}
      />
    ) : (
      <Input
        id={field.inputId}
        disabled={field.disabled}
        value={String(field.value ?? "")}
        onChange={(event) => onChange(field.changeKey, event.target.value)}
      />
    )}
  </div>
))}
```

If your source is still a concept table, you can compose lowering and projection:

```ts
const fields = Form.fieldsFromConceptTable(providerConcepts, {
  projection: {
    values,
    disabled: true,
  },
});
```

Boundary:

- no dirty/touched tracking
- no async validation
- no submission orchestration
- no nested field arrays
- no path parser
- no form framework clone

## Field table schema

```ts
import { Form } from "machinalayout/form";
import { Table } from "machinalayout/table";

const providerFields = Table.defineWithSchema({
  id: "providerFields",
  schema: Form.fieldSchema(),
  columns: {
    field: ["displayName", "slug", "timeZoneId", "contactEmail", "description"],
    label: [
      "Provider name",
      "Public slug",
      "Timezone",
      "Contact email",
      "Short public description",
    ],
    control: ["input", "input", "input", "input", "textarea"],
    inputId: [
      "setup-provider-name",
      "setup-provider-slug",
      "setup-provider-timezone",
      "setup-provider-email",
      "setup-provider-description",
    ],
    value: [
      props.draft.provider.displayName,
      props.draft.provider.slug,
      props.draft.provider.timeZoneId,
      props.draft.provider.contactEmail,
      props.draft.provider.description,
    ],
    changeKey: ["displayName", "slug", "timeZoneId", "contactEmail", "description"],
    disabled: [
      !props.onProviderFieldChange || !props.entities.provider,
      !props.onProviderFieldChange || !props.entities.provider,
      !props.onProviderFieldChange || !props.entities.provider,
      !props.onProviderFieldChange || !props.entities.provider,
      !props.onProviderFieldChange || !props.entities.provider,
    ],
    placeholder: [undefined, undefined, undefined, undefined, undefined],
    description: [undefined, undefined, undefined, undefined, undefined],
    required: [true, true, true, false, false],
    testId: [
      "setup-provider-name",
      "setup-provider-slug",
      "setup-provider-timezone",
      "setup-provider-email",
      "setup-provider-description",
    ],
  },
});
```

Supported controls in M35i:

- `input`
- `textarea`

## Lowering field tables

```ts
import { Form } from "machinalayout/form";

const fields = Form.fieldsFromTable(providerFields);
```

Each row becomes one explicit `FormFieldRecord`:

```ts
{
  kind: "formField",
  field: "displayName",
  label: "Provider name",
  control: "input",
  inputId: "setup-provider-name",
  value: props.draft.provider.displayName,
  changeKey: "displayName",
  disabled: false,
  required: true,
  testId: "setup-provider-name",
}
```

The core helper stops there. It does not render JSX for you.

## Manual React rendering

Render records stay explicit at the app boundary:

```tsx
{fields.map((field) => (
  <div key={field.field} className="space-y-2">
    <Label htmlFor={field.inputId}>{field.label}</Label>
    {field.control === "textarea" ? (
      <Textarea
        disabled={field.disabled}
        id={field.inputId}
        value={String(field.value ?? "")}
        onChange={(event) => onChange(field.changeKey, event.target.value)}
      />
    ) : (
      <Input
        disabled={field.disabled}
        id={field.inputId}
        value={String(field.value ?? "")}
        onChange={(event) => onChange(field.changeKey, event.target.value)}
      />
    )}
  </div>
))}
```

This keeps dependency direction clean:

- `machinalayout/form` depends on table authoring
- React rendering stays in the app or adapter layer
- JSX is the lowering target, not the source of truth

## Validation and diagnostics

Use `Form.validateFieldTable(table)` when you want diagnostics without throwing.

```ts
const diagnostics = Form.validateFieldTable(providerFields);
```

Example diagnostic:

```txt
error InvalidFormFieldControl at providerFields.control[4]
  Form field control must be "input" or "textarea".
```

Duplicate field names and duplicate `inputId` values are also rejected:

```txt
error DuplicateFormFieldInputId at providerFields.inputId[3]
  Input id "setup-provider-name" already appears at row 0.
```

## Description helpers

`Form.describeFields(fields, providerFields.id)` returns a compact summary:

- `fieldCount`
- distinct `controls` in encounter order
- `tableId`

Use it for docs, previews, and audit artifacts rather than runtime state.
