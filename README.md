# Shelf Register

A home library catalog for books and games.

- **Owner app** at `/admin`: sign in, add and edit items, lend and return, import a spreadsheet, download a backup.
- **Friends page** at `/`: read-only. Friends can search, filter, use the game-night picker and tap "Ask on WhatsApp" to request something. They cannot change anything.
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
    css/style.css
    js/common.js  js/public.js  js/admin.js
```

---

## Part 1. Supabase (the database)

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

### Adding your 2,000+ items

1. Scan barcodes with a free app such as Libib or Goodreads and export a CSV. Or type titles into a spreadsheet and save it as CSV.
2. In `/admin`, open the **Data** tab and choose the file. Columns understood: `title, author, language, category, shelf, isbn, notes`. Add a `kind` column with the word `game` for games.
3. Import each file once. Importing it twice adds every row twice.
4. Set shelf codes as you shelve (A1, A2, B4 ...) by editing items.

### What friends can and cannot see

They see: title, author, language, category, shelf code, game details, and whether an item is on the shelf or lent out.
They never see: your notes, ISBNs, reading status or ratings, or who borrowed what. Tick **Hide this item from the friends page** on any item to remove it from their view entirely.

Anyone who has the friends link can open it. If you want it private, share the link only in your friends' group chat.

## Updating later

Change a file, then upload it to GitHub again. Vercel redeploys on its own. Your data stays in Supabase and is untouched.

## Backups

Use **Data** > **Download CSV** now and then. Supabase's free plan also pauses a project after about a week with no activity, so open the app at least once a week (your weekly game night does this) or restore it from the Supabase dashboard if it pauses.

## If something goes wrong

| Problem                                        | Fix                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Page says "Not connected yet"                  | `config.js` still has the placeholders. Edit, save, redeploy.                                        |
| "That email and password did not match"        | Recheck the user you created in Authentication > Users, and that Auto Confirm was ticked.            |
| Friends page is empty                          | Items may all be hidden, or `schema.sql` was not run completely. Run it again; it is safe to repeat. |
| Admin loads but nothing saves                  | Run `schema.sql` again, and confirm you are signed in on `/admin`.                                   |
| Supabase warns about a "security definer view" | That is intended. The `public_items` view is how friends get a safe, read-only list.                 |
