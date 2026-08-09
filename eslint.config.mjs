import js from '@eslint/js'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'

/**
 * 模块化铁律的静态保障（development-guide 第 3 节）。
 * 尺寸红线与跨模块边界在此强制；controller 路由数与分层依赖方向
 * 由 `tools/check-module-boundaries.mjs` 补充校验（AST 级别，lint 脚本一并执行）。
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.tmp/**',
      'design/**',
      'example/**',
      'services/api/prisma/migrations/**',
      'services/api/src/generated/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  /* ---------------- 通用规范 ---------------- */
  {
    files: ['**/*.{ts,mts,vue}'],
    plugins: { 'import-x': importX },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: [
            'services/api/tsconfig.json',
            'packages/shared/tsconfig.json',
            'apps/web/tsconfig.json',
          ],
        }),
      ],
    },
    rules: {
      /* 尺寸红线：单文件 ≤ 400 行、单函数 ≤ 60 行 */
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['warn', 15],

      /* 禁止 any 出现在模块公共接口 */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /* 禁止吞异常 */
      'no-empty': ['error', { allowEmptyCatch: false }],

      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'error',
    },
  },

  /* ---------------- 后端：跨模块只能走 index.ts ---------------- */
  {
    files: ['services/api/**/*.ts'],
    rules: {
      /**
       * NestJS 用 emitDecoratorMetadata 做构造函数注入：被注入的类必须是**值导入**。
       * 一旦被自动改成 `import type`，运行期元数据会被擦除，DI 直接崩。
       * 因此后端整体关闭该规则（前端与 packages/shared 仍保留）。
       */
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/*/controllers/*', '**/modules/*/services/*'],
              message: '跨模块禁止直接引用 controllers/ 或 services/ 内部文件，请从模块 index.ts 引入或订阅领域事件。',
            },
            {
              group: ['**/modules/*/repositories/*'],
              message: '仓储层不对外暴露；跨模块请通过对方 index.ts 导出的 service 访问数据。',
            },
          ],
        },
      ],
    },
  },

  /* controller 只做 HTTP 编解码：禁止直接依赖仓储与 Prisma */
  {
    files: ['services/api/src/**/controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/repositories/*', '**/prisma/*', '@prisma/client'],
              message: 'controller 仅负责 HTTP 编解码，不得触碰数据访问层（development-guide 3.4）。',
            },
          ],
        },
      ],
    },
  },

  /* repository 只做数据访问：禁止依赖 service 与事件 */
  {
    files: ['services/api/src/**/repositories/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/services/*'],
              message: 'repository 仅负责数据访问，不写业务规则、不发事件（development-guide 3.4）。',
            },
          ],
        },
      ],
    },
  },

  /* 映射层：字段搬运不是「复杂度」 */
  {
    files: ['services/api/src/**/*.mapper.ts'],
    rules: {
      /**
       * mapper 是一长串 `input.x ?? 默认值` 的平铺映射，圈复杂度会被每个 ?? 顶高，
       * 但它没有任何分支逻辑，拆开反而更难一眼看全字段口径。
       * 尺寸红线（max-lines / max-lines-per-function）仍然生效。
       */
      complexity: 'off',
    },
  },

  /* DTO 不含逻辑：一个 DTO 一个文件，禁止函数声明 */
  {
    files: ['services/api/src/**/dto/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration',
          message: 'DTO 文件不得包含逻辑（development-guide 3.4），请移到 service 或 mapper。',
        },
        {
          selector: 'MethodDefinition[kind="method"]',
          message: 'DTO 文件不得包含逻辑（development-guide 3.4），请移到 service 或 mapper。',
        },
      ],
      'max-lines': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },

  /* 测试文件放宽尺寸限制 */
  {
    files: ['**/__tests__/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  /* CommonJS 配置文件 */
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },

  /* Prisma seed / 脚本 */
  {
    files: ['services/api/prisma/**/*.ts', '**/*.config.{ts,mts,js,mjs,cjs}', 'tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },

  /* ---------------- 前端 ---------------- */
  ...vue.configs['flat/recommended'],
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2023,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: { ...globals.browser },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-restricted-imports': 'off',
      /**
       * 中文排版里全角空格（U+3000）是正常的版式手段（如「报价单 导出时间：」），
       * 不是误敲的不可见字符，因此在前端关闭该规则，避免为了过 lint 去改产品文案。
       */
      'no-irregular-whitespace': 'off',
    },
  },
  {
    files: ['apps/web/src/pages/**/*.vue'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },

  prettier,
)
