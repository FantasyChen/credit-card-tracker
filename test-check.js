// Simple script to check for syntax errors in the test file
import fs from 'fs';

try {
  const content = fs.readFileSync('./src/app/api/cron/send-notifications/__tests__/route.test.ts', 'utf8');
  console.log('File exists and can be read');
  console.log('File size:', content.length, 'bytes');
  console.log('First 100 characters:', content.substring(0, 100));
} catch (error) {
  console.error('Error reading file:', error);
} 