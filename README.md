# pm_trainsim

A 3D miniature model train set in the browser — a little diorama with an oval
of track and an LNER A4 (Mallard) you can drive, built for Safari on iPhone
and iPad. See [CLAUDE.md](CLAUDE.md) for the project vision and architecture.

**Play it:** <https://quietsnooze.github.io/pm_trainsim/> (deployed from `main`
by GitHub Actions on every push).

## Run it

```
npm install
npm run dev
```

To try it on your iPhone/iPad, run the dev server on your LAN and open the
printed Network URL in Safari:

```
npm run dev -- --host
```

Or build the static site (`npm run build`) and serve `dist/` from any static
host (GitHub Pages, Netlify, etc.).
