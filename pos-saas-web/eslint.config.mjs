import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  { ignores: [".next/**", "node_modules/**", "coverage/**"] },
  {
    rules: {
      // Async data loading in effects is intentional in these client pages.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
