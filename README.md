# Job Radar

I built this because job hunting across borders is genuinely miserable, and most of the tools that promise to fix it either want a subscription, want your email address, or quietly upload your CV to somebody's server so they can sell you a "premium match score" afterwards.

This does none of that. Drop your CV in, and it reads it **in your own browser** and ranks real openings against it. No account. No payment. No upload. If you close the tab, your CV is gone.

If you're looking for work, I'd genuinely suggest giving it a go.

---

## What it actually does

**Reads your CV where you are.** PDF, DOCX or plain text. The parsing runs as JavaScript on the page you already have open. There is no backend in this project — nowhere for the file to go, even if I wanted it to.

**Ranks jobs by whether they fit you.** Not just keyword overlap. It weighs the skills you have against what each role asks for, how closely your past job titles match, and how recently the role appeared. Rare skills count for more than common ones, because everybody lists JavaScript.

**Respects what level you're actually at.** This is the part most job boards get wrong. If you're two years in, being shown Staff Engineer roles isn't ambitious, it's a waste of your evening. Roles one step above yours still show up, because those are worth a try. Roles far above get pushed down.

**Tells you when a job is really still open.** Listings pulled straight from a company's own careers page get checked every day. If a role comes off their site, it's gone from here too. That's a signal a scraped aggregator can't give you, and it's why you'll see "still listed today" on a job that was first posted months ago.

**Filters by country, on a globe.** Spin it, tap a marker, and you're filtered to that country. Remote-anywhere roles are their own category rather than being lumped in with a random office.

**Flags sponsorship honestly.** If a posting says it offers visa sponsorship or relocation support, it's badged. If a posting says it can't sponsor, that badge is suppressed. If it says nothing, nothing is claimed. I'd rather under-promise here than send you after a job you can't legally take.

**Saves and learns.** Bookmark what looks worth an application. Heart the ones you want more of. After a handful of hearts, ranking starts leaning your way — deliberately not before then, because three clicks isn't a preference, it's noise.

**Checks your CV reads cleanly.** More on that below.

---

## How to use it

1. **Drop your CV on the homepage.** It's read on the spot. You'll see the skills it picked up so you can sanity-check what it understood.
2. **Look at today's picks.** A fresh handful each day, drawn from your strongest matches.
3. **Go to Browse to dig in.** Filter by country, how recently the role was confirmed live, work mode, level, and sponsorship.
4. **Save and heart as you go.** Both live in your browser.
5. **Run the CV check.** Takes a second and occasionally catches something embarrassing.

On iPhone, open it in Safari, tap Share, then **Add to Home Screen**. It then opens like an app and works offline.

---

## About the CV check

I want to be straight about this, because the industry around it is full of nonsense.

You'll see tools claiming applicant tracking systems auto-reject you if your "keyword match" falls under some percentage. That is mostly not how the mainstream systems work. They're databases with a search box on top, and a human runs the search. The number those tools sell you is largely invented to sell you the fix.

So this checks the thing that genuinely costs you: **whether software can read your file at all**. Is the text extractable, or is it a scan? Are your email and phone in the body rather than stranded in a header some parsers skip? Are your section headings the plain words a parser looks for? Do your dates parse?

Only those things move the score. Everything else — length, bullet style, whether you've quantified your achievements, a two-column layout — is shown as a suggestion and cannot lower your score. Two columns in particular is fine in most modern systems, and a checker that panics about it is wasting your time.

It's deliberately not harsh. A CV a parser can read is not a disaster, and a score in the teens would tell you nothing useful.

---

## Where the jobs come from

Two kinds of source, and the difference matters:

**Company career pages.** Read directly from the hiring systems companies run their own careers pages on. This is the good stuff: no aggregator lag, no reposting, and the apply link is the real one. It's also how the "still listed" check works.

**Public job feeds.** Open job boards that publish a free, public feed. Wider reach, but no way to confirm a role is still open, so these are aged out after 45 days.

Everything is deduplicated across sources — the same role advertised in six places is one entry, not six. Listings without a working apply link, or too thin to judge, are dropped.

**What this is not:** it is not every job in the world. Free, openly published job data skews heavily toward technology and toward remote work. I'd rather show you a few thousand listings that are real than a hundred thousand that are mostly ghosts. If a role isn't here, it doesn't mean it doesn't exist.

---

## Privacy

- Your CV is read in your browser and never transmitted. There is no server to transmit it to.
- Saves, likes and preferences live in your browser's local storage. Clearing site data clears them.
- No accounts, no analytics, no tracking, no cookies, no adverts.
- Because there's no account, your saved jobs don't follow you to another device.

---

## Running it yourself

```bash
npm install
npm run geo        # build globe and country data (only needed once)
npm run collect    # fetch jobs into public/data/jobs.json
npm run dev        # http://localhost:5210/job-radar/
```

The path prefix is there in development too, deliberately — a base that differs between local and production hides subpath bugs until the moment you deploy.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run collect` | Fetch from every source. Takes a few minutes; requests are spaced out on purpose. |
| `npm run reprocess` | Re-run the filtering and scoring over the **last** fetch, with no network calls at all. Use this while tuning. |
| `npm run probe` | One page per source and a full board check, without writing the index. Reports every company board that no longer answers. |
| `npm run build` | Typecheck then build. |

To widen or narrow what gets collected, edit `pipeline/roles.mjs` — each role group has an `on` flag, and automation, AI and data groups are already written and switched off. To add companies to poll directly, add them to `pipeline/companies.mjs` and run `npm run probe` to check the board answers before relying on it.

The published site rebuilds itself daily through a scheduled workflow that collects fresh listings and deploys them. The job data is never committed, so the repository doesn't grow over time.

---

## Honest limitations

- Coverage is strongest for technology roles and remote work, because that's what's freely published.
- Company career pages don't always expose a first-published date, so "posted" is sometimes the last-updated date instead.
- Location parsing is good, not perfect. An unusual location string may land a job in the wrong country or in none.
- Roles that sit open on a careers page for a year are real, but usually not urgent. They're kept and ranked lower rather than hidden.
- The skill vocabulary is hand-curated, so a very niche technology may not be recognised yet.

## Licence

MIT. Fork it, change the role filters, point it at your own industry.
