# Environment variables

`.env.example` is a keys-only template. This file documents what each key is for
and how to generate the ones that need random values.

## Generate the secrets

```bash
# SECRET_KEY - signs login tokens
python -c "import secrets; print(secrets.token_urlsafe(48))"

# INTEGRATION_ENCRYPTION_KEY - encrypts third-party credentials at rest
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Keep `SECRET_KEY` identical across deploys. Changing it signs every user out.
Rotating `INTEGRATION_ENCRYPTION_KEY` makes existing stored integration
credentials undecryptable — they surface as `status: "error"` rather than failing
silently.

## Required in production

The app **refuses to boot** on a deployed service when either of these is wrong,
so a misconfiguration shows up in the deploy log immediately instead of surfacing
later as a broken feature:

| Condition | Effect |
|---|---|
| `SECRET_KEY` unset or a known default | refuse to start — tokens would be forgeable |
| `DATABASE_URL` points at sqlite | refuse to start — the file is wiped on every deploy |

`RENDER` and `RAILWAY_ENVIRONMENT` are set by the platform, as is `ENVIRONMENT`
if you set it. `DEPLOY_ENV` detection uses any of the three; you normally don't
need to set `ENVIRONMENT` yourself.

### Escape hatch

`ALLOW_EPHEMERAL_SECRET_KEY=true` boots with a random per-process signing key.
Tokens are not forgeable, but **every restart signs all users out**. Acceptable as
a stopgap, not as a destination — set a real `SECRET_KEY` and remove it.

## Database

`DATABASE_URL`. The driver is normalised to `psycopg2` in `database.py`, so all
of these work:

```
postgres://USER:PASS@HOST:5432/DBNAME            legacy prefix
postgresql://USER:PASS@HOST:5432/DBNAME          driver inferred (version dependent)
postgresql+psycopg://USER:PASS@HOST:5432/DBNAME   psycopg v3, rewritten
postgresql+psycopg2://USER:PASS@HOST:5432/DBNAME  explicit, preferred
```

Prefer the explicit form so the intent is visible in a hosting dashboard. This
matters: SQLAlchemy 2.1 changed the default driver for a *bare* `postgresql://`
URL to psycopg v3, and only psycopg2 is installed.

For local dev, `sqlite:///./workflow.db`.

## CORS

`ALLOWED_ORIGINS` — comma-separated browser origins allowed to call this API.
Defaults cover localhost plus this project's known Netlify/Render/Railway hosts.

`CORS_ALLOW_PLATFORM_WILDCARDS` — previously the CORS regex accepted **any**
`*.netlify.app` or `*.onrender.com` origin, which with `allow_credentials=True`
let other people's apps on those platforms send credentialed requests here. That
wildcard is now opt-in. Leave it off unless you understand the risk.

## Third-party integrations

`INTEGRATION_ENCRYPTION_KEY` — required to store provider credentials. Without it
the integrations page still loads, but connecting a provider returns 503.

`INTEGRATION_ALLOWED_HOSTS` — optional comma-separated hostname allowlist that
bypasses the SSRF guard, for providers whose addresses legitimately fall in a
blocked range.

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — optional
file uploads. Without them, `/api/upload` base64-inlines attachments into the
task row, which is fine for development but not for production.

## Billing (Paddle)

`PADDLE_API_KEY` — server-side API key. **Never exposed to the browser**; the
browser only ever receives a short-lived client token.

`PADDLE_WEBHOOK_SECRET` — the "Secret key" from the Paddle notification
destination. Used to HMAC-verify every inbound webhook.

`PADDLE_ENV` — `sandbox` (default) or `production`.

`PADDLE_PRICE_ID` — the price checkout transactions are created against.

Without the API key and price, the billing page still loads but "Upgrade plan"
returns 503 and the subscription tier can never change.

## Email

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `BREVO_API_KEY`
— used for board/team invite emails. Falls back to the Brevo HTTP API when a
Brevo key is present, otherwise raw SMTP.

## Frontend

`VITE_API_URL` — base URL of the backend API.

Vite **inlines this at build time**, not at runtime. Set it in the Netlify UI
(Site settings → Environment) and rebuild. If unset, `api.js` falls back to a
hardcoded host, which is why the app logs a console warning when it's missing.
