[README.md](https://github.com/user-attachments/files/27686796/README.md)
# LOOK Events

Offline-capable PWA for tracking event photo guest lists. Built for LOOK
photographers to capture which guests appear in each photo group during an
event and export a clean report afterward.

## Features

- Create events with a date and a guest "alpha list"
- Import the alpha list via:
  - Camera / photo OCR (Tesseract.js)
  - Excel or CSV (SheetJS)
  - Type or paste
- Photo groups with reorder, rename, and per-person walk-in flagging
- Fuzzy guest search (Levenshtein-based) when adding people to a group
- Export the full report to clipboard or `.txt`
- Installable PWA, works offline after first load

## Project layout

```
.
├── index.html          # App shell
├── manifest.json       # PWA manifest
├── icon.svg            # App icon
├── sw.js               # Service worker (cache-first shell, SWR for CDN)
├── css/
│   └── styles.css      # All styles
└── js/
    ├── app.js          # Entry point — boots, wires DOM events, registers SW
    ├── state.js        # Persistent state (localStorage)
    ├── nav.js          # Screen stack + sheet open/close
    ├── home.js         # Home screen
    ├── setup.js        # New event setup + alpha-list management + paste sheet
    ├── event.js        # Event screen, groups, people, search sheet
    ├── ocr.js          # Camera/photo OCR pipeline + image preprocessing
    ├── importers.js    # Excel / CSV / text file import
    ├── export.js       # Export screen, copy, download
    ├── names.js        # Name normalization, dedupe, search/matching
    └── utils.js        # DOM helpers, IDs, dates, toast, file readers
```

## Running locally

ES modules and service workers require a real HTTP origin (not `file://`).
Any static server will do:

```sh
# Python 3
python3 -m http.server 8000

# Node (npx)
npx http-server -p 8000
```

Then open `http://localhost:8000`.

## Deployment

Drop the contents of this folder into any static host (GitHub Pages,
Netlify, Vercel static, S3 + CloudFront). HTTPS is required for the
service worker to register.

### GitHub Pages

1. Push this folder to a repo.
2. In Settings → Pages, set source to the `main` branch, root.
3. The PWA will be available at `https://<user>.github.io/<repo>/`.

## Data

All event data lives in `localStorage` under the key `look_v3`. There is no
backend. Clearing browser data wipes events.

## Dependencies (loaded from CDN, cached offline)

- [Tesseract.js 4](https://github.com/naptha/tesseract.js) — OCR
- [SheetJS / xlsx 0.18.5](https://sheetjs.com/) — Excel/CSV parsing
