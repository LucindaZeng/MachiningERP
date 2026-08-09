import { PERMISSION_CODES } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { UserDirectoryService } from '../../identity'
import { CustomerChangeApprovalService } from '../services/customer-change-approval.service'
import { CustomerUpdateService } from '../services/customer-update.service'
import { CustomerService } from '../services/customer.service'

import { BASE_CUSTOMER, FakeChangeRequestRepository, FakeCustomerRepository } from './fakes'

import type { Viewer } from '../services/customer-visibility'


const EDITOR: Viewer = { userCode: 'WFX-2018-0042', permissions: [PERMISSION_CODES.CUSTOMER_EDIT] }
const APPROVER: Viewer = {
  userCode: 'WFX-2016-0007',
  permissions: [PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT, PERMISSION_CODES.CUSTOMER_VIEW_ALL],
}

interface Harness {
  update: CustomerUpdateService
  approval: CustomerChangeApprovalService
  customers: FakeCustomerRepository
  requests: FakeChangeRequestRepository
  notify: jest.Mock
  notifyMany: jest.Mock
}

function build(seed = [BASE_CUSTOMER]): Harness {
  const customers = new FakeCustomerRepository(seed.map((row) => ({ ...row })))
  const requests = new FakeChangeRequestRepository()
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService
  const notify = jest.fn().mockResolvedValue(undefined)
  const notifyMany = jest.fn().mockResolvedValue(1)
  const notifications = { notify, notifyMany } as unknown as NotificationService
  const docNumber = { next: jest.fn().mockResolvedValue('CCR202608080001') } as unknown as DocNumberService
  const directory = {
    listUserCodesByPermission: jest.fn().mockResolvedValue(['WFX-2016-0007']),
  } as unknown as UserDirectoryService

  const customerService = new CustomerService(docNumber, audit, customers)
  const update = new CustomerUpdateService(
    customerService,
    docNumber,
    audit,
    notifications,
    directory,
    customers,
    requests,
  )
  const approval = new CustomerChangeApprovalService(audit, notifications, customers, requests)

  return { update, approval, customers, requests, notify, notifyMany }
}

describe('常规字段直接生效', () => {
  it('改客户等级立即落库，不产生审批单', async () => {
    const { update, customers, requests } = build()
    const result = await update.update('CU1', { version: 1, patch: { level: 'A 类' } }, EDITOR)

    expect(result.pendingChangeRequestNo).toBeNull()
    expect(result.customer.level).toBe('A 类')
    expect(customers.rows[0]?.level).toBe('A 类')
    expect(requests.rows).toHaveLength(0)
  })

  it('客户编号不可手工修改', async () => {
    const { update } = build()
    await expect(
      update.update('CU1', { version: 1, patch: { code: 'C9999' } }, EDITOR),
    ).rejects.toMatchObject({ code: 'ORD_2103' })
  })

  it('乐观锁版本不匹配返回 409', async () => {
    const { update } = build()
    await expect(
      update.update('CU1', { version: 99, patch: { level: 'A 类' } }, EDITOR),
    ).rejects.toMatchObject({ code: 'SYS_9009' })
  })

  it('改出「国内客户没有税号」这种半成品会被合并校验拦下', async () => {
    const { update } = build()
    await expect(
      update.update('CU1', { version: 1, patch: { taxNo: null }, reason: '客户要求' }, EDITOR),
    ).rejects.toMatchObject({ code: 'ORD_2101' })
  })

  it('整体替换送货地址时仍受「最多 5 个且恰一默认」约束', async () => {
    const { update } = build()
    const six = Array.from({ length: 6 }, () => ({
      label: '仓',
      receiver: '张',
      phone: '138',
      address: '地址',
      isDefault: false,
    }))

    await expect(
      update.update('CU1', { version: 1, patch: {}, addresses: six }, EDITOR),
    ).rejects.toMatchObject({ code: 'ORD_2101' })
  })
})

describe('敏感字段必须走审批', () => {
  it('改银行账号不会立即生效，而是生成变更申请', async () => {
    const { update, customers, requests, notifyMany } = build()
    const result = await update.update(
      'CU1',
      { version: 1, patch: { bankAccount: '6222 9999 9999 9999' }, reason: '客户换开户行' },
      EDITOR,
    )

    expect(result.pendingChangeRequestNo).toBe('CCR202608080001')
    expect(customers.rows[0]?.bankAccount).toBe('6222 0000 0000 0000')
    expect(requests.rows[0]?.status).toBe('SUBMITTED')
    expect(notifyMany).toHaveBeenCalledWith(
      ['WFX-2016-0007'],
      expect.objectContaining({ category: 'CUSTOMER_CHANGE' }),
    )
  })

  it('敏感变更没写理由直接拒绝', async () => {
    const { update } = build()
    await expect(
      update.update('CU1', { version: 1, patch: { paymentTerm: 'NET_30' } }, EDITOR),
    ).rejects.toMatchObject({ code: 'ORD_2101' })
  })

  it('常规字段与敏感字段同时改：前者生效、后者挂审批', async () => {
    const { update, customers } = build()
    const result = await update.update(
      'CU1',
      { version: 1, patch: { level: 'A 类', bankAccount: '6222 9999' }, reason: '换行' },
      EDITOR,
    )

    expect(customers.rows[0]?.level).toBe('A 类')
    expect(customers.rows[0]?.bankAccount).toBe('6222 0000 0000 0000')
    expect(result.pendingChanges.map((change) => change.field)).toEqual(['bankAccount'])
  })
})

describe('审批闭环', () => {
  async function submitChange(harness: Harness): Promise<string> {
    await harness.update.update(
      'CU1',
      { version: 1, patch: { bankAccount: '6222 9999 9999 9999' }, reason: '客户换开户行' },
      EDITOR,
    )
    return harness.requests.rows[0]?.id ?? ''
  }

  it('通过后才真正落库', async () => {
    const harness = build()
    const id = await submitChange(harness)

    await harness.approval.approve(id, APPROVER)
    expect(harness.customers.rows[0]?.bankAccount).toBe('6222 9999 9999 9999')
    expect(harness.requests.rows[0]?.status).toBe('APPROVED')
  })

  it('不能审批自己提交的变更（职责分离）', async () => {
    const harness = build()
    const id = await submitChange(harness)

    await expect(
      harness.approval.approve(id, { ...EDITOR, permissions: [PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT] }),
    ).rejects.toThrow(/职责分离/)
    expect(harness.customers.rows[0]?.bankAccount).toBe('6222 0000 0000 0000')
  })

  it('没有敏感字段权限不能审批', async () => {
    const harness = build()
    const id = await submitChange(harness)

    await expect(harness.approval.approve(id, { userCode: 'X', permissions: [] })).rejects.toThrow(
      /没有客户敏感字段审批权限/,
    )
  })

  it('驳回必须填理由，且理由回到提交人手上', async () => {
    const harness = build()
    const id = await submitChange(harness)

    await expect(harness.approval.reject(id, '   ', APPROVER)).rejects.toMatchObject({
      code: 'ORD_2113',
    })

    await harness.approval.reject(id, '开户行信息与营业执照不一致', APPROVER)
    expect(harness.customers.rows[0]?.bankAccount).toBe('6222 0000 0000 0000')
    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserCode: 'WFX-2018-0042',
        body: expect.stringContaining('开户行信息与营业执照不一致'),
      }),
    )
  })

  it('重复裁决被拦下', async () => {
    const harness = build()
    const id = await submitChange(harness)

    await harness.approval.approve(id, APPROVER)
    await expect(harness.approval.approve(id, APPROVER)).rejects.toMatchObject({ code: 'ORD_2112' })
  })

  it('申请不存在返回 404', async () => {
    const harness = build()
    await expect(harness.approval.approve('MISSING', APPROVER)).rejects.toMatchObject({
      code: 'ORD_2111',
    })
  })

  it('待审列表只列 SUBMITTED', async () => {
    const harness = build()
    const id = await submitChange(harness)

    expect(await harness.approval.listPending('CU1')).toHaveLength(1)
    await harness.approval.approve(id, APPROVER)
    expect(await harness.approval.listPending('CU1')).toHaveLength(0)
  })
})

describe('BizError 类型', () => {
  it('审批权限错误也是 BizError，能被统一错误出口接住', async () => {
    const harness = build()
    await harness.update.update(
      'CU1',
      { version: 1, patch: { bankAccount: '6222 9999' }, reason: '换行' },
      EDITOR,
    )
    const id = harness.requests.rows[0]?.id ?? ''

    const error = await harness.approval
      .approve(id, { userCode: 'X', permissions: [] })
      .catch((caught: unknown) => caught)
    expect(BizError.is(error)).toBe(true)
  })
})
