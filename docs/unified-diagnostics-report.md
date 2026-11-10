# Unified diagnostics: implementation report

Item 5 from the ergonomics design pass: one diagnostic shape across the library.

## What I found first

- **Not a type problem.** 13 of the 17 diagnostic types were *already* structurally compatible with `MachinaDiagnostic`. The exceptions were text diagnostics (no `severity`), artifact diagnostics (`artifact`/`diff` instead of `path`/`details`), and `MachinaErrorDiagnostic`, which is error serialization rather than a diagnostic and is left alone.
- **The real costs were three:**
  - **Eleven formatters.** Seven were the same copy-pasted one-liner; two of those returned `""` for an empty list and the rest returned "No X diagnostics.".
  - **A lossy adapter.** `D.from` rebuilt each diagnostic from five fields, so the concept fix hint, origin and expected type were dropped whenever diagnostics were combined. The toolkit sample's combined report never showed fixes for this reason.
  - **Manual path re-basing** that moved `path` but not `fix.path`, which only became visible once `D.from` stopped dropping `fix`.

## What changed

- **`MachinaDiagnostic` gains `fix`** (moved from concepts; `ConceptFix` is now an alias). A fix hint is useful from any module, not only concepts.
- **`DiagnosticOf<Extras, Codes>`:** every module diagnostic type is now the shared shape plus module-specific fields and a narrowed code union. Severity stays narrowed to `"error" | "warning"` where modules never emit `info`, so consumers lose no type information. A compile-time test asserts all 13 types extend `MachinaDiagnostic`.
- **`D.collect` preserves element types** (`ConceptDiagnostic | TableDiagnostic`), so module fields survive combination.
- **`D.from` is lossless.** It only fills a missing `source`.
- **`D.within(prefix, diagnostics)`** re-bases `path` and `fix.path` together. Dogfood found the need: the toolkit sample re-based by hand, and after `D.from` became lossless its report showed a fix pointing at `customerId` under a diagnostic at `orders[2].customerId`.
- **`D.format` is the one engine:** `style: "block" | "line"`, an `empty` text option, and `fix`/`details` rendering. All 11 module formatters are one-line delegations; together they shrank from 154 lines to 52.
- **Smaller fixes:** text diagnostics gain `severity`, `path` (`line:column`) and `source: "text"`. Artifact diagnostics use `path`/`details` (that API is from #68 and had no external users yet).

Net in `src/`: +238 / −255 across 27 files, while adding `fix`, `within`, the `line` style, and lossless combining.

## Decisions worth reviewing

1. **Formatter outputs are preserved, with two exceptions.** Query diagnostics are now blank-line separated, like table diagnostics (no test or sample depended on the old format). Workflow diagnostics show `at log[n]` instead of `(step n)`: every step-carrying diagnostic now has that path, and one that lacked it gained it.
2. **`source` is not stamped by every module.** Codes are already namespaced (`MissingConceptField`, `ColumnLengthMismatch`), and making `source` required would churn hundreds of test expectations for little gain. Text diagnostics get it because their codes (`unsupported_syntax`) are generic. `D.from` remains the one-line way to label a group.
3. **`CompatibleDiagnostic` is a deprecated alias of `MachinaDiagnostic`.** Removing it is a later, breaking cleanup.

## Verification

- `tsc --noEmit` is clean. Biome is clean on touched files.
- Vitest: 1247 passed, 0 failed (4 new tests, including the compile-time all-modules assertion).
- The toolkit sample's checked-in report was regenerated through `CT.write`. Its combined diagnostics now include the fix line, which was the user-visible point of this change.
