# Open Maak online using Render

The repository includes a Docker build and a Render Blueprint. One service serves both React and Flask over HTTPS. Commits to its linked GitHub branch trigger new deployments.

## Create the service

1. Sign into https://dashboard.render.com/ with your own account.
2. Choose **New → Blueprint** and connect GitHub. Grant Render access to `zaynab06/Maak_HealthHackathon`.
3. Select that repository and its `main` branch. Render reads the root `render.yaml`.
4. Review the service: `maak-demo`, Docker runtime, **Free** plan. Confirm the plan before creating it; no paid disk is requested by this configuration.
5. Deploy the Blueprint. The first build installs dependencies and compiles React; allow several minutes.
6. When the service is Live, open the HTTPS URL Render provides. Choose a demo role and click Sign in.

If Blueprint deployment is unavailable on your account, choose **New → Web Service**, select the same repository, use the **Docker** runtime and Free plan, and add these environment variables:

- `MAAK_SECRET_KEY`: use Render's generated secret value; do not put it in GitHub or chat.
- `MAAK_COOKIE_SECURE`: `1`.

Set the health check path to `/api/health` and enable automatic deployment from `main`.

## What to expect

- The free service may sleep when idle; the first visit can be slow.
- SQLite is on the service's temporary filesystem. Requests and newly registered accounts can disappear on restart or deployment. Demo accounts and the initial example are recreated automatically.
- This is a public synthetic-data demo with shared demo accounts. Only use invented details.
- For persistent demo data, a later configuration can use a paid persistent disk after you choose and authorize a plan. PostgreSQL requires code changes; changing the database URL alone is not sufficient.

## Verify and update

Open `/api/health` on the service URL; it should return a successful JSON response. Then sign in as Resident, submit a synthetic request, and verify that the coordinator can see it.

Send the public URL back in the chat so it can be checked. Subsequent source changes pushed to GitHub will trigger deployment when automatic deployment is enabled. GitHub stores the source; Render runs the website.
