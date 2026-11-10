import { camel, kebab, pascal } from "./case";
import { blank, block, indent, lineArray, lines, list } from "./lines";
import { centerPad, leftPad, rightPad } from "./pad";
import { slug } from "./slug";
import { truncate } from "./truncate";

export const Text = {
  leftPad,
  rightPad,
  centerPad,
  truncate,
  slug,
  kebab,
  camel,
  pascal,
  lines,
  lineArray,
  block,
  list,
  indent,
  blank,
} as const;
