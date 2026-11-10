/**
 * A re-iterable lazy sequence: each `for...of` calls the factory again, so
 * iterating twice gives the same items twice (unlike a generator object).
 */
export function seq<TItem>(factory: () => Iterable<TItem>): Iterable<TItem> {
  return {
    [Symbol.iterator]: () => factory()[Symbol.iterator](),
  };
}

export class IteratorReusedError extends Error {
  constructor(label: string) {
    super(
      `Iterator '${label}' was iterated again after it was consumed; the second pass would silently see nothing. Use I.seq(() => ...) for a re-iterable sequence, or collect to an array first.`,
    );
    this.name = "IteratorReusedError";
  }
}

/**
 * Wrap a one-shot iterable (typically a generator object) so a second
 * iteration throws instead of silently yielding nothing.
 */
export function once<TItem>(iterable: Iterable<TItem>, label = "iterator"): Iterable<TItem> {
  let started = false;
  return {
    [Symbol.iterator]: () => {
      if (started) {
        throw new IteratorReusedError(label);
      }
      started = true;
      return iterable[Symbol.iterator]();
    },
  };
}
