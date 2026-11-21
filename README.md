# Free QR Code Generator

A free web app where anyone can paste a link or type text and instantly download a QR code as a PNG. No sign-up, no tracking, and nothing you type is stored.

## Features

- Instant QR code preview as you type
- Download as PNG in 512, 1024 or 2048 px
- Six color presets plus custom colors, with contrast warnings
- Works with links, plain text, emoji and non-English text
- Offers to add https:// to bare website addresses
- Blocks unsafe link types (javascript:, data:, file:)
- Works on phones, with a save window for in-app browsers that block downloads

## Files

| File | What it does |
|---|---|
| index.html | The whole app (HTML, CSS and JavaScript in one file) |
| _headers | Security settings for Cloudflare Pages and Netlify |
| vercel.json | The same security settings for Vercel |
| .gitignore | Keeps system files and secrets out of the repo |

There is no build step. The hosts serve the files as they are.

## Deploy to Cloudflare Pages (main host)

1. Log in at dash.cloudflare.com and open Workers & Pages.
2. Click Create, choose the Pages tab, then Connect to Git.
3. Pick the web-qr-code-generator repository.
4. Framework preset: None. Build command: leave empty. Build output directory: leave empty.
5. Click Save and Deploy.

## Deploy to Vercel

1. Log in at vercel.com and click Add New, then Project.
2. Import web-qr-code-generator.
3. Framework Preset: Other. Leave the build settings empty.
4. Click Deploy.

## Backup host: Netlify

1. In Netlify, click Add new site, then Import an existing project, and pick this repo.
2. Leave the build command and publish directory empty.
3. Click Deploy.

## Updating the app

Edit index.html on GitHub (pencil icon) or upload a new version, then click Commit changes. Every connected host redeploys automatically within a minute or two.

## Privacy

The app runs entirely in the browser. Text you type is never sent anywhere or saved. Only size and color choices are remembered on your device. The QR engine (qrcode-generator 1.4.4) loads from cdnjs, with jsDelivr as a backup.

## Notes

- The security settings block third-party scripts. Before turning on any analytics, update _headers and vercel.json to allow it.
- Never put passwords, API keys or tokens in this repository. It is public.
