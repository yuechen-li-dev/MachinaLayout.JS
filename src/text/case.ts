function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase());
}

function capitalize(value: string): string {
  return value.length === 0 ? "" : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

export function kebab(value: string): string {
  return words(value).join("-");
}

export function pascal(value: string): string {
  return words(value).map(capitalize).join("");
}

export function camel(value: string): string {
  const [first = "", ...rest] = words(value);
  return `${first}${rest.map(capitalize).join("")}`;
}
