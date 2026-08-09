import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateCustomerData,
  CustomerListFilter,
  CustomerListResult,
  CustomerRecord,
  CustomerRepositoryPort,
  UpdateCustomerData,
} from './customer.repository.port'

const INCLUDE = { addresses: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.CustomerInclude

function whereOf(filter: CustomerListFilter): Prisma.CustomerWhereInput {
  return {
    deletedAt: null,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.region ? { region: filter.region } : {}),
    // 数据权限在查询层强制注入，不依赖调用方自觉
    ...(filter.salesUserCode ? { salesUserCode: filter.salesUserCode } : {}),
    ...(filter.q
      ? {
          OR: [
            { name: { contains: filter.q, mode: 'insensitive' } },
            { shortName: { contains: filter.q, mode: 'insensitive' } },
            { code: { contains: filter.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

@Injectable()
export class PrismaCustomerRepository implements CustomerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CustomerRecord | null> {
    return this.prisma.customer.findFirst({ where: { id, deletedAt: null }, include: INCLUDE })
  }

  findByCode(code: string): Promise<CustomerRecord | null> {
    return this.prisma.customer.findFirst({ where: { code, deletedAt: null }, include: INCLUDE })
  }

  async existsByName(name: string): Promise<boolean> {
    const count = await this.prisma.customer.count({ where: { name, deletedAt: null } })
    return count > 0
  }

  async list(filter: CustomerListFilter): Promise<CustomerListResult> {
    const where = whereOf(filter)
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: INCLUDE,
        orderBy: { code: 'asc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ])
    return { items, total }
  }

  create(data: CreateCustomerData): Promise<CustomerRecord> {
    const { addresses, ...customer } = data
    return this.prisma.customer.create({
      data: { ...customer, addresses: { create: addresses } },
      include: INCLUDE,
    })
  }

  async update(data: UpdateCustomerData): Promise<CustomerRecord | null> {
    const updated = await this.prisma.customer.updateMany({
      where: { id: data.id, version: data.version, deletedAt: null },
      data: { ...data.patch, updatedBy: data.updatedBy, version: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    if (data.addresses) {
      await this.prisma.$transaction([
        this.prisma.customerDeliveryAddress.deleteMany({ where: { customerId: data.id } }),
        this.prisma.customerDeliveryAddress.createMany({
          data: data.addresses.map((address) => ({ ...address, customerId: data.id })),
        }),
      ])
    }

    return this.findById(data.id)
  }
}
