# CRM v2 — a clickable mockup

This is a **design mockup**, not a product and not a working CRM. It exists so a
few people can click through an idea and argue about it before anyone builds it.

## Everything in it is invented

Every name, email address, phone number, message and amount of money in this app
was made up for the demo. **There is no customer data here of any kind.** The
data is generated in the browser from a fixed seed, which is why the same demo
looks the same every time you open it.

The app says so on every screen: the stripe across the top reads
*"a demo · no real data"*.

## It runs entirely in your browser

There is no server, no database and no API. Opening the page builds the whole
demo in memory. **It makes no network requests at all** — you can disconnect and
it still works. Anything you change (adding a person, hiding one, running an
import) is saved only in that browser's own storage and never leaves it.

Where a real product would talk to something outside itself — sending an email,
reading a payments export, connecting a mailbox — the mockup stops at a clearly
marked line saying what the real product would do at that point. It never
pretends to have done it.

## Running it

```bash
npm install
npm run dev      # a dev server with hot reload
npm run build    # writes dist/index.html
```

The build is a **single self-contained file**. `dist/index.html` carries the
script, the stylesheet and the fonts inline, so it can be opened by
double-clicking it with no server and no connection.

## What is in here

```
src/            the app: pages, components, the demo's data and its engine
index.html      the shell Vite builds from
public/         files copied to the site root as they are
netlify.toml    build settings and headers for the hosted copy
```

Built with React 19, Vite 7 and Tailwind 4.

## What is not in here

The working notes, the specification, the acceptance checks and the design
research that produced this live alongside it and are not published. This
repository is the app only.
