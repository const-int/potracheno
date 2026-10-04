# potracheno — family expenses

A mobile web app for one family: a shared account, expenses in rubles,
custom categories, expense history, monthly insights, and CSV export.
Built with React, TypeScript, and Vite. Supabase handles storage and authentication;
GitHub Pages hosts the frontend. No custom backend is required.

The application interface is in Russian.
Categories offer 40 fresh, contrasting colors across the full spectrum, including warm tones, greens, blues, purples, pinks, and neutrals and 28 curated icons: the family's ten categories,
plus groceries, travel, bills, star, bicycle, lightning, puzzle, compass, lightbulb, book, palette, tools, gamepad, diamond, sparkles, flag, cube, and clover.
The compact editor presents icons in seven columns, with Other at the bottom right.
Fuel is no longer offered for new selections; existing fuel icons remain supported.
Existing category colors are preserved, including previously selected pastel colors.
Icon strokes use a darker variant when necessary for contrast.
For an existing Supabase project, run
`supabase/migrations/20261004_abstract_category_icons.sql` once in SQL Editor
to allow the expanded icon set. New projects can use the updated `schema.sql`.
Amounts use commas to group thousands (for example, `1,234 ₽`). Amounts throughout the interface are rounded up to whole rubles.
Original fractional amounts remain stored exactly, including when editing only the
date or category. CSV amounts retain a decimal point without grouping.

On phones, the app opens on the expense tab. Enter an amount using the built-in
numeric keypad, choose a category, and tap the checkmark key to save. New amounts
use whole rubles only. The keypad has a backspace key instead of a decimal key;
there is no separate backspace button next to the amount. The entry
screen preselects the first available category. The entered amount survives tab switches
and is cleared after a successful save or when leaving the account.
It fits the viewport without page scrolling or the phone's native keyboard. Categories
sit directly above the keypad, with no blank rows or unused pager space. The amount
is centered in the remaining space above them. The entry screen locks document
scrolling and uses the visual viewport height, recalculated on resize and resume.
Other tabs keep normal scrolling. Switching tabs always opens the destination at the top.
Overscroll bounce and pull-to-refresh are disabled.
The expense picker uses two columns and five rows on phones.
New mobile expenses use today's date and an empty note. More than ten categories
are displayed on additional pages. Use the edit button in History to change a date or amount. The editor also offers
immediate expense deletion without a confirmation step. Expense comments are not used.
Mobile History shows the month selector, category filter, total, and expense list.
With no categories checked, all expenses are included; selecting one or more categories
filters both the list and its total for the selected month. Clearing every checkbox restores all categories. The dropdown includes category icons
and uses the available height above mobile navigation. A reset button appears beside
the trigger when any categories are selected. Summary places
a treemap of soft rounded blocks sized by category shares, separated by small gaps, followed by horizontal
bars sorted by amount with totals and percentages. The treemap is a static visualization without hover or click actions.
Labels use white text directly on the category color, and are hidden on blocks
narrower than 60px.
Compact cards below show the operation count, average expense, costliest day, and
largest expense for the selected period. The Month/Year toggle defaults to Month;
yearly mode adds the costliest month and average monthly total. The average includes
zero-spend months between the first and last recorded expense months in the selected year,
while excluding empty months before and after that range. Daily totals use the expense date; tied
maximum days use the most recent date. CSV export is available in Settings on mobile.

Categories have one edit button in the list. Category deletion is available in the
editor and requires confirmation.
There is no category archive. Deletion requires confirmation; categories with expenses
remain protected until those expenses are moved to another category or deleted. For an existing Supabase
project, run `supabase/migrations/20261003_enable_category_deletion.sql` in SQL Editor
to enable owner-only deletion. The foreign key protects categories used by expenses.

Drag categories by the grip on the right to change their order. The expense picker uses
this same order. Changes save automatically and sync through Supabase; new categories
appear at the end. Mouse, touch, and keyboard (Space, arrows, Space) are supported.
For an existing project, run `supabase/migrations/20261004_category_order.sql` in SQL Editor.
The order is updated atomically through an owner-scoped, RLS-protected database function.

Touch zoom is disabled with viewport limits, a pan-only touch policy, and Safari gesture
handlers. Single-finger scrolling, keypad taps, and category dragging remain available.
The Safari fallback cancels multi-touch events without canceling ordinary touches.

## Run locally

Requires Node.js 22.12 or later (version 24 is recommended).

```bash
npm ci
npm run dev
```

Open http://localhost:5173. Until Supabase is configured, use the demo button
on the welcome screen. Sample data and changes are saved only in the current
browser and do not sync between devices. Demo storage is separate from the
shared database. The third sign-in field asks for your name. Each person enters
their own name while using the same shared email and password. Your name stays in
your browser and is recorded as the author of new expenses. You can change it in
Settings or enter a different name when signing in again. Existing expense authors
are preserved.

## Connect Supabase

1. Create a project on the free plan at https://supabase.com/dashboard.
2. Run the entire `supabase/schema.sql` file once in the new project's SQL Editor.
3. In Authentication → Users, create one user with an email and password.
   Confirm the email when creating the user administratively. Use these same
   credentials on both phones. Disable public sign-ups in Authentication settings.
   The application has no registration form.
4. Copy the Project URL and **publishable key** from the project settings.
   Do not use a secret key or service_role key: these bypass database protection.
5. Copy `.env.example` to `.env.local` and fill in both values.
   Restart `npm run dev`. Never put the account password in the code or `.env`.
6. Sign in to the application. Open Categories and add the default list or create
   your own categories. You can then start recording expenses.

Row Level Security (RLS) restricts each request to the record's owner (`auth.uid()`).
A composite foreign key prevents expenses from referencing another user's category.
The publishable key is intended for browser use; access protection relies on the
session and RLS. Categories used by expenses cannot be deleted until those expenses are moved or removed.

To check the connection, sign in on two devices, add an expense on the first,
and return to the app on the second to confirm that it appears. Data refreshes
when you return to the browser tab, every 30 seconds while the tab is active,
and after changes. If a refresh fails, the app displays an error and the last
loaded data. Offline operation and queued offline expenses are not supported
in this version.

## Publish to GitHub Pages

1. Create a **public** GitHub repository named `potracheno` without an initial README.
   Use a public repository for free GitHub Pages hosting.
2. Add the remote and push the files:

   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/potracheno.git
   git commit -m "feat: create family expense tracker"
   git push -u origin main
   ```

3. In Settings → Secrets and variables → Actions → **Variables**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   These values are included in the public build, as expected for a publishable key.
4. In Settings → Pages, select **GitHub Actions** as the source.
5. If the first deployment ran before the variables were configured, open
   Actions → Deploy to GitHub Pages → Run workflow. The workflow displays
   the published site URL.

Vite's relative base supports hosting under a repository subpath. Navigation
between screens does not change the URL and requires no server-side routing.

## Checks

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover calculations, dates, CSV export, and the SQL schema with RLS
in embedded PostgreSQL (PGlite, without a separate server). Browser tests cover
the main demo-mode workflows. The SQL check in `supabase/tests/access.sql`
is intended to run in the project's SQL Editor after applying the schema;
do not run it against someone else's database. All test changes are rolled back.
The local RLS test uses simplified substitutes for `auth.users` and `auth.uid()`.
Testing real sign-in, authentication, and shared access requires a Supabase project.

## Data preservation

CSV export includes **the entire expense history**, not just the selected month,
along with author names. Save exports periodically. CSV import is available in Settings.
User names are stored in localStorage and must be set again after clearing
browser data. Editing an expense preserves the name of its original author.
For compatibility, names still use the existing `vmeste.device` storage key and
the `expenses.device_name` database field. Existing expense signatures are preserved;
changing your name applies to new expenses.
Renaming a category updates its name throughout the expense history.

The free Supabase plan has limits, and projects may be paused after seven days
of low activity. Check the current terms:
https://supabase.com/pricing and
https://supabase.com/docs/guides/platform/free-project-pausing.

## Import an existing Excel expense sheet

Save a copy of your sheet as CSV UTF-8. Use one header row and one expense per row.
Required columns: `Дата` / `Date`, `Сумма` / `Amount`, and `Категория` / `Category`.
Optional column: `Автор` / `Author`. Comment columns in older files are ignored. Legacy `Устройство`
and `Device` headers are also supported. Dates can use `YYYY-MM-DD` or `DD.MM.YYYY`.
Amounts are in rubles; imported fractional values are preserved without rounding.
An omitted or empty author uses the name you entered at sign-in.

Open Settings → CSV import, choose the file, review the preview, and confirm.
The app accepts semicolon, comma, and tab delimiters, quoted multiline cells,
UTF-8, Windows-1251, and UTF-16LE files. Limit: 5 MB and 5,000 expenses per file.
Unknown categories are created automatically. Archived categories are reused.
Any invalid row blocks import until the file is corrected. A template is available
in the import dialog, and the app's own CSV exports can be imported as well.

By default, import skips existing expenses matching the date, amount, category,
and author. Identical rows are counted: two identical purchases in a file
remain two purchases, and reimporting that file skips both. You can disable
this comparison if the coinciding rows represent additional expenses.
Stable row IDs also prevent duplicate writes when retrying an interrupted import
with the same selected file. Selecting the file again creates a new attempt.
Expense insertion is one database request; category creation happens beforehand,
so new categories may remain if expense insertion fails.

## Local review workflow

Keep changes local for review at http://localhost:5173. Push to `main` only when
publication is requested: the GitHub workflow deploys automatically on every push.

## Install on a phone

The production build includes a web app manifest, 192px and 512px PNG icons,
an Android maskable icon, and a service worker. Installation opens `potracheno`
in standalone mode without the browser's address bar. The app scope and launch
URL stay under `/potracheno/` on GitHub Pages.

After publishing, open https://const-int.github.io/potracheno/ in Chrome on Android
and use the browser's Install app action (or Add to Home screen → Install).
Choose installation rather than creating a shortcut. If you previously created
a browser shortcut, remove it and install the app again.

The service worker caches the interface assets only. Supabase responses are not
cached; saving and loading shared expenses still require an internet connection.
New versions do not forcibly reload an open expense form. When an update is ready,
Settings offers an Update app button. Updates are also checked when returning
to the app. Local development does not register a service worker, keeping local
UI changes immediately visible.

To check the production manifest, icon dimensions, Chrome installability, scoped
service worker, and offline shell loading locally:

```bash
npm run test:pwa
```

The check serves the built files at `http://127.0.0.1:4175/potracheno/` to reproduce
the repository subpath. Physical Android installation must be checked after
publishing the HTTPS site; an ordinary HTTP address on a local network does not
provide the required secure context.

Legacy database comment values are retained for compatibility but are not shown,
edited, exported, or used for duplicate matching. New imports save an empty comment.
