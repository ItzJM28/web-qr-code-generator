# Free QR Code Generator

A free, public web app that turns a link, text, Wi-Fi login, email, phone number or SMS into a QR code you can download as PNG or SVG. No sign-up, no backend, nothing you type leaves your device.

Live: https://qr-gf.vercel.app

## Built with

- React 19 + Vite 6
- Tailwind CSS v4
- shadcn/ui components (Radix UI) in `src/components/ui`
- `qrcode-generator` for the QR codes, encoded as UTF-8

## Run it on your computer

```bash
npm install
npm run dev      # opens a local preview
npm run build    # makes the finished site in dist/
```

## Where things live

| Path | What it is |
|---|---|
| `src/App.tsx` | The page: type tabs, form fields, preview, downloads, size and colors |
| `src/lib/qr.ts` | Builds the text inside each code (Wi-Fi, mailto, tel, SMSTO) and draws the SVG/PNG |
| `src/components/ui/` | shadcn/ui components (button, input, tabs and others) |
| `public/_headers` | Security headers for Cloudflare Pages and Netlify (copied into `dist/`) |
| `vercel.json` | Vercel build settings and security headers |
| `netlify.toml` | Netlify build settings |

## Hosting

Every host builds with `npm run build` and serves the `dist` folder.

- **Vercel** (`qr-gf`): linked to this repo. Every push to `main` goes live.
- **Cloudflare Pages**: build command `npm run build`, output folder `dist`.
- **Netlify**: reads `netlify.toml`.

## Adding more shadcn/ui components

`components.json` is set up, so `npx shadcn@latest add dialog` (or any component) drops it into `src/components/ui`.
