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
    './src/modules/bom-request/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/contract-order/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/quotation/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/shipment/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/invoice-request/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/sales-return/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/modules/customs/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    // ECN 的全部业务价值在受理闸门、影响评估与批准前置这三处
    './src/modules/ecn-request/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // docgen 的核心是标记引擎与合并导出；报表映射那几支是大段字段搬运，
    // 逐字段编场景只会得到一堆没在验证任何东西的测试。
    './src/modules/docgen/services/marker-parser.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/modules/docgen/services/cell-renderer.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/modules/docgen/services/repeat-plan.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/modules/docgen/services/merge-export.service.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // 分析层的核心是那支纯聚合口径文件；服务层大量分支是取不到的缺字段兜底，
    // 逐条编造场景去凑覆盖率只会得到一堆没在验证任何东西的测试。
    './src/modules/sales-analytics/services/analytics-aggregation.rules.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/modules/masterdata/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/platform/numbering/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/platform/file-preview/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/platform/object-storage/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
}
