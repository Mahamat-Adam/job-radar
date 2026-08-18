/**
 * Company career boards to poll directly.
 *
 * Chosen for three reasons: they hire the kinds of roles this index is for,
 * they hire remotely or across borders, and a good share of them are known to
 * sponsor work visas in their home markets.
 *
 * Board tokens change when a company migrates hiring systems, so this list is
 * validated by running `npm run collect -- --probe`, which reports every board
 * that no longer answers. Dead entries are pruned rather than left to waste a
 * request every day.
 */

export const BOARDS = [
  /* ------------------------------------------------------- United States -- */
  { name: 'Stripe', ats: 'greenhouse', token: 'stripe' },
  { name: 'Figma', ats: 'greenhouse', token: 'figma' },
  { name: 'Databricks', ats: 'greenhouse', token: 'databricks' },
  { name: 'Coinbase', ats: 'greenhouse', token: 'coinbase' },
  { name: 'Cloudflare', ats: 'greenhouse', token: 'cloudflare' },
  { name: 'Discord', ats: 'greenhouse', token: 'discord' },
  { name: 'Dropbox', ats: 'greenhouse', token: 'dropbox' },
  { name: 'Reddit', ats: 'greenhouse', token: 'reddit' },
  { name: 'Twilio', ats: 'greenhouse', token: 'twilio' },
  { name: 'Asana', ats: 'greenhouse', token: 'asana' },
  { name: 'Brex', ats: 'greenhouse', token: 'brex' },
  { name: 'MongoDB', ats: 'greenhouse', token: 'mongodb' },
  { name: 'Elastic', ats: 'greenhouse', token: 'elastic' },
  { name: 'Datadog', ats: 'greenhouse', token: 'datadog' },
  { name: 'GitLab', ats: 'greenhouse', token: 'gitlab' },
  { name: 'Pinterest', ats: 'greenhouse', token: 'pinterest' },
  { name: 'Instacart', ats: 'greenhouse', token: 'instacart' },
  { name: 'Flexport', ats: 'greenhouse', token: 'flexport' },
  { name: 'Robinhood', ats: 'greenhouse', token: 'robinhood' },
  { name: 'Affirm', ats: 'greenhouse', token: 'affirm' },
  { name: 'Samsara', ats: 'greenhouse', token: 'samsara' },
  { name: 'HubSpot', ats: 'greenhouse', token: 'hubspot' },
  { name: 'Grafana Labs', ats: 'greenhouse', token: 'grafanalabs' },
  { name: 'Airtable', ats: 'greenhouse', token: 'airtable' },
  { name: 'Webflow', ats: 'greenhouse', token: 'webflow' },
  { name: 'Amplitude', ats: 'greenhouse', token: 'amplitude' },
  { name: 'Okta', ats: 'greenhouse', token: 'okta' },
  { name: 'Fastly', ats: 'greenhouse', token: 'fastly' },
  { name: 'Duolingo', ats: 'greenhouse', token: 'duolingo' },
  { name: 'Udemy', ats: 'greenhouse', token: 'udemy' },
  { name: 'Coursera', ats: 'greenhouse', token: 'coursera' },
  { name: 'Squarespace', ats: 'greenhouse', token: 'squarespace' },

  /* -------------------------------------------------------------- Europe -- */
  { name: 'Adyen', ats: 'greenhouse', token: 'adyen' },
  { name: 'Wise', ats: 'greenhouse', token: 'wise' },
  { name: 'Monzo', ats: 'greenhouse', token: 'monzo' },
  { name: 'N26', ats: 'greenhouse', token: 'n26' },
  { name: 'SumUp', ats: 'greenhouse', token: 'sumup' },
  { name: 'Contentful', ats: 'greenhouse', token: 'contentful' },
  { name: 'GetYourGuide', ats: 'greenhouse', token: 'getyourguide' },
  { name: 'Intercom', ats: 'greenhouse', token: 'intercom' },
  { name: 'Trustpilot', ats: 'greenhouse', token: 'trustpilot' },
  { name: 'Doctolib', ats: 'greenhouse', token: 'doctolib' },

  /* ----------------------------------------------- remote-first employers -- */
  { name: 'Canonical', ats: 'greenhouse', token: 'canonical' },
  { name: 'Palantir', ats: 'lever', token: 'palantir' },
  { name: 'Veeva', ats: 'lever', token: 'veeva' },
  { name: 'Mistral AI', ats: 'lever', token: 'mistral' },

  { name: 'OpenAI', ats: 'ashby', token: 'openai' },
  { name: 'Ramp', ats: 'ashby', token: 'ramp' },
  { name: 'Vercel', ats: 'ashby', token: 'vercel' },
  { name: 'Linear', ats: 'ashby', token: 'linear' },
  { name: 'PostHog', ats: 'ashby', token: 'posthog' },
  { name: 'Replit', ats: 'ashby', token: 'replit' },
  { name: 'Clerk', ats: 'ashby', token: 'clerk' },
  { name: 'Deel', ats: 'ashby', token: 'deel' },
  { name: 'Modal', ats: 'ashby', token: 'modal' },
  { name: 'Baseten', ats: 'ashby', token: 'baseten' },
]
