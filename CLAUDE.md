@AGENTS.md

# DIBS — Government Bidding System

## Deployment
- **GitHub:** ShmuelSokol/bids (master branch)
- **Railway:** auto-deploys from GitHub pushes — do NOT use `railway up`
- **Supabase:** project `jzgvdfzboknpcrhymjob` (dibs-gov)
- **Live URL:** https://dibs-gov-production.up.railway.app

## Spelling
- Correct: **Lam Links** (two words, no B). Never "Lamb Links".

## npm
- Always run npm/node/npx from `C:\tmp\dibs-init\dibs`, never from UNC network paths.

## D365 / AX
- Government customer account: **DD219** — filter all sales/invoice queries to this account.
- OData base: `https://szy-prod.operations.dynamics.com/data/`
- Auth: OAuth2 client credentials (env vars AX_TENANT_ID, AX_CLIENT_ID, AX_CLIENT_SECRET)

## Key env vars (in .env, NOT committed)
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- MASTERDB_API_KEY, MASTERDB_URL
- AX_TENANT_ID, AX_CLIENT_ID, AX_CLIENT_SECRET, AX_D365_URL
- DIBBS_USERNAME, DIBBS_PASSWORD
- GITHUB_TOKEN (for bug reporter)
