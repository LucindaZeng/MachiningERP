/**
 * 从调用栈里摘出「是哪个文件的哪一行抛的」（development-guide 第 4 节 · 错误可追溯）。
 *
 * 为什么需要它：错误码是**分类**，不是**位置**。`ORD_2805 LINES_REQUIRED` 在仓库里
 * 有五处抛出点，线上收到一条告警时，光靠 code 还得靠人去 grep 猜。
 * 把抛出点在构造时就钉下来，日志里就直接写着答案。
 *
 * 为什么解析字符串而不是别的：V8 的结构化调用栈 API 要挂 `Error.prepareStackTrace`
 * 全局钩子，那会跟 source-map 库互相打架。这里只读一次字符串，代价固定且不影响别人。
 */

/** 这些帧属于错误设施自己，不是业务抛出点，要跳过。 */
const INFRASTRUCTURE_FRAMES = ['biz-error.ts', 'error-source.ts']

/** 只保留仓库内的相对路径；node_modules 与 node 内部帧对定位业务问题没有价值。 */
const EXTERNAL_FRAMES = ['node_modules', 'node:internal']

/**
 * 返回形如 `modules/customs/services/customs-document.service.ts:87` 的位置串；
 * 实在解析不出来时返回 null，**绝不因为解析失败而影响抛错本身**——
 * 错误设施不该成为新的故障源。
 */
export function captureErrorSource(stack: string | undefined): string | null {
  if (!stack) return null

  for (const line of stack.split('\n').slice(1)) {
    if (INFRASTRUCTURE_FRAMES.some((frame) => line.includes(frame))) continue
    if (EXTERNAL_FRAMES.some((frame) => line.includes(frame))) continue

    const location = extractLocation(line)
    if (location) return location
  }

  return null
}

/**
 * 从一帧里抠出 `路径:行`。两种写法都要认：
 * `    at Foo.bar (/abs/path/file.ts:12:5)` 与 `    at /abs/path/file.ts:12:5`。
 */
function extractLocation(frame: string): string | null {
  const matched = /\(?((?:\/|[A-Za-z]:\\)[^()]+?):(\d+):\d+\)?\s*$/u.exec(frame.trim())
  const filePath = matched?.[1]
  const lineNo = matched?.[2]
  if (!filePath || !lineNo) return null

  return `${toRepoRelative(filePath)}:${lineNo}`
}

/**
 * 绝对路径对读日志的人没用，还会把构建机的目录结构泄进响应里。
 * 从 `src/` 之后截断——留下的正好是模块边界看得见的那一段。
 */
function toRepoRelative(filePath: string): string {
  const normalized = filePath.replace(/\\/gu, '/')
  const marker = normalized.lastIndexOf('/src/')
  return marker === -1 ? normalized : normalized.slice(marker + '/src/'.length)
}
