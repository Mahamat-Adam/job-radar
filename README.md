# Job Radar

I built this because job hunting across borders is genuinely miserable, and most of the tools that promise to fix it either want a subscription, want your email address, or quietly upload your CV to somebody's server so they can sell you a "premium match score" afterwards.

This does none of that. Drop your CV in, and it reads it **in your own browser** and ranks real openings against it. No account. No payment. No upload. If you close the tab, your CV is gone.

If you're looking for work, I'd genuinely suggest giving it a go.

**Live: [mahamat-adam.github.io/job-radar](https://mahamat-adam.github.io/job-radar/)**

---

## What it actually does

**Reads your CV where you are.** PDF, DOCX or plain text. The parsing runs as JavaScript on the page you already have open. There is no backend in this project — nowhere for the file to go, even if I wanted it to.

**Ranks jobs by whether they fit you.** Not just keyword overlap. It weighs the skills you have against what each role asks for, how closely your past job titles match, and how recently the role appeared. Rare skills count for more than common ones, because everybody lists JavaScript — half the skill score is how much of the role you cover, half is the weight of what you actually matched, so a TypeScript and React match beats a Git and HTML one.

**Respects what level you're actually at.** This is the part most job boards get wrong. If you're a year in, being shown Staff Engineer roles isn't ambitious, it's a waste of your evening. Roles one step above yours still show up, because those are worth a try. Roles far above get pushed down, and Senior and Lead start switched off in the filter — they're two thirds of the market and the two thirds most people reading this cannot get. One tap brings them back.

Your level is read off your job titles, not off the whole document, and a degree's dates are not counted as work experience. Both of those sound obvious and both were wrong here for a while: a graduate with two internships was being read as mid-level and shown Software Engineer III roles all day.

**Keeps one employer from being the whole list.** A handful of very large boards used to be more than half of everything here — one company with ninety-four openings, another with eighty-five, while a couple of hundred smaller employers had one or two each and never surfaced. At most eight listings per employer are published now. Nobody is excluded; the big names just stop being the entire first ten pages.

**Separates "posted recently" from "still open".** Two different questions, so two different filters. *Posted within* is when the employer first published the role, which is the date on the card. *Known live within* is when the listing was last confirmed to still be on the employer's own careers page. A role first posted in May and still on their site this morning is a real opportunity, and only the second filter can tell you that.

**Tells you when a job is really still open.** Listings pulled straight from a company's own careers page get checked every day. If a role comes off their site, it's gone from here too. That's a signal a scraped aggregator can't give you, and it's why you'll see "still listed today" on a job first posted months ago.

**Filters by country, on a globe.** Spin it, tap a marker, and you're filtered to that country. A country means that country: a posting that named a whole region — "Europe", "APAC" — is not smuggled in behind it, because those country codes are an expansion this project made rather than something the employer wrote. There's a checkbox if you do want them, and roles genuinely open anywhere are their own category rather than being lumped in with a random office.

**Flags visa sponsorship, and only that.** If a posting says it offers sponsorship, it's badged. Relocation support gets its own separate badge, because an employer paying to move you across a city is not an employer sponsoring a work visa, and if you're applying from another country that difference is the entire question. If a posting says it can't sponsor, the badge is suppressed. If it says nothing, nothing is claimed. It's a keyword match on what the employer wrote — treat it as a floor, not a promise, and confirm on the listing.

**Remembers where you went.** Tapping through to an employer's listing files the job immediately and marks the card amber. Come back, and one tap confirms you applied and turns it green. Left unanswered it stays amber, which is an honest record of a listing you opened and didn't apply to — and it's how you recognise one you've already been to. This exists because coming back with a form submitted and then having to find the row again among hundreds is exactly how applications go untracked.

**Tracks the rest of it.** Every saved job moves through Saved → Applied → Interviewing → Offer or Closed, with the date you applied kept. The counts at the top of the Saved tab are buttons: tap Applied to see only those. Two weeks after applying with no reply, it says so. Three weeks into a real hunt you will not remember who you sent what to.

**Saves and learns.** Bookmark what looks worth an application. Heart the ones you want more of. After a handful of hearts, ranking starts leaning your way — deliberately not before then, because three clicks isn't a preference, it's noise.

**Moves between devices.** There's no account, so nothing syncs on its own. Download a backup file and open it on your phone to carry your pipeline across. It also means clearing your browser doesn't wipe months of tracking.

**Checks your CV reads cleanly.** More on that below.

---

## How to use it

1. **Drop your CV on the homepage.** It's read on the spot. You'll see the skills it picked up so you can sanity-check what it understood.
2. **Look at today's picks.** A fresh handful each day, drawn from your strongest matches. Tap a country on the globe and the picks follow it.
3. **Go to Browse to dig in.** Filter by posted date, by when the role was last confirmed live, by country, work mode, level and sponsorship. On a phone the filters sit behind a button so the jobs come first.
4. **Open a listing when one looks right.** It's filed automatically and flagged amber until you say whether you applied.
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

**Public job feeds.** Open job boards that publish a free, public feed. Wider reach and, as it turns out, far more employers per listing than the curated boards — most of the variety here comes from them. But there's no way to confirm a role is still open, so these are aged out after 45 days.

**Nothing older than three months appears, from either source.** A role that has sat open since spring is rarely an urgent hire, and it crowds out fresher postings. So even a listing that is still verifiably live is dropped once the original posting passes 90 days.

Everything is deduplicated across sources — the same role advertised in six places is one entry, not six. When two copies disagree about where the job is, the one that names a real place wins over the one that said "APAC", because otherwise a role in Sydney ends up advertising itself in Malaysia. Listings without a working apply link, or too thin to judge, are dropped.

**What this is not:** it is not every job in the world. Free, openly published job data skews heavily toward technology and toward remote work. I'd rather show you a few hundred listings that are real than a hundred thousand that are mostly ghosts. If a role isn't here, it doesn't mean it doesn't exist.

---

## Privacy

- Your CV is read in your browser and never transmitted. There is no server to transmit it to.
- Saves, likes, opened listings and application status live in your browser's local storage. Clearing site data clears them.
- No accounts, no analytics, no tracking, no cookies, no adverts.
- **No third-party requests at all.** The fonts are served from this site rather than from Google, so no other company sees your IP address when you open the page. The only thing the site fetches is its own job list.
- Because there's no account, your saved jobs don't follow you to another device, and nobody else visiting the site sees yours.

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

To widen or narrow what gets collected, edit `pipeline/roles.mjs` — each role group has an `on` flag. To add companies to poll directly, add them to `pipeline/companies.mjs` and run `npm run probe` to check the board answers before relying on it. Bear in mind the per-employer cap: adding one large board adds eight listings, so widening the feeds is usually the better lever.

The published site rebuilds itself daily through a scheduled workflow that collects fresh listings and deploys them. The job data is never committed, so the repository doesn't grow over time.

**[MAINTENANCE.md](MAINTENANCE.md)** covers running it entirely from github.com with no development setup — restarting the schedule if GitHub puts it to sleep, triggering a refresh by hand, changing which kinds of jobs get collected, and adding companies.

---

## Honest limitations

- Coverage is strongest for technology roles and remote work, because that's what's freely published. There is very little here for Malaysia specifically, which is a gap I know about and can't close with free data alone.
- Experience is counted in whole years, so a CV made up of placements shorter than a year reads as having no clear date range. It lands you on entry level, which is usually right, but the wording is vaguer than it should be.
- Company career pages don't always expose a first-published date, so "posted" is sometimes the last-updated date instead.
- Location parsing is good, not perfect. An unusual location string may land a job in the wrong country or in none — and a job with no resolvable country is shown with the employer's own wording rather than being quietly labelled as open worldwide.
- Roles that sit open on a careers page for a year are real, but usually not urgent. They're kept and ranked lower rather than hidden.
- The skill vocabulary is hand-curated, so a very niche technology may not be recognised yet.
- The globe is decorative as much as functional. Every country on it is also in the Browse filter, which is faster if you know what you're looking for.

## Licence

MIT. Fork it, change the role filters, point it at your own industry.
