import '@testing-library/jest-dom';

// Mock NextAuth adapter that's causing ESM issues
jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({
    createUser: jest.fn(),
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    getUserByAccount: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    linkAccount: jest.fn(),
    unlinkAccount: jest.fn(),
    createSession: jest.fn(),
    getSessionAndUser: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
    createVerificationToken: jest.fn(),
    useVerificationToken: jest.fn(),
  })),
}));

// Mock next-auth session functions
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock Prisma client globally
jest.mock('@/lib/prisma', () => ({
  prisma: {
    benefitStatus: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    creditCard: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    benefit: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    predefinedCard: {
      findMany: jest.fn(),
    },
    benefitUsageWay: {
      findMany: jest.fn(),
    },
    loyaltyAccount: {
      findMany: jest.fn(),
    },
  },
}));

// Mock Vercel Analytics
jest.mock('@vercel/analytics', () => ({
  Analytics: () => null,
  track: jest.fn(),
}));

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: jest.fn(),
}));

// Mock Next.js cache functions
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_cache: jest.fn(),
}));

// Global test environment setup
global.fetch = jest.fn();

// Mock Next.js Request and Response objects for API tests
global.Request = class Request {
  url: string;
  method: string;
  headers: Map<string, string>;
  body?: any;

  constructor(url: string, init?: any) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Map();
    
    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value as string);
      });
    }
    
    this.body = init?.body;
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }
} as any;

global.Response = class Response {
  status: number;
  statusText: string;
  headers: Map<string, string>;
  body: any;

  constructor(body?: any, init?: any) {
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.headers = new Map();
    this.body = body;

    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value as string);
      });
    }
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
} as any;

// Silence console.log/error during tests unless explicitly testing them
const originalConsole = { ...console };
beforeEach(() => {
  // Silence console output unless NODE_ENV=test-verbose
  if (process.env.NODE_ENV !== 'development') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterEach(() => {
  // Restore console
  Object.assign(console, originalConsole);
});