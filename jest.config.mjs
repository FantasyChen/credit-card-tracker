import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Add more setup options before each test is run
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  // preset: 'ts-jest', // Removed: next/jest handles transpilation
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    // Ensure @/generated/prisma is mapped if it's used directly elsewhere, though mocks target @/lib/prisma
    '^@/generated/prisma$': '<rootDir>/src/generated/prisma', 
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // if you have a setup file
  // Adjusted transformIgnorePatterns
  transformIgnorePatterns: [
    '/node_modules/(?!(@auth/prisma-adapter|next-auth))/', // Transform these specific ESM packages
    '^.+\\.module\\.(css|sass|scss)$'
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config); 