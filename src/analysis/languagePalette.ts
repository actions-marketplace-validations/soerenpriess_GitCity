import type { Architecture } from "../types.js";

export interface LanguageStyle {
  architecture: Architecture;
  // Main facade / glass tint.
  facade: string;
  //Trim, light, or signage color.
  accent: string;
}

/**
 * One architectural family per language group:
 * - glass: TypeScript / JavaScript – glass curtain walls, bright windows
 * - eco: Python – green roofs, warm lights, round towers and terraces
 * - industrial: Rust – corrugated metal, rust-red trim, chimneys, bracing
 * - functional: Go – clean cubes, cool colors, regular grids
 * - monolith: Java & JVM/.NET – large solid buildings with podium and crown
 * - tech: C / C++ – steel panels, vents, pipes, dishes, blinking LEDs
 * - creative: HTML / CSS – colorful floors, shop windows, awnings, billboards
 * - neon: shaders – dark walls, glowing windows, holograms
 * - library: Markdown & docs – libraries with columns, small shops with signs
 * - operations: shells and infrastructure – control rooms and service pipes
 * - data: SQL and query languages – storage tanks and database halls
 * - brick: anything else – neutral brick and concrete
 */
export const ARCHITECTURE_DEFAULTS: Record<Architecture, LanguageStyle> = {
  glass: { architecture: "glass", facade: "#5b9be6", accent: "#eef9ff" },
  eco: { architecture: "eco", facade: "#efe2c4", accent: "#ffd66b" },
  industrial: {
    architecture: "industrial",
    facade: "#9aa3ad",
    accent: "#c4562a",
  },
  functional: {
    architecture: "functional",
    facade: "#e8f1f4",
    accent: "#00add8",
  },
  monolith: { architecture: "monolith", facade: "#c98b5b", accent: "#f2dcc0" },
  tech: { architecture: "tech", facade: "#5b6472", accent: "#5df28a" },
  creative: { architecture: "creative", facade: "#f07aa0", accent: "#ffe066" },
  neon: { architecture: "neon", facade: "#2c2745", accent: "#7df9ff" },
  library: { architecture: "library", facade: "#efe4cc", accent: "#c0533a" },
  operations: {
    architecture: "operations",
    facade: "#68758a",
    accent: "#f2b632",
  },
  data: { architecture: "data", facade: "#4b8d9c", accent: "#7df9d2" },
  brick: { architecture: "brick", facade: "#b5654a", accent: "#e9e1d2" },
};

const style = (
  architecture: Architecture,
  facade?: string,
  accent?: string,
): LanguageStyle => ({
  architecture,
  facade: facade ?? ARCHITECTURE_DEFAULTS[architecture].facade,
  accent: accent ?? ARCHITECTURE_DEFAULTS[architecture].accent,
});

export const LANGUAGE_STYLES: Record<string, LanguageStyle> = {
  TypeScript: style("glass", "#4f8fe0"),
  JavaScript: style("glass", "#e8c04a", "#fff6d0"),
  Python: style("eco"),
  "Jupyter Notebook": style("eco", "#f3d9b5"),
  R: style("eco", "#7d91d1", "#dce5ff"),
  Julia: style("eco", "#a86478", "#83c6a5"),
  Rust: style("industrial"),
  Zig: style("industrial", "#a39a8f", "#f7a41d"),
  Ruby: style("creative", "#b8324a", "#ffd0d8"),
  PHP: style("creative", "#8275b5", "#e7e0ff"),
  Go: style("functional"),
  Dart: style("functional", "#4b9fc5", "#bceaff"),
  Swift: style("functional", "#d46a45", "#ffe0ca"),
  Java: style("monolith"),
  Kotlin: style("monolith", "#b98ad8", "#f3e3ff"),
  Scala: style("monolith", "#c8615a"),
  "C#": style("monolith", "#8f7fd0", "#e6e0ff"),
  C: style("tech"),
  "C++": style("tech", "#5f5578", "#c79bff"),
  "Objective-C": style("tech", "#55707a", "#7fd3ff"),
  Assembly: style("tech", "#4e5560", "#ffb347"),
  CUDA: style("tech", "#668f36", "#d6ff72"),
  Fortran: style("tech", "#685b9e", "#d5c9ff"),
  "Visual Basic .NET": style("monolith", "#5476b9", "#d2e0ff"),
  HTML: style("creative", "#f07aa0", "#ffe066"),
  CSS: style("creative", "#9b7bea", "#7df2d0"),
  SCSS: style("creative", "#d673b0", "#ffe066"),
  Vue: style("creative", "#41b883", "#ffe066"),
  Svelte: style("creative", "#ff6a3d", "#ffe066"),
  Astro: style("creative", "#ff7a45", "#c9a7ff"),
  Ember: style("creative", "#d45b38", "#ffe0ca"),
  Solid: style("creative", "#4277c5", "#dbe9ff"),
  Qwik: style("creative", "#7855cc", "#e6d9ff"),
  GLSL: style("neon"),
  HLSL: style("neon", "#2a2c48", "#ff6ad5"),
  WGSL: style("neon", "#252a44", "#b4ff6a"),
  ShaderLab: style("neon", "#2e2440", "#ff6ad5"),
  Metal: style("neon", "#262b3a", "#7df9ff"),
  Elixir: style("neon", "#574273", "#d6a8ff"),
  Erlang: style("neon", "#754556", "#ffb6c8"),
  Haskell: style("neon", "#563b72", "#d6a8ff"),
  Markdown: style("library"),
  MDX: style("library", "#efe4cc", "#3d7bd9"),
  TeX: style("library", "#e9dfc6", "#3f8a5c"),
  reStructuredText: style("library"),
  AsciiDoc: style("library"),
  Shell: style("operations"),
  Bash: style("operations", "#617b73", "#a9e5d5"),
  Zsh: style("operations", "#657d58", "#c5e98b"),
  Fish: style("operations", "#5a8b8d", "#c1f3ea"),
  PowerShell: style("operations", "#365c9a", "#9ac7ff"),
  Makefile: style("operations", "#8b7150", "#ffe0a6"),
  Dockerfile: style("operations", "#3c7892", "#a7e7ff"),
  Nix: style("operations", "#527ca8", "#c0e0ff"),
  HCL: style("operations", "#645c9d", "#d1c9ff"),
  Terraform: style("operations", "#645c9d", "#d1c9ff"),
  SQL: style("data"),
  PLpgSQL: style("data", "#45778e", "#a8e7ff"),
  TSQL: style("data", "#55748f", "#c0ddff"),
  "PL/SQL": style("data", "#b86f3e", "#ffe0a6"),
  MySQL: style("data", "#468b9a", "#b8f5e8"),
  "Transact-SQL": style("data", "#55748f", "#c0ddff"),
  JSON: style("data", "#8f7e3c", "#ffe987"),
  YAML: style("operations", "#9b6849", "#ffd2a8"),
  TOML: style("operations", "#826352", "#ffe0c5"),
  XML: style("creative", "#6c9e78", "#d2f3d8"),
  GraphQL: style("data", "#9c4b82", "#ffd0ee"),
  Prisma: style("data", "#466a91", "#c2e0ff"),
};

export function languageStyle(
  language: string | null | undefined,
): LanguageStyle {
  if (!language) return ARCHITECTURE_DEFAULTS.brick;
  return LANGUAGE_STYLES[language] ?? ARCHITECTURE_DEFAULTS.brick;
}
