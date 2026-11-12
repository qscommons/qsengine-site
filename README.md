# qsengine-site

The website for [qsengine](https://github.com/qscommons/qsengine), published at [qsengine.qscommons.org/docs](https://qsengine.qscommons.org/docs/). qsengine's home page is [its project page on qscommons.org](https://qscommons.org/projects/qsengine/); `/` on this site redirects there.

This repository holds only the site: layout, navigation, styling and the build. The documentation itself is Markdown in the [docs/ folder of qsengine](https://github.com/qscommons/qsengine/tree/main/docs), so it changes in the same pull requests as the code. To fix or add a page, edit it there; [docs/README.md](https://github.com/qscommons/qsengine/blob/main/docs/README.md) explains how pages are written.

## How it publishes

[The workflow](.github/workflows/site.yml) builds the site from qsengine's latest release, so the site describes the version `pip install qsengine` gives you. It runs on every push here and once a day, which picks up a new engine release within a day. Run it by hand from the Actions tab to publish sooner, or give it an engine branch or tag (for example `main`) to publish docs changes before the next release.

## Local preview

Clone both repositories side by side:

```bash
git clone https://github.com/qscommons/qsengine.git
git clone https://github.com/qscommons/qsengine-site.git
cd qsengine-site
npm install
npm run dev
```

`npm run dev` rebuilds pages as you edit `../qsengine/docs/`. `npm run build` writes the static site to `out/`. To build from a checkout somewhere else, set `QSENGINE_ROOT` to its path.

Next.js with static export; maths is rendered with KaTeX at build time.
