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
import ts from "typescript";

/**
 * Transpiles a TypeScript module in memory and evaluates it, so tests run the
 * real functions while the suite stays plain `node --test` with no build step.
 * Modules loaded this way must be import-free; the require stub fails loudly
 * if one starts reaching for runtime dependencies.
 */
export function loadModule(url) {
  const source = readFileSync(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const exports = {};
  const module = { exports };
  new Function("exports", "module", "require", outputText)(
    exports,
    module,
    (name) => {
      throw new Error(`A tested module required "${name}" — keep tested modules import-free.`);
    },
  );
  return module.exports;
}

