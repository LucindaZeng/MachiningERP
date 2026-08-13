/**
 * mock 开关。**单独成文件，且这个文件不许 import 任何 mock 代码。**
 *
 * 为什么不写在 mock-server.ts 里：`http.ts` 要判开关，如果开关住在 mock-server 里，
 * `http.ts` 就得静态 import 它，于是整棵 mock 依赖树（十几个 *.mock.ts 连着
 * 各自的 *.fixture.ts）被无条件打进生产包——实测过，mock 关闭的生产构建里
 * 仍有 8 个 chunk 能搜到演示客户名。运行期的 `if` 挡不住打包期的依赖图。
 *
 * 因此这里导出的是**常量而不是函数**：`import.meta.env.DEV` 与
 * `import.meta.env.VITE_USE_MOCK` 会被 Vite 在构建时替换成字面量，
 * 整个表达式随之折叠成 `true`/`false`，`http.ts` 里那句
 * `if (MOCK_ENABLED) { await import('./mock/mock-server') }` 的分支就能被整段摇掉。
 * 换成函数调用，压缩器不敢跨函数折叠，这条路就断了。
 *
 * 取值规则不变：显式配置 `VITE_USE_MOCK` 时以配置为准；
 * 未配置时开发态默认开启、生产构建默认关闭——`.env.*` 被 .gitignore 忽略，
 * 新同事克隆后无需先复制环境变量即可 `pnpm dev:web` 跑起来。
 */
const CONFIGURED = import.meta.env.VITE_USE_MOCK

export const MOCK_ENABLED: boolean =
  CONFIGURED === undefined || CONFIGURED === '' ? import.meta.env.DEV : CONFIGURED === 'true'
