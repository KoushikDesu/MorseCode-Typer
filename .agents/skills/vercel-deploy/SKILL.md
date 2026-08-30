---
name: vercel-deploy
description: Runbook and tool integration to deploy MorseCode-Typer directly to Vercel static hosting.
---

# Vercel Deployment Skill

Use this skill whenever the user asks to "host the web in vercel", "deploy to vercel", or "publish online".

## Deployment Procedure

1. **Verify Configuration**:
   Ensure `vercel.json` exists in the repository root.

2. **Deploy via Vercel CLI**:
   Execute the non-interactive Vercel production deployment command:
   ```bash
   npx --yes vercel --prod --yes
   ```

3. **Handle First-Time Authorization**:
   - If Vercel requires authentication, prompt the user or run `npx vercel login` so the user can authenticate in their browser.
   - Once authenticated, `npx vercel --prod --yes` will generate the live public production URL (e.g. `https://morse-code-typer-xxx.vercel.app`).

4. **Report Live Link**:
   Provide the live public HTTPS deployment link to the user immediately.
