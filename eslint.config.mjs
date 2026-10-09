import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// The configuration `next lint` scaffolds for a TypeScript App Router project.
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // `_`-prefixed parameters are deliberately unused (React's useActionState
    // hands every action the previous state first).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
