# Running this without a development setup

Everything here can be done from github.com in a browser. You do not need the
code on your machine, you do not need Node installed, and you do not need a
terminal. Editing a file on GitHub and committing it triggers a rebuild, and
the site updates a few minutes later.

The repository: <https://github.com/Mahamat-Adam/job-radar>
The site: <https://mahamat-adam.github.io/job-radar/>

---

## How the daily refresh works

A scheduled job runs at **05:17 UTC** every day. It fetches jobs from company
career pages and public feeds, filters them, and publishes the site with the
fresh list. The job data is never stored in the repository — it is collected
and published in the same run — which is why the repo does not grow over time.

You can see every run under the **Actions** tab.

---

## The one thing that will eventually stop it

GitHub switches off scheduled jobs after **60 days with no activity in the
repository**. This project commits nothing on its daily run, by design, so if
you do not push anything for two months the schedule goes to sleep. GitHub
emails you before it does.

The site does not break when this happens. It keeps serving whatever it last
published, and the footer keeps showing you honestly how old the data is.

### To turn it back on

1. Go to <https://github.com/Mahamat-Adam/job-radar/actions>
2. In the left sidebar, click **Collect and publish**
3. A banner appears near the top saying the workflow was disabled due to
   inactivity, with an **Enable workflow** button. Click it.

That is the whole fix. It resets the 60-day clock.

### To also refresh immediately

1. Same page: <https://github.com/Mahamat-Adam/job-radar/actions>
2. Left sidebar → **Collect and publish**
3. On the right, click **Run workflow**, leave the branch as `main`, then click
   the green **Run workflow** button

Wait five to ten minutes. Most of that is the collector deliberately pausing
between requests so it never hammers anyone's servers.

### To check it worked

Open the site and look at the bottom of the homepage. It says how many
openings are in the index and when it was last refreshed. If that says
"refreshed today", you are done.

---

## Changing what gets collected

### Turn a whole category of jobs on or off

The file is `pipeline/roles.mjs`. Near the top there is a list of groups, each
with an `on:` flag:

```js
{
  id: 'automation',
  on: false,          // <- change to true to include these
  label: 'Automation, bots and scraping',
  ...
}
```

Currently on: **frontend/full-stack web**, **solutions and technical
consulting**.
Currently off: **automation**, **AI and LLM**, **data and analytics**.

To change one:

1. Open <https://github.com/Mahamat-Adam/job-radar/blob/main/pipeline/roles.mjs>
2. Click the pencil icon (top right of the file)
3. Change `on: false` to `on: true`
4. Scroll down, click **Commit changes**

That push triggers a rebuild automatically. The new categories appear after
the next run finishes.

### Add a company whose jobs you want

The file is `pipeline/companies.mjs`. Each line looks like:

```js
{ name: 'Stripe', ats: 'greenhouse', token: 'stripe' },
```

`token` is the company's name in its careers-page URL. To find it, open the
company's jobs page and look at the address:

| If the careers URL looks like | Then use |
| --- | --- |
| `job-boards.greenhouse.io/**monzo**` | `ats: 'greenhouse', token: 'monzo'` |
| `jobs.lever.co/**palantir**` | `ats: 'lever', token: 'palantir'` |
| `jobs.ashbyhq.com/**openai**` | `ats: 'ashby', token: 'openai'` |

Add your line, commit, and the next run picks it up.

**If a company's board is wrong or has moved**, the run does not fail. It logs
the company under "board(s) did not answer" and carries on. To find those:
Actions → click the latest run → click **build** → expand **Collect jobs** and
look near the end of the company list. Anything listed there can be deleted
from `pipeline/companies.mjs`, or its token corrected.

Companies move hiring systems fairly often, so expect to prune this
occasionally. 36 of the original 92 were already dead on day one.

---

## If something looks wrong

**The site shows old data.** Check Actions for a failed run. The most likely
cause is a source being temporarily down, which the run survives — it keeps
the previous listings rather than emptying the site.

**A run failed.** Open it in Actions and read the red step. The collector is
built so that one broken source is skipped rather than fatal, so a total
failure usually means something structural, not a bad job feed.

**Everything disappeared from the site.** It should not be possible; the
collector carries forward the previous index whenever a source fails. If it
happens anyway, re-run the workflow manually.

**The site will not load at all.** Check
<https://www.githubstatus.com/> before assuming it is the project.

---

## Things worth knowing

- The site is deliberately **not indexed by search engines** — there is a
  `noindex` tag and a `robots.txt` blocking crawlers. It is reachable only by
  someone who has the address.
- The repository is public because GitHub Pages requires a paid plan to host
  from a private repository. No personal data is in it. A CV is read in the
  browser and never uploaded, so there is nothing on the server to expose.
- Saved jobs and likes live in the browser's storage on whichever device you
  used. They do not sync between your phone and your laptop.
- Listings from company career pages are checked every day. If a role comes
  off the employer's site, it is removed here too. Listings from job feeds
  cannot be checked that way, so they are dropped after 45 days.

---

## If you ever want it back on your machine

```bash
git clone https://github.com/Mahamat-Adam/job-radar.git
cd job-radar
npm install
npm run collect    # fetch jobs (takes a few minutes)
npm run dev        # http://localhost:5210/job-radar/
```

Nothing is lost by not having a local copy. The repository holds everything
except the job list, which is regenerated on every run.
