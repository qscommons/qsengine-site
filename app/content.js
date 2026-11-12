// Everything the site says about qsengine, in one place.
// The documentation itself is the Markdown in the docs/ folder of qscommons/qsengine; see scripts/sync-docs.mjs.

import DOCS_NAV from "./docs-nav.json";

// From Cargo.toml, set in next.config.mjs.
export const VERSION = process.env.QSENGINE_VERSION;
export const SITE = "https://qsengine.qscommons.org";
// qsengine's home page, on qscommons.org. This site is the documentation only.
export const HOME = "https://qscommons.org/projects/qsengine/";
export const REPO = "https://github.com/qscommons/qsengine";
export const PYPI = "https://pypi.org/project/qsengine/";

// The documentation, grouped the way the /docs index and the sidebar show it, from docs/README.md.
export const DOCS = DOCS_NAV;
