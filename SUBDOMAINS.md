# School Subdomains

Each school gets a branded login URL like `{school}.lionheartapp.com`.

## How it works

- **`linfield.lionheartapp.com/login`** → School-specific login page with Linfield logo, colors, and hero image
- **`lionheartapp.com/login`** or **`app.lionheartapp.com/login`** → Generic Lionheart login

## DNS Setup (Production)

Add a wildcard record so all subdomains resolve to your app:

```
*.lionheartapp.com  CNAME  your-app.vercel.app
# or
*.lionheartapp.com  A      your-server-ip
```

## Hosting

- **Vercel**: Add `*.lionheartapp.com` to your domain in Project Settings → Domains
- **Netlify**: Add `*.lionheartapp.com` as a custom domain
- **Custom server**: Ensure your reverse proxy (nginx, etc.) passes the `Host` header

## Local development

Subdomains don't work easily on localhost. Use the query param:

```
http://localhost:5173/login?subdomain=linfield
```

Chrome supports `linfield.localhost:5173` — add to `/etc/hosts` or use the query param.

## School branding

Admins set these in the Setup wizard (or Settings):

- **Logo** – Shown on login and in the app
- **Login hero image** – Large image on the left side of the login page (optional; stock campus image by default)
- **Primary/secondary colors** – Button and accent colors
