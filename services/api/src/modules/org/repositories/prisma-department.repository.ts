import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type { DepartmentRecord, DepartmentRepositoryPort } from './department.repository.port'


const SELECT = {
  id: true,
  code: true,
  name: true,
  shortName: true,
  parentId: true,
  sortOrder: true,
  isActive: true,
} as const

@Injectable()
export class PrismaDepartmentRepository implements DepartmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  listActive(): Promise<DepartmentRecord[]> {
    return this.prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: SELECT,
    })
  }

  findByCode(code: string): Promise<DepartmentRecord | null> {
    return this.prisma.department.findUnique({ where: { code }, select: SELECT })
  }

  findByName(name: string): Promise<DepartmentRecord | null> {
    return this.prisma.department.findFirst({
      where: { name, deletedAt: null },
      select: SELECT,
    })
  }
}
