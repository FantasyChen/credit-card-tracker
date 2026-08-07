# Card Image Ingestion

Card art lives in `public/images/cards`. The DB-free Catalog in
`src/lib/static-catalog.ts` references paths such as
`/images/cards/american-express-gold-card.png`; `prisma/seed.ts` consumes that
same source for compatible setup.

Image downloads and manifest writes are network and filesystem operations. Use
them only for an approved Catalog/image update, and record the source in
[`docs/card-image-sources.md`](card-image-sources.md). Validation of existing
files is the safe, no-network check.

## Add Or Refresh An Image

Use the downloader script with a card name that matches the Catalog definition:

```bash
node scripts/download-card-image.js --name "American Express Gold Card" --source auto --dry-run
node scripts/download-card-image.js --name "American Express Gold Card" --source auto --force
```

The script now:

- normalizes filenames deterministically from the card name
- refuses to overwrite existing files unless `--force` is passed
- validates file signatures, dimensions, size, and obvious HTML error pages
- reports duplicate image content by SHA-256 hash
- updates `public/images/cards/manifest.json` with source URL, dimensions, size, and hash

## Useful Modes

```bash
# Validate every existing card image without network access
node scripts/download-card-image.js --validate all

# Validate every image and refresh the manifest/report (writes manifest.json)
node scripts/download-card-image.js --validate all --write-manifest

# Validate one file
node scripts/download-card-image.js --validate american-express-gold-card.png

# List Google image candidates without downloading (network access)
node scripts/download-card-image.js --name "Citi Strata Elite" --source google --list

# Use a manually verified URL
node scripts/download-card-image.js --name "Citi Strata Elite" --url "https://example.com/card.png" --force
```

Prefer issuer-hosted or known product-card-art sources. Avoid screenshots, comparison graphics, review thumbnails, cropped wallet photos, and multi-card images.
