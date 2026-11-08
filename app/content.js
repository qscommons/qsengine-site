// Everything the site says about qsengine, in one place.
// The documentation itself is the Markdown in the repository's docs/ folder; see scripts/sync-docs.mjs.

import DOCS_NAV from "./docs-nav.json";

// From Cargo.toml, set in next.config.mjs.
export const VERSION = process.env.QSENGINE_VERSION;
export const SITE = "https://qsengine.kaiwave.dev";
export const REPO = "https://github.com/kaiwave/qsengine";
export const PYPI = "https://pypi.org/project/qsengine/";

// The documentation, grouped the way the /docs index and the sidebar show it, from docs/README.md.
// `key` pages (`home: true` in their front matter) are also listed on the home page.
export const DOCS = DOCS_NAV;
