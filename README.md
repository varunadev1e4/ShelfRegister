# Shelf Register

A home library catalog for books and games.

- **Owner app** at `/admin`: sign in, add and edit items, lend with due dates and WhatsApp reminders, friends list, borrow-request inbox, reading list and yearly goal, series, quotes, year in review, printable QR shelf labels, trash with undo, backup and restore.
- **Friends page** at `/`: read-only. Friends can search (even Telugu titles typed in English letters), filter, sort, page through a big collection, see covers and your Picks, use the game-night picker and send you a borrow request. They cannot change anything.
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
    js/admin.js  js/safety.js  js/lending.js  js/requests.js  js/labels.js  js/qrcode.js
    js/reading-core.js  js/reading-view.js  js/extras.js  js/review.js  js/boot.js   the owner app
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

### Finding things: Telugu in English letters, covers, picks, shelf QR codes (friends page)

- **Search Telugu titles without a Telugu keyboard.** A friend can type `veyi padagalu` and find వేయి పడగలు. When you add or import a Telugu book, an English spelling is filled in for you, and you can correct it in the form. Search ignores doubled letters and small spelling differences (`veeyi`, `vēyi`), and still works if they type Telugu. For books you added earlier, use **Data > Quick fixes > Add English spellings**.
- **Covers.** Covers come from Open Library using the book's ISBN, and are filled in when you save a book with an ISBN. For books you added earlier, use **Data > Quick fixes > Add cover links**. A book with no cover there shows none. You can also paste your own image link in the book form.
- **Picks.** Tick "Recommend this on the friends page" on any book or game and write a line on why. A **Picks** tab then appears for friends. Nothing else about your reading is shared.
- **Shelf QR codes.** Open `/?shelf=B4` and the friends page shows only shelf B4. The Labels tab prints these as QR stickers.

### Borrow requests

Friends tap **Request** on a card, enter a name and a WhatsApp number or email, and it lands in your **Requests** tab (with a number on the tab and a banner). From there you can reply on WhatsApp or email, tap **Lend to** to open the lend form with their name filled in, mark it handled, or decline.

Because anyone with the link can send a request, the database defends itself:
- A request must be for an item that exists and is not hidden or deleted. The title is taken from your catalog, so it cannot be faked.
- At most 30 requests an hour overall, 5 a day per contact, and the same person cannot ask for the same item twice in a day.
- Names, contacts and messages have length limits. Friends can only add a request; they cannot read, change or delete any.
- The form has a hidden trap field that bots fill in, and a short delay between sends.

This is protection against casual abuse, not a CAPTCHA. If you want requests to go through WhatsApp only, set `REQUEST_MODE: "whatsapp"` in `config.js` (or `"both"`).

### Lending, friends and reminders

- Lending asks for a **due date** (14 days by default; change `LOAN_DAYS` in `config.js`). The Lent out tab shows what is overdue and has **Remind**, which opens WhatsApp with a message already written, plus **+7 days** and **Returned**.
- The **Friends** tab keeps each friend's phone number, what they have now, and their full borrowing history. Anyone you lend to is added automatically. Add a phone number (10 digits, or with country code) so Remind opens their chat directly.
- If a friend's phone is missing, Remind opens WhatsApp's share screen so you can pick them yourself.

### Printing labels (Labels tab)

- **Shelf labels:** one per shelf code, with a QR code and the code in large type. Stick one on each shelf. Scanning opens the friends page showing only that shelf.
- **Book and game labels:** a QR code with the title, author and call number. Scanning opens that one item on the friends page. A hidden item shows nothing to friends.
- **All at once:** in the Labels tab choose **Everything** and press **Print** once. You get every shelf label, then every book and game label, on separate pages. Choose "Books and games" under Items to include both.
- **One by one:** press the **QR** button on any book or game in the catalog to see its label and print just that one. For one shelf, type its code in "Only shelves starting with".
- **Spine labels:** the call number (for example EN / FIC / ORW) on separate lines, with the shelf code underneath.
- Filter by shelf prefix (for example `A` for every shelf starting with A) to print one bookcase at a time, choose labels per row, then **Print**. Only the labels are printed. Cut along the dashed lines, or print on a sticker sheet.
- If you use a custom domain, set `PUBLIC_URL` in `config.js` so the QR codes use it.

### More for reading

- **Notes and quotes:** the **Notes** button on any book keeps private notes and favourite quotes with page numbers. The Reading tab shows a random quote to revisit.
- **Series:** fill in Series and Number in series in a book. The **Series** tab groups them, shows progress, flags **missing volumes** (you own #1, #2 and #4, so #3 is flagged), and offers the next book to read.
- **What should I read next?** On the Reading tab, pick from your reading list, any unread book, or the next book in a series you started. Narrow by language or length, then tap Pick for me.
- **Year in review:** the **Year in review** button on the Reading tab gives a summary of any year: books and pages, goal result, longest and shortest book, fastest read, highest rated, most-read author, busiest month, longest streak and more.

### Safety: duplicates, trash and backups

- **Duplicates:** adding a book shows a warning if the same ISBN, or the same title and author, is already in your catalog, with the shelf where it is. You can still choose Add anyway. Importing a CSV shows duplicates before anything is added, and lets you skip them.
- **Trash:** deleting moves an item to the trash, with an **Undo** button right away. Items stay in **Data > Trash** for 30 days, then are removed.
- **Backup reminder:** a banner appears if you have never downloaded a backup, or the last one is over 30 days old.
- **Full backup and restore:** **Data > Download full backup** saves items, loans, friends, goals and the reading diary in one file. **Restore from a full backup** adds or overwrites those records and never deletes what you have now. A CSV of items is also available.

### Adding your 2,000+ items

1. Scan barcodes with a free app such as Libib or Goodreads and export a CSV. Or type titles into a spreadsheet and save it as CSV.
2. In `/admin`, open the **Data** tab and choose the file. Columns understood: `title, author, language, category, shelf, isbn, notes`. Add a `kind` column with the word `game` for games.
3. Import each file once. Importing it twice adds every row twice.
4. Set shelf codes as you shelve (A1, A2, B4 ...) by editing items.

### What friends can and cannot see

They see: title, author, language, category, shelf code, game details, and whether an item is on the shelf or lent out.
They never see: your notes, ISBNs, reading status or ratings, or who borrowed what. Tick **Hide this item from the friends page** on any item to remove it from their view entirely.

Anyone who has the friends link can open it. If you want it private, share the link only in your friends' group chat.

## Upgrading an existing install

1. In Supabase open **SQL Editor**, paste the new `supabase/schema.sql` and run it. It is safe to run again: it only adds columns and tables and refreshes the friends view and request rules. Your items are not touched. Do this **before** uploading the new files, or saving a book will fail until the new columns exist.
2. Replace the `public` folder in your project with the new one, but keep **your own** `config.js`. Copy these new lines into it if they are missing: `REQUEST_MODE`, `LOAN_DAYS`, `DEFAULT_COUNTRY_CODE` and (optional) `PUBLIC_URL`.
3. Push to GitHub. Vercel redeploys by itself. Hard-refresh the pages once (or reopen the phone shortcut) so the new scripts load.
4. In the owner app, open **Data > Quick fixes** and use the two buttons: add English spellings for Telugu books, and add cover links for books with an ISBN.
5. Download a full backup from **Data**.

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
| A banner says "Update the database" | Run the newest `supabase/schema.sql` in the Supabase SQL Editor, then reload. |
| Friends see "Could not send the request" | Run the newest `schema.sql` (it creates the request table and rules). The message under the form says if a limit was hit. |
| Covers do not show | The book needs an ISBN, and Open Library must have a cover for it. Many Telugu books will not have one. |
| Printed QR opens the wrong site | Set `PUBLIC_URL` in `config.js` to your real address and reprint. |
| Supabase warns about a "security definer view" | That is intended. The `public_items` view is how friends get a safe, read-only list. |
