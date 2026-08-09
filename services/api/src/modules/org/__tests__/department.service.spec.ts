import { DepartmentService } from '../services/department.service'

import type {
  DepartmentRecord,
  DepartmentRepositoryPort,
} from '../repositories/department.repository.port'

const SALES: DepartmentRecord = {
  id: 'dep-1',
  code: 'SALES',
  name: '业务部',
  shortName: '业务',
  parentId: null,
  sortOrder: 30,
  isActive: true,
}

class FakeDepartmentRepository implements DepartmentRepositoryPort {
  constructor(private readonly rows: DepartmentRecord[]) {}

  async listActive(): Promise<DepartmentRecord[]> {
    return this.rows.filter((row) => row.isActive)
  }

  async findByCode(code: string): Promise<DepartmentRecord | null> {
    return this.rows.find((row) => row.code === code) ?? null
  }

  async findByName(name: string): Promise<DepartmentRecord | null> {
    return this.rows.find((row) => row.name === name) ?? null
  }
}

describe('部门主数据', () => {
  const service = new DepartmentService(new FakeDepartmentRepository([SALES]))

  it('只返回启用中的部门', async () => {
    expect(await service.list()).toEqual([SALES])
  })

  it('按编码查询', async () => {
    expect(await service.findByCode('SALES')).toEqual(SALES)
    expect(await service.findByCode('NOPE')).toBeNull()
  })

  it('按名称查询会先 trim（账户申请填的是文本部门名）', async () => {
    expect(await service.findByName('  业务部  ')).toEqual(SALES)
    expect(await service.findByName('不存在的部门')).toBeNull()
  })
})

describe('对外表示', () => {
  const service = new DepartmentService(new FakeDepartmentRepository([SALES]))

  it('裁掉 isActive 等内部字段，只给界面需要的列', async () => {
    const [dto] = await service.listForDisplay()

    expect(dto).toEqual({
      id: 'dep-1',
      code: 'SALES',
      name: '业务部',
      shortName: '业务',
      parentId: null,
      sortOrder: 30,
    })
    expect(dto && 'isActive' in dto).toBe(false)
  })

  it('停用部门不出现在下拉里', async () => {
    const withDisabled = new DepartmentService(
      new FakeDepartmentRepository([SALES, { ...SALES, id: 'dep-2', code: 'OLD', isActive: false }]),
    )
    expect(await withDisabled.listForDisplay()).toHaveLength(1)
  })
})
