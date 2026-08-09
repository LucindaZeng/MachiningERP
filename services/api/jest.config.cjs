/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
      },
    ],
  },
  /**
   * 业务规则全部住在 services/ 里（repositories/ 是薄适配器，靠迁移后的集成测试覆盖），
   * 因此覆盖率只盯 services/ 目录。
   */
  collectCoverageFrom: [
    'modules/**/services/**/*.ts',
    'platform/**/services/**/*.ts',
    'common/errors/*.ts',
    '!**/__tests__/**',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  /**
   * development-guide 第 4 节：核心算法分支覆盖 ≥ 90%。
   * 登录风控、编号发号、唯一编码与权限过滤都在下列目录内。
   */
  coverageThreshold: {
    global: { branches: 85, functions: 85, lines: 85, statements: 85 },
    './src/modules/auth/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/identity/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/quotation/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/masterdata/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/platform/numbering/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
}
