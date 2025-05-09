declare module '@prisma/nextjs-monorepo-workaround-plugin' {
  import { Compiler } from 'webpack';
  class PrismaPlugin {
    constructor(options?: any);
    apply(compiler: Compiler): void;
  }
  export { PrismaPlugin };
} 