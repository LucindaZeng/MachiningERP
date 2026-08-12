import {
  buildDeclarationManifest,
  currentVersionOf,
  diffAgainstDeclaration,
  missingPackDocuments,
  nextVersionOf,
  type DocumentVersionFacts,
} from '../services/customs-version.rules'

const CI = 'COMMERCIAL_INVOICE' as const
const PKL = 'PACKING_LIST' as const
const CON = 'CONTRACT' as const
const PACK = 'DATA_PACK' as const

function docs(...entries: Array<[typeof CI | typeof PKL | typeof CON | typeof PACK, number]>): DocumentVersionFacts[] {
  return entries.map(([kind, version]) => ({ kind, version }))
}

describe('版本链只增不改', () => {
  it('没生成过就是 V1', () => {
    expect(nextVersionOf([], CI)).toBe(1)
  })

  it('生成过就取最大版本 + 1', () => {
    expect(nextVersionOf(docs([CI, 1], [CI, 2]), CI)).toBe(3)
  })

  it('按最大版本算而不是按行数——将来删掉坏版本也不会把用过的号再发一次', () => {
    // V2 缺失（假设被清理过），下一版仍应是 V4 而不是 V3
    expect(nextVersionOf(docs([CI, 1], [CI, 3]), CI)).toBe(4)
  })

  it('各种文件各有各的链，互不影响', () => {
    const existing = docs([CI, 1], [CI, 2], [PKL, 1])
    expect(nextVersionOf(existing, CI)).toBe(3)
    expect(nextVersionOf(existing, PKL)).toBe(2)
    expect(nextVersionOf(existing, CON)).toBe(1)
  })

  it('当前版本取最新一版；没生成过返回 null', () => {
    expect(currentVersionOf(docs([CI, 1], [CI, 2]), CI)).toBe(2)
    expect(currentVersionOf(docs([CI, 1]), PKL)).toBeNull()
  })
})

describe('数据包必需件', () => {
  it('一份都没出时三份全缺', () => {
    expect(missingPackDocuments([])).toEqual([CI, PKL, CON])
  })

  it('齐了就不缺；形式发票有没有不影响', () => {
    expect(missingPackDocuments(docs([CI, 1], [PKL, 1], [CON, 1]))).toEqual([])
  })

  it('缺哪份报哪份', () => {
    expect(missingPackDocuments(docs([CI, 2], [CON, 1]))).toEqual([PKL])
  })
})

describe('申报清单快照', () => {
  it('每种已生成文件取当前版本，fixture CD2 那种 V2/V1 混排是常态', () => {
    const manifest = buildDeclarationManifest(docs([CI, 1], [CI, 2], [PKL, 2], [PACK, 1]))
    // 按种类名排序，输出与录入顺序无关——快照要能逐字比对
    expect(manifest).toEqual([
      { kind: CI, version: 2 },
      { kind: PACK, version: 1 },
      { kind: PKL, version: 2 },
    ])
  })

  it('没出过的种类不进清单——快照要与实际送出的材料对得上', () => {
    const manifest = buildDeclarationManifest(docs([CI, 1]))
    expect(manifest.map((line) => line.kind)).toEqual([CI])
  })

  it('一份都没出时快照为空', () => {
    expect(buildDeclarationManifest([])).toEqual([])
  })
})

describe('与上一版申报的差异 = 更正内容', () => {
  const declared = [
    { kind: CI, version: 1 },
    { kind: PKL, version: 1 },
  ]

  it('什么都没重出就没有差异', () => {
    expect(diffAgainstDeclaration(declared, docs([CI, 1], [PKL, 1]))).toEqual([])
  })

  it('重出一份就报一条，带上从哪版到哪版', () => {
    const lines = diffAgainstDeclaration(declared, docs([CI, 1], [CI, 2], [PKL, 1]))
    expect(lines).toEqual([{ kind: CI, fromVersion: 1, toVersion: 2 }])
  })

  it('申报后新增的文件种类同样算更正——从「没有」变成「有」也是陈述变了', () => {
    const lines = diffAgainstDeclaration(declared, docs([CI, 1], [PKL, 1], [CON, 1]))
    expect(lines).toEqual([{ kind: CON, fromVersion: 0, toVersion: 1 }])
  })

  it('多份同时重出时按种类排序，输出稳定', () => {
    const lines = diffAgainstDeclaration(
      declared,
      docs([CI, 2], [CI, 1], [PKL, 2], [PKL, 1]),
    )
    expect(lines.map((line) => line.kind)).toEqual([CI, PKL])
  })

  it('版本没往前走就不算重出（防御性：不会出现回退，但也不该被当成更正）', () => {
    expect(diffAgainstDeclaration([{ kind: CI, version: 3 }], docs([CI, 3]))).toEqual([])
  })

  it('上一版快照为空时，所有已生成文件都算新增', () => {
    const lines = diffAgainstDeclaration([], docs([CI, 1], [PKL, 1]))
    expect(lines).toEqual([
      { kind: CI, fromVersion: 0, toVersion: 1 },
      { kind: PKL, fromVersion: 0, toVersion: 1 },
    ])
  })
})
