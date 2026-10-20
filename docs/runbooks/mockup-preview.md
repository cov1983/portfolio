# Runbook — the mockup preview project (`mockups/project-discovery/`)

A second Vercel project serves `mockups/project-discovery/` read-only at an unlisted
`*.vercel.app` URL (unlisted: linked from nowhere; the host is public to anyone who reads this
repository), so a test client can try the project-discovery mockup (the zip on #59) before
increment 2 builds the real `/start` on thomascova.dev. It is not thomascova.dev: a separate
project, a separate origin, no domain, no Deployment Checks. Nothing in it is product code
(`mockups/README.md`). Creating, changing and deleting the project are dashboard steps the Owner
does; an agent never does them (the setup wizard does not know this project either).

## Settings

| where | value | why |
|---|---|---|
| Vercel project | `tc-discovery-9k2v`, linked to `cov1983/portfolio` | one repository, two projects |
| Settings → General → Root Directory | `mockups/project-discovery` | Vercel sees only this folder; `vercel.json` is read from here, not from the repository root |
| Settings → Build and Deployment → Framework Preset | Other | a static folder, no framework |
| Install Command, Build Command, Output Directory | empty, empty, `.` | no install, no build; the folder is the site |
| Settings → Git → Ignored Build Step | the default (Automatic) | the step is the file's `ignoreCommand` (below), not a dashboard field |
| Settings → Git → Comments | off | no Vercel comments on the portfolio's pull requests from this project |
| Settings → Deployment Protection | the default | nothing changed from what Vercel sets for a new project |

`mockups/project-discovery/vercel.json` repeats the four build settings (`framework: null`, empty
`installCommand` and `buildCommand`, `outputDirectory: "."`), carries the Ignored Build Step as
`ignoreCommand: "git diff --quiet HEAD^ HEAD -- ."` (it runs in the Root Directory and compares
the last commit of a push: only a push whose last commit touches the folder deploys; redeploy from
the dashboard otherwise) and the response headers. It exists because the project's first two
deploys failed: when the Root Directory has no `vercel.json` of its own, Vercel applies the
repository root's (pnpm install, `node build/build.ts`, `dist`), which has nothing to build there
(#70).

The headers, one rule on `/(.*)`: `X-Robots-Tag: noindex` (the page also carries the robots meta
tag), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a Content Security
Policy of `default-src 'none'` that allows only the mockup's inline CSS and JS
(`style-src 'unsafe-inline'; script-src 'unsafe-inline'`) with `base-uri`, `form-action` and
`frame-ancestors` at `'none'`. The list is the ticket's (#70); ADR 0012's `Permissions-Policy` and
`Cross-Origin-Opener-Policy` belong to thomascova.dev's `vercel.json`. The mockup loads nothing
else: no image, font, stylesheet or request to any origin; its one form never submits; the brief
download is a `blob:` URL with the `download` attribute, which no CSP fetch directive governs.

## After a deploy

1. The deployment's Build log shows no install and no build step.
2. On the production URL (a preview may sit behind Deployment Protection):
   `curl -sI https://<production-url>/ | grep -i -e x-robots-tag -e x-content-type-options -e referrer-policy -e content-security-policy`
   prints the four headers.
3. In a browser: the page renders, the questionnaire moves through its sections, "download brief"
   saves `project-discovery-brief.txt`, and the DevTools console shows no CSP report. A blocked
   `/favicon.ico` line is expected and harmless: the page declares no icon, the browser asks for
   one on its own, and `default-src 'none'` denies it.

A failure in step 1 means the Root Directory lost its `vercel.json` (or the setting itself);
in step 2, the headers rule; in step 3, a change to the mockup that needs something the CSP
denies: widen the policy in `mockups/project-discovery/vercel.json`, in a PR, never in the dashboard.

## How to delete it

1. Vercel: project `tc-discovery-9k2v` → Settings → Advanced → Delete Project. Leave the GitHub
   App installation alone: the main project uses it.
2. Repository, one PR: delete `mockups/`, the `mockups/` entries in `.prettierignore` and
   `eslint.config.js`, the `mockups/` bullet in `README.md`, this runbook and its pointer lines in
   `docs/runbooks/README.md` and `docs/runbooks/setup-wizard.md`.

## Related

#59 (the zip and the increment-2 candidate it belongs to), #66 and PR #69 (the folder and its
ignores), #70 (this runbook and the `vercel.json`), `docs/runbooks/setup-wizard.md` (the main
project; nothing there applies here), `vercel.json` at the repository root (the main project's
configuration, which this project must not inherit).
