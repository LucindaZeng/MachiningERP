
import type {
  CreateChangeRequestData,
  CustomerChangeRequestRecord,
  CustomerChangeRequestRepositoryPort,
  DecideChangeRequestData,
} from '../repositories/customer-change-request.repository.port'
import type {
  CreateCustomerData,
  CustomerListFilter,
  CustomerListResult,
  CustomerRecord,
  CustomerRepositoryPort,
  UpdateCustomerData,
} from '../repositories/customer.repository.port'
import type { RequestStatus } from '@prisma/client'

export const BASE_CUSTOMER: CustomerRecord = {
  id: 'CU1',
  code: 'C0001',
  name: '苏州明泰自动化科技有限公司',
  shortName: '苏州明泰',
  region: 'DOMESTIC',
  country: '中国',
  englishName: null,
  englishAddress: null,
  ownerName: '张经理',
  ownerPhone: '13900000000',
  ownerEmail: null,
  salesUserCode: 'WFX-2018-0042',
  taxNo: '91320500MA1XXXXX',
  invoiceAddress: '苏州市工业园区 XX 路 8 号',
  bankAccount: '6222 0000 0000 0000',
  bankName: '中国银行',
  paymentTerm: 'NET_60',
  depositBps: null,
  invoiceType: 'SPECIAL',
  settlement: 'NOTE',
  currency: 'CNY',
  tradeTerm: null,
  level: 'B 类',
  status: 'ACTIVE',
  approvedBy: null,
  creditLimitMinor: 0n,
  creditUsedMinor: 0n,
  overdueAmountMinor: 0n,
  arDays: 0,
  addresses: [
    {
      id: 'A1',
      label: '总仓',
      receiver: '王收货',
      phone: '13800000000',
      address: '苏州市工业园区 XX 路 8 号',
      isDefault: true,
      sortOrder: 0,
    },
  ],
  createdBy: 'WFX-2018-0042',
  updatedAt: new Date('2026-08-08T10:00:00Z'),
  version: 1,
}

export class FakeCustomerRepository implements CustomerRepositoryPort {
  readonly rows: CustomerRecord[] = []

  constructor(seed: CustomerRecord[] = []) {
    this.rows.push(...seed)
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null
  }

  async findByCode(code: string): Promise<CustomerRecord | null> {
    return this.rows.find((row) => row.code === code) ?? null
  }

  async existsByName(name: string): Promise<boolean> {
    return this.rows.some((row) => row.name === name)
  }

  async list(filter: CustomerListFilter): Promise<CustomerListResult> {
    const matched = this.rows.filter(
      (row) =>
        (!filter.salesUserCode || row.salesUserCode === filter.salesUserCode) &&
        (!filter.q || row.name.includes(filter.q) || row.code.includes(filter.q)),
    )
    const start = (filter.page - 1) * filter.pageSize
    return { items: matched.slice(start, start + filter.pageSize), total: matched.length }
  }

  async create(data: CreateCustomerData): Promise<CustomerRecord> {
    const record: CustomerRecord = {
      ...BASE_CUSTOMER,
      ...data,
      id: `CU${this.rows.length + 1}`,
      approvedBy: null,
      updatedAt: new Date('2026-08-08T10:00:00Z'),
      version: 0,
      addresses: data.addresses.map((address, index) => ({ ...address, id: `A${index + 1}` })),
    }
    this.rows.push(record)
    return record
  }

  async update(data: UpdateCustomerData): Promise<CustomerRecord | null> {
    const index = this.rows.findIndex((row) => row.id === data.id && row.version === data.version)
    if (index < 0) return null

    const current = this.rows[index]
    if (!current) return null

    const next: CustomerRecord = {
      ...current,
      ...(data.patch as Partial<CustomerRecord>),
      version: current.version + 1,
      ...(data.addresses
        ? { addresses: data.addresses.map((address, i) => ({ ...address, id: `A${i + 1}` })) }
        : {}),
    }
    this.rows[index] = next
    return next
  }
}

export class FakeChangeRequestRepository implements CustomerChangeRequestRepositoryPort {
  readonly rows: CustomerChangeRequestRecord[] = []

  async findById(id: string): Promise<CustomerChangeRequestRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null
  }

  async listByCustomer(
    customerId: string,
    status?: RequestStatus,
  ): Promise<CustomerChangeRequestRecord[]> {
    return this.rows.filter(
      (row) => row.customerId === customerId && (!status || row.status === status),
    )
  }

  async create(data: CreateChangeRequestData): Promise<CustomerChangeRequestRecord> {
    const record: CustomerChangeRequestRecord = {
      id: `CCR${this.rows.length + 1}`,
      ...data,
      status: 'SUBMITTED',
      submittedAt: new Date('2026-08-08T10:00:00Z'),
      decidedBy: null,
      decidedAt: null,
      rejectReason: null,
      version: 0,
    }
    this.rows.push(record)
    return record
  }

  async decide(data: DecideChangeRequestData): Promise<boolean> {
    const row = this.rows.find(
      (item) => item.id === data.id && item.version === data.version && item.status === 'SUBMITTED',
    )
    if (!row) return false

    row.status = data.status
    row.decidedBy = data.decidedBy
    row.decidedAt = data.decidedAt
    row.rejectReason = data.rejectReason
    row.version += 1
    return true
  }
}
