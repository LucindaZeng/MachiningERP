import { Inject, Injectable } from '@nestjs/common'

import {
  DEPARTMENT_REPOSITORY,
  type DepartmentRecord,
  type DepartmentRepositoryPort,
} from '../repositories/department.repository.port'

import type { DepartmentDto } from '../dto/department.dto'

/** 十三部门主数据（命名以 example/基础资料工艺车间仓库ByCoder.xls「部门清单」为准）。 */
@Injectable()
export class DepartmentService {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repository: DepartmentRepositoryPort,
  ) {}

  list(): Promise<DepartmentRecord[]> {
    return this.repository.listActive()
  }

  /** 对外表示：裁掉 isActive 等内部字段，只给界面需要的列。 */
  async listForDisplay(): Promise<DepartmentDto[]> {
    const records = await this.repository.listActive()
    return records.map((record) => ({
      id: record.id,
      code: record.code,
      name: record.name,
      shortName: record.shortName,
      parentId: record.parentId,
      sortOrder: record.sortOrder,
    }))
  }

  findByCode(code: string): Promise<DepartmentRecord | null> {
    return this.repository.findByCode(code)
  }

  /** 账户申请填的是部门名称文本，这里做一次宽松匹配以便落 departmentId。 */
  findByName(name: string): Promise<DepartmentRecord | null> {
    return this.repository.findByName(name.trim())
  }
}
