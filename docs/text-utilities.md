# Text Utilities

Machina includes a tiny dependency-free set of deterministic text helpers at
`machinalayout/text`.

`leftPad` is included because small deterministic string operations should not require tiny
third-party dependencies. Yes, it is the old joke, but the useful version is simple: Machina users
should not need a separate `left-pad` package for predictable padding.

These helpers are intentionally small. They are not a Unicode grapheme cluster engine, ICU
replacement, localization framework, markdown parser, template engine, or formatting DSL.

## String Length

Padding and truncation use JavaScript string length units (`value.length`). They do not count
user-visible Unicode grapheme clusters. This keeps the helpers dependency-free and deterministic,
but it means complex emoji sequences and combining marks may not behave like a human text editor.

## Padding

```ts
import { centerPad, leftPad, rightPad, Text } from "machinalayout/text";

leftPad("7", 3); // "  7"
leftPad("7", 3, "0"); // "007"
leftPad("abc", 2); // "abc"
leftPad("x", 5, "ab"); // "ababx"

rightPad("7", 3); // "7  "
rightPad("7", 3, "0"); // "700"
rightPad("x", 5, "ab"); // "xabab"

centerPad("x", 5); // "  x  "
centerPad("x", 4); // " x  "

Text.leftPad("7", 3, "0"); // "007"
```

If center padding needs an odd number of padding characters, the extra character goes on the right.
Empty fill strings and invalid lengths throw `TextFormatError`.

## Truncate

```ts
import { truncate } from "machinalayout/text";

truncate("abcdef", { maxLength: 4 }); // "abc…"
truncate("abcdef", { maxLength: 4, ellipsis: "..." }); // "a..."
truncate("abc", { maxLength: 5 }); // "abc"
```

When the ellipsis is as long as or longer than `maxLength`, it is sliced to the requested length.
Invalid truncate lengths throw `TextFormatError`.

## Case Helpers

```ts
import { camel, kebab, pascal } from "machinalayout/text";

kebab("buttonPrimary"); // "button-primary"
kebab("Button Primary"); // "button-primary"
kebab("button_primary"); // "button-primary"
kebab(" button--primary "); // "button-primary"

pascal("button-primary"); // "ButtonPrimary"
pascal("button primary"); // "ButtonPrimary"

camel("button-primary"); // "buttonPrimary"
camel("Button Primary"); // "buttonPrimary"
```

`kebab` is a code and class-name casing helper. It lowercases ASCII words, handles common camel and
Pascal boundaries, and collapses repeated separators.

## Slug

```ts
import { slug } from "machinalayout/text";

slug("Hello, Machina!"); // "hello-machina"
slug("  A/B Test #42  "); // "a-b-test-42"
```

`slug` is intended for stable ID and URL-ish cleanup. It is ASCII-ish: it lowercases, keeps ASCII
letters and numbers, treats other runs as separators, collapses separators, and trims them. It does
not transliterate non-ASCII text.

## Error Type

```ts
import { TextFormatError } from "machinalayout/text";
```

`TextFormatError` uses stable codes:

- `InvalidTextLength`
- `InvalidTextFill`
- `InvalidTruncateLength`
