# Card Image Ingestion

Card art lives in `public/images/cards` and predefined cards reference it from `prisma/seed.ts` with paths like `/images/cards/american-express-gold-card.png`.

## Add Or Refresh An Image

Use the downloader script with a card name that matches the seed data:

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

# Validate every image and refresh the manifest/report
node scripts/download-card-image.js --validate all --write-manifest

# Validate one file
node scripts/download-card-image.js --validate american-express-gold-card.png

# List Google image candidates without downloading
node scripts/download-card-image.js --name "Citi Strata Elite" --source google --list

# Use a manually verified URL
node scripts/download-card-image.js --name "Citi Strata Elite" --url "https://example.com/card.png" --force
```

Prefer issuer-hosted or known product-card-art sources. Avoid screenshots, comparison graphics, review thumbnails, cropped wallet photos, and multi-card images.
