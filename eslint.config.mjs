// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config( // Use tseslint.config helper for convenience
    // 1. Global ignores
    {
        ignores: [
            "node_modules/",
            "dist/", // Add other build/output directories if needed
            "build/",
            "out/",
            "webpack.config.js",
            // Add any other patterns to ignore globally
        ],
    },

    // 2. ESLint Recommended Rules (applies globally)
    // This replaces 'eslint:recommended'
    js.configs.recommended,

    // 3. TypeScript Recommended Rules (applies to *.ts, *.tsx, *.mts, *.cts)
    // This replaces 'plugin:@typescript-eslint/recommended' and implicitly
    // configures the TypeScript parser and plugin for these files.
    ...tseslint.configs.recommended,

    // 4. Custom Global Configurations (apply after recommended)
    {
        languageOptions: {
            // Replaces env: { node: true }
            globals: {
                ...globals.node, // Adds all Node.js global variables
            },
        },
        rules: {
            // Your global rule customizations from the old 'rules' section
            "semi": ["error", "always"], // Note: severity '2' is 'error'

            // Your TypeScript rule overrides. These will only affect TS files
            // because the TS parser/plugin are only active for TS files
            // as configured by tseslint.configs.recommended above.
            "@typescript-eslint/no-unused-vars": "off", // Note: severity '0' is 'off'
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
        },
    },

    // 5. Overrides for JavaScript / JSX files (from the old 'overrides' section)
    {
        files: ["**/*.js", "**/*.jsx"], // Target specific JS/JSX files
        // Apply specific rules for these files
        rules: {
            // Your override rule for JS/JSX files
            "@typescript-eslint/no-var-requires": "off",
        },
        // Note: Node globals are already applied from the global config block above.
        // If these JS files had a *different* environment (e.g., browser),
        // you would specify different globals here.
    }
);

