# Short Form Video — POC

A GitHub Pages site for evaluating short-form video formats across multiple languages.

## Live site

Enable GitHub Pages in repo Settings → Pages → Deploy from branch `main` / `root`.

## Adding videos

1. Drop your `.mp4` files into the appropriate folder:

```
videos/
  english/
    16x9/          ← widescreen originals
    9x16-crop/     ← auto centre-cropped to portrait
    9x16-edited/   ← purpose-edited for portrait
  spanish/
    ...
```

2. Update `manifest.json` with the file paths:

```json
"english": {
  "16x9": [
    "videos/english/16x9/video1.mp4",
    "videos/english/16x9/video2.mp4"
  ],
  "9x16-crop": [ ... ],
  "9x16-edited": [ ... ]
}
```

Paths are relative to the repo root. Order in the array = playback order.

## Sample videos

`videos/samples/` contains placeholder coloured videos used while real content is pending. English currently points to these; other languages show an empty state until real files are added.

## Video formats

| Key | Description |
|-----|-------------|
| `16x9` | Original widescreen — letterboxed on portrait screens |
| `9x16-crop` | Auto centre-cropped to 9:16 — no manual editing |
| `9x16-edited` | Edited specifically for portrait/short-form viewing |
