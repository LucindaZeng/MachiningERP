#!/usr/bin/env node
/**
 * 模块化铁律的结构化校验（development-guide 第 3 节中 ESLint 表达不了的部分）。
 *
 * 校验项：
 *  1. 每个业务模块必须有唯一对外出口 index.ts 与 <name>.module.ts；
 *  2. 模块内目录只允许固定分层：controllers / services / repositories / dto / events / __tests__ / guards / mappers /
 *     constants / templates（templates 放模块自有的静态资产，如 docgen 的受控 .xlsx 模板）；
 *  3. 单个 controller 路由数 ≤ 8；
 *  4. controller 文件内不得出现业务分支密度过高的迹象（仅编解码）——以「不得直接 import PrismaService」表达；
 *  5. dto 目录一个文件只导出一个 DTO 类/接口。
 *
 * 用法：node tools/check-module-boundaries.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MODULES_DIR = join(ROOT, 'services/api/src/modules')
const PLATFORM_DIR = join(ROOT, 'services/api/src/platform')

const ALLOWED_DIRS = new Set([
  'controllers',
  'services',
  'repositories',
  'dto',
  'events',
  'guards',
  'mappers',
  'constants',
  '__tests__',
  // 模块自有的静态资产（docgen 的受控 .xlsx 模板）。放在模块内而不是仓库级
  // assets/：模板是 docgen 的一部分，跟着模块走才符合「一切功能模块化」。
  // ⚠️ 非 .ts 资产不会被 tsc 带进 dist，需要 nest-cli.json 的 assets 规则复制。
  'templates',
])

const ROUTE_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete|All)\s*\(/gm
const MAX_ROUTES_PER_CONTROLLER = 8

/** @type {string[]} */
const errors = []

function exists(path) {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

function walk(dir) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

function checkModule(baseDir, moduleName, { requireNestModule }) {
  const moduleDir = join(baseDir, moduleName)

  if (!exists(join(moduleDir, 'index.ts'))) {
    errors.push(`模块 ${moduleName} 缺少唯一对外出口 index.ts`)
  }
  if (requireNestModule && !exists(join(moduleDir, `${moduleName}.module.ts`))) {
    errors.push(`模块 ${moduleName} 缺少 ${moduleName}.module.ts`)
  }

  for (const entry of readdirSync(moduleDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !ALLOWED_DIRS.has(entry.name)) {
      errors.push(
        `模块 ${moduleName} 出现非约定目录 ${entry.name}/（允许：${[...ALLOWED_DIRS].join(', ')}）`,
      )
    }
  }

  for (const file of walk(moduleDir)) {
    const rel = relative(ROOT, file)
    const source = readFileSync(file, 'utf8')

    if (rel.includes('/controllers/')) {
      const routes = source.match(ROUTE_DECORATOR)?.length ?? 0
      if (routes > MAX_ROUTES_PER_CONTROLLER) {
        errors.push(`${rel} 有 ${routes} 个路由，超过上限 ${MAX_ROUTES_PER_CONTROLLER}，请拆分 controller`)
      }
      if (/from ['"]@prisma\/client['"]/.test(source) || /PrismaService/.test(source)) {
        errors.push(`${rel} 直接依赖 Prisma；controller 仅做 HTTP 编解码`)
      }
    }

    if (rel.includes('/dto/')) {
      const exported = source.match(/^export\s+(class|interface|type|enum)\s+\w+/gm)?.length ?? 0
      if (exported > 1) {
        errors.push(`${rel} 导出了 ${exported} 个类型；一个 DTO 一个文件`)
      }
    }

    if (rel.includes('/repositories/') && /emit\(|EventEmitter|eventBus/.test(source)) {
      errors.push(`${rel} 发送了事件；repository 只做数据访问`)
    }
  }
}

function listDirs(dir) {
  if (!exists(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

function main() {
  if (!exists(MODULES_DIR)) {
    console.log('尚未创建 services/api/src/modules，跳过模块边界校验。')
    return 0
  }

  const modules = listDirs(MODULES_DIR)
  const platform = listDirs(PLATFORM_DIR)

  // 业务模块必须有 Nest module；platform/ 里的纯函数能力（如 state-machine）只要求 index.ts
  for (const moduleName of modules) checkModule(MODULES_DIR, moduleName, { requireNestModule: true })
  for (const moduleName of platform) checkModule(PLATFORM_DIR, moduleName, { requireNestModule: false })

  if (errors.length > 0) {
    console.error('模块化校验未通过：')
    for (const error of errors) console.error(`- ${error}`)
    return 1
  }

  console.log(`模块化校验通过（${modules.length} 个业务模块，${platform.length} 个平台能力）。`)
  return 0
}

process.exit(main())
