# Shelf Register

A home library catalog for books and games.

- **Owner app** at `/admin`: sign in, add and edit items, lend and return, reading list and yearly reading goal, import a spreadsheet, download a backup.
- **Friends page** at `/`: read-only. Friends can search, filter, sort, page through a big collection, use the game-night picker and tap "Ask on WhatsApp" to request something. They cannot change anything.
- **Data** lives in Supabase (Postgres), so your phone and laptop always show the same catalog.
- **Hosting** is Vercel, as a plain static site. No build step.

```
shelf-register-app/
  vercel.json            tells Vercel to serve the public/ folder
  supabase/schema.sql    database table, security rules, friends view
  public/
    index.html           friends page
    admin.html           owner app
    config.js            YOUR settings (edit this)
    favicon.svg, *.png   browser tab and home-screen icons
    manifest.webmanifest, admin.webmanifest   "Add to Home Screen" details
    css/style.css
    js/common.js  js/public.js          shared code and the friends page
    js/admin.js  js/reading-core.js  js/reading-view.js  js/boot.js   the owner app
```

---

## Part 1. Supabase (the database)

1. Go to https://supabase.com, sign in, and click **New project**. Pick a name, a strong database password (save it somewhere) and the region closest to you (Mumbai if offered). Wait about two minutes for it to finish.
2. In the left menu open **SQL Editor** > **New query**. Open `supabase/schema.sql` from this folder, copy everything into the editor and click **Run**. You should see "Success. No rows returned".
3. Create your owner login. Open **Authentication** > **Users** > **Add user** > **Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
4. Stop strangers from registering. Open **Authentication** > **Sign In / Providers** (called "Providers" in some versions) and turn **off** "Allow new users to sign up". Even if someone did register, the security rules would show them none of your data, but turning this off is cleaner.
5. Get your keys. Open **Project Settings** > **API** (or **API Keys**). Copy:
   - **Project URL**, like `https://abcdxyz.supabase.co`
   - **anon / public key**, a long string starting with `eyJ...` (newer projects may call it the "publishable key", and that works too)

   Do **not** use the `service_role` or secret key anywhere in this project.

## Part 2. Add your settings

Open `public/config.js` in any text editor and replace the placeholders:

```js
SUPABASE_URL: "https://abcdxyz.supabase.co",
SUPABASE_ANON_KEY: "eyJ...your anon key...",
LIBRARY_NAME: "Varun's Library",
OWNER_NAME: "Varun",
CONTACT_WHATSAPP: "919876543210",   // country code + number, digits only
CONTACT_EMAIL: "",                  // optional
```

The anon key is designed to be public. The security rules in the database are what protect your data.

## Part 3. Try it on your computer (optional)

In a terminal inside this folder:

```
npx serve public
```

Open the address it prints. Visit `/admin.html` to sign in with the owner login from step 3.

## Part 4. Put it on Vercel

**Option A: GitHub (recommended, easy to update later)**

1. Create a new **private** repository on GitHub and upload this whole folder to it (drag and drop works on the GitHub website).
2. Go to https://vercel.com, sign in with GitHub, click **Add New** > **Project**, and import that repository.
3. Leave the framework as **Other**. Do not change any build settings; `vercel.json` already points to the `public` folder. Click **Deploy**.
4. In about a minute you get an address like `https://your-project.vercel.app`.

**Option B: Vercel command line**

```
npm i -g vercel
cd shelf-register-app
vercel
vercel --prod
```

Accept the defaults when asked.

## Part 5. Use it

- **You:** open `https://your-project.vercel.app/admin`, sign in, and bookmark it. On your phone, use "Add to Home Screen" in the browser menu for an app-like icon.
- **Friends:** send them `https://your-project.vercel.app/`. They see a read-only catalog. To borrow, they tap **Ask on WhatsApp**, which opens a chat with you with the book's title already typed in.
- To use your own web address, add a domain in Vercel under **Settings** > **Domains**.

### Browsing a big collection (friends page)

- **Category chips** across the top, each with a count. Tap one to narrow to that category.
- **A–Z bar** to jump to a letter. It ignores a leading "The", "A" or "An", like a library shelf, and has one button (తె) for Telugu titles.
- **Sort** by title, author, newest added, or shelf.
- **Paging** with 25, 50 or 100 per page, plus a page picker. **List** view is compact for scanning; **Cards** view is roomier. The choice is remembered on each friend's device.
- Active filters show as chips with a × to remove them, and **Clear all** resets everything.

### Reading tracker (owner app, Reading tab)

- **Yearly goal.** Set how many books you want to read this year. Progress counts books marked finished with a finish date in that year. On 1 January there is no goal for the new year yet, so you are asked to set one, with last year's number filled in. Earlier years stay in the Year list with their results.
- **Pace.** It tells you whether you are ahead or behind, and how often you need to finish a book to catch up.
- **Reading now.** Shows a progress bar from the page count. Type your current page and tap Save page, or tap Finished to record the date and a star rating.
- **Reading list.** A queue of books you plan to read. Search to add, reorder with the arrows, and tap Start to move a book into Reading now. In the catalog, unread books have a "+ Reading list" button.
- **Stats.** Books finished, pages read, average days per book, average rating, English versus Telugu, reading streak (days in a row you logged pages or finished a book), and pages this month. A bar chart shows books finished each month against the pace your goal needs.
- Friends never see any of this.

Books that are marked read but have no finish date do not count toward any year. The Reading tab tells you how many there are; open each with Edit and add a date. When you import a CSV, a `Date Read` or `finished` column is used for this, and Goodreads' `Exclusive Shelf` (read, currently-reading, to-read) and `Number of Pages` columns are understood.

### Adding your 2,000+ items

1. Scan barcodes with a free app such as Libib or Goodreads and export a CSV. Or type titles into a spreadsheet and save it as CSV.
2. In `/admin`, open the **Data** tab and choose the file. Columns understood: `title, author, language, category, shelf, isbn, notes`. Add a `kind` column with the word `game` for games.
3. Import each file once. Importing it twice adds every row twice.
4. Set shelf codes as you shelve (A1, A2, B4 ...) by editing items.

### What friends can and cannot see

They see: title, author, language, category, shelf code, game details, and whether an item is on the shelf or lent out.
They never see: your notes, ISBNs, reading status or ratings, or who borrowed what. Tick **Hide this item from the friends page** on any item to remove it from their view entirely.

Anyone who has the friends link can open it. If you want it private, share the link only in your friends' group chat.

## Upgrading from the first version

1. In Supabase open **SQL Editor**, paste the new `supabase/schema.sql` and run it. It is safe to run again: it only adds the reading-tracker columns and tables and refreshes the friends view. Your items are not touched. Do this **before** uploading the new files, or saving a book will fail until the new columns exist.
2. Replace the `public` folder in your project with the new one, but keep **your own** `config.js` (the one with your Supabase URL and key).
3. Push to GitHub. Vercel redeploys by itself. Hard-refresh the pages once (or reopen the phone shortcut) so the new scripts load.

## Updating later

Change a file, then upload it to GitHub again. Vercel redeploys on its own. Your data stays in Supabase and is untouched.

## Backups

Use **Data** > **Download CSV** now and then. The CSV includes pages and start and finish dates. Supabase's free plan also pauses a project after about a week with no activity, so open the app at least once a week (your weekly game night does this) or restore it from the Supabase dashboard if it pauses.

## If something goes wrong

| Problem | Fix |
|---|---|
| Page says "Not connected yet" | `config.js` still has the placeholders. Edit, save, redeploy. |
| "That email and password did not match" | Recheck the user you created in Authentication > Users, and that Auto Confirm was ticked. |
| Friends page is empty | Items may all be hidden, or `schema.sql` was not run completely. Run it again; it is safe to repeat. |
| Admin loads but nothing saves | Run `schema.sql` again, and confirm you are signed in on `/admin`. |
| Supabase warns about a "security definer view" | That is intended. The `public_items` view is how friends get a safe, read-only list. |
