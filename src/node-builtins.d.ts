declare module "node:fs/promises" {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  export function copyFile(src: string, dest: string): Promise<void>;
  export function writeFile(path: string, data: string, encoding?: string): Promise<void>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function rm(path: string, options?: { force?: boolean }): Promise<void>;
}

declare module "node:path" {
  const path: {
    resolve(...paths: string[]): string;
    join(...paths: string[]): string;
    extname(path: string): string;
    dirname(path: string): string;
  };
  export default path;
}
