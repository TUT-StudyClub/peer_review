import tseslint from "typescript-eslint";

export default tseslint.config({
  ignores: [".next/**", "out/**", "build/**", "node_modules/**", "*.config.*"],
});
