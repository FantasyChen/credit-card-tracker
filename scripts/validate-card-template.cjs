#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const allowedFrequencies = new Set(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']);
const allowedAlignments = new Set(['CARD_ANNIVERSARY', 'CALENDAR_FIXED']);

function collectDefaultTemplates() {
  const examplesDir = path.join(root, 'card-templates', 'examples');
  if (!fs.existsSync(examplesDir)) return [];
  return fs
    .readdirSync(examplesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(examplesDir, file));
}

function assertString(errors, value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} must be a non-empty string`);
  }
}

function assertNumber(errors, value, label) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    errors.push(`${label} must be a non-negative number`);
  }
}

function validateTemplate(file) {
  const errors = [];
  let template;

  try {
    template = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return [`${file}: invalid JSON (${error.message})`];
  }

  assertString(errors, template.name, 'name');
  assertString(errors, template.issuer, 'issuer');
  assertNumber(errors, template.annualFee, 'annualFee');

  if (typeof template.imageUrl !== 'string' || !template.imageUrl.startsWith('/images/cards/')) {
    errors.push('imageUrl must start with /images/cards/');
  }

  if (!Array.isArray(template.sources) || template.sources.length === 0) {
    errors.push('sources must include at least one source');
  } else {
    template.sources.forEach((source, index) => {
      assertString(errors, source.label, `sources[${index}].label`);
      assertString(errors, source.url, `sources[${index}].url`);
      if (source.url && !/^https?:\/\//.test(source.url)) {
        errors.push(`sources[${index}].url must be an http(s) URL`);
      }
      if (source.accessed && !/^\d{4}-\d{2}-\d{2}$/.test(source.accessed)) {
        errors.push(`sources[${index}].accessed must use YYYY-MM-DD`);
      }
    });
  }

  if (!Array.isArray(template.benefits)) {
    errors.push('benefits must be an array');
  } else {
    template.benefits.forEach((benefit, index) => {
      assertString(errors, benefit.description, `benefits[${index}].description`);
      assertString(errors, benefit.category, `benefits[${index}].category`);
      assertNumber(errors, benefit.maxAmount, `benefits[${index}].maxAmount`);

      if (!allowedFrequencies.has(benefit.frequency)) {
        errors.push(`benefits[${index}].frequency must be one of ${Array.from(allowedFrequencies).join(', ')}`);
      }

      if (benefit.cycleAlignment && !allowedAlignments.has(benefit.cycleAlignment)) {
        errors.push(`benefits[${index}].cycleAlignment must be CARD_ANNIVERSARY or CALENDAR_FIXED`);
      }

      if (
        benefit.fixedCycleStartMonth !== undefined &&
        (!Number.isInteger(benefit.fixedCycleStartMonth) ||
          benefit.fixedCycleStartMonth < 1 ||
          benefit.fixedCycleStartMonth > 12)
      ) {
        errors.push(`benefits[${index}].fixedCycleStartMonth must be an integer from 1 to 12`);
      }

      if (
        benefit.fixedCycleDurationMonths !== undefined &&
        (!Number.isInteger(benefit.fixedCycleDurationMonths) || benefit.fixedCycleDurationMonths < 1)
      ) {
        errors.push(`benefits[${index}].fixedCycleDurationMonths must be a positive integer`);
      }
    });
  }

  return errors.map((error) => `${file}: ${error}`);
}

const files = process.argv.slice(2);
const targets = files.length > 0 ? files.map((file) => path.resolve(root, file)) : collectDefaultTemplates();
const errors = targets.flatMap(validateTemplate);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${targets.length} card template${targets.length === 1 ? '' : 's'}.`);
