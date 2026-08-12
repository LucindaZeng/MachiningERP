import { REQUIRED_FOR_DATA_PACK } from '../constants/customs-doc-kinds'

import type { CustomsDocKind } from '@prisma/client'

/**
 * 版本链与申报快照的纯规则（业务规格第 10 章
 * 「已提交版本只能更正或生成新版本，不能覆盖」）。
 *
 * 三条决定了这里长什么样：
 *
 * 1. **每种文件各有各的版本链。** fixture 里 CD2 的商业发票是 V2、报关单要素表是 V1
 *    ——同一个资料包里各文件版本不齐，这是常态而非异常：改一份不该逼着重出四份。
 * 2. **申报才是不可变边界。** 申报之前重出文件是日常迭代；申报之后每一次重出
 *    都要挂在一条带理由的更正记录上。理由的义务属于「对海关的陈述变了」这件事，
 *    不属于「文件又生成了一次」。
 * 3. **申报快照必须能原样复现。** 这一版申报到底送出去了哪几份的哪几版，
 *    事后任何重出都不许改动它。
 *
 * 本文件不碰数据库、不抛异常——只回答「下一版是几」「快照长什么样」「差在哪儿」，
 * 由服务层决定抛哪个错误码。
 */

export interface DocumentVersionFacts {
  kind: CustomsDocKind
  version: number
}

/** 申报清单的一行：某种文件的某一版被这次申报纳入。 */
export interface DeclarationLine {
  kind: CustomsDocKind
  version: number
}

/**
 * 某种文件的下一个版本号。没生成过就是 V1。
 *
 * 取**最大版本 + 1** 而不是「行数 + 1」：万一将来允许删除坏版本，
 * 按行数算会把已经用过的版本号再发一次，而那个号可能已经印在报关单上了。
 */
export function nextVersionOf(
  existing: readonly DocumentVersionFacts[],
  kind: CustomsDocKind,
): number {
  const versions = existing.filter((doc) => doc.kind === kind).map((doc) => doc.version)
  return versions.length === 0 ? 1 : Math.max(...versions) + 1
}

/** 某种文件的当前版本（最新一版）；没生成过返回 null。 */
export function currentVersionOf(
  existing: readonly DocumentVersionFacts[],
  kind: CustomsDocKind,
): number | null {
  const versions = existing.filter((doc) => doc.kind === kind).map((doc) => doc.version)
  return versions.length === 0 ? null : Math.max(...versions)
}

/** 数据包所需的文件里还缺哪几种（尚未生成过任何一版）。 */
export function missingPackDocuments(
  existing: readonly DocumentVersionFacts[],
): CustomsDocKind[] {
  return REQUIRED_FOR_DATA_PACK.filter((kind) => currentVersionOf(existing, kind) === null)
}

/**
 * 申报清单快照：每种**已生成**文件取它的当前版本。
 *
 * 形式发票没出过就不进清单——它是按需出具的收款工具，不是清关材料，
 * 硬塞一个空位只会让快照与实际送出的材料对不上。
 */
export function buildDeclarationManifest(
  existing: readonly DocumentVersionFacts[],
): DeclarationLine[] {
  const kinds = [...new Set(existing.map((doc) => doc.kind))]
  return kinds
    .map((kind) => ({ kind, version: currentVersionOf(existing, kind) as number }))
    .sort((left, right) => left.kind.localeCompare(right.kind))
}

export interface CorrectionLine {
  kind: CustomsDocKind
  fromVersion: number
  toVersion: number
}

/**
 * 与上一版申报快照相比，哪些文件被重出了。
 *
 * 这是更正记录的内容来源：不让人手填「改了哪几份」，而是拿两份快照一比。
 * 手填的清单迟早会跟实际情况对不上，而对不上的更正记录比没有更正记录更糟。
 */
export function diffAgainstDeclaration(
  declared: readonly DeclarationLine[],
  current: readonly DocumentVersionFacts[],
): CorrectionLine[] {
  const declaredByKind = new Map(declared.map((line) => [line.kind, line.version]))
  const lines: CorrectionLine[] = []

  for (const [kind, fromVersion] of declaredByKind) {
    const now = currentVersionOf(current, kind)
    if (now !== null && now > fromVersion) {
      lines.push({ kind, fromVersion, toVersion: now })
    }
  }

  // 申报之后新增的文件种类同样算更正：从「没有」变成「有」也是陈述变了
  for (const line of buildDeclarationManifest(current)) {
    if (!declaredByKind.has(line.kind)) {
      lines.push({ kind: line.kind, fromVersion: 0, toVersion: line.version })
    }
  }

  return lines.sort((left, right) => left.kind.localeCompare(right.kind))
}
