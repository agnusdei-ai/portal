import { readFileSync } from "node:fs";

/**
 * Comments in these files explain what the schema refuses to hold, and so name
 * the very things it refuses to hold. The invariants are about code.
 */
export function readStripped(url) {
  return readFileSync(url, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(--|\/\/).*$/, ""))
    .join("\n");
}
