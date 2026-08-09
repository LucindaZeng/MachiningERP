import { UserDirectoryService } from '../services/user-directory.service'

import { FakeUserRepository } from './fakes'

function build(): { service: UserDirectoryService; users: FakeUserRepository } {
  const users = new FakeUserRepository()
  users.users.push({
    id: 'user-1',
    userCode: 'WFX-2018-0042',
    account: 'luoxiaolin',
    audience: 'INTERNAL',
    formerAccount: null,
    displayName: '罗晓琳',
    departmentName: '业务部',
    passwordHash: 'hash',
    status: 'ACTIVE',
    employmentStatus: 'ACTIVE',
    leftAt: null,
    roleCodes: ['SALES_MANAGER'],
    permissionCodes: ['sales.hk-price.view'],
  })
  return { service: new UserDirectoryService(users), users }
}

describe('用户查询门面', () => {
  it('按账号域 + 用户名查登录用户', async () => {
    const { service } = build()
    expect(await service.findForLogin('INTERNAL', 'luoxiaolin')).toMatchObject({ id: 'user-1' })
    expect(await service.findForLogin('PORTAL', 'luoxiaolin')).toBeNull()
  })

  it('按唯一编码查用户（单据与审计的解析入口）', async () => {
    const { service } = build()
    expect(await service.findByUserCode('WFX-2018-0042')).toMatchObject({ account: 'luoxiaolin' })
    expect(await service.findByUserCode('WFX-9999-9999')).toBeNull()
  })

  it('按权限点列出责任人编码（通知派单用）', async () => {
    const { service } = build()
    expect(await service.listUserCodesByPermission('sys.account.admin')).toEqual(['WFX-2019-0001'])
  })

  it('更新最后登录时间', async () => {
    const { service } = build()
    await expect(service.touchLastLogin('user-1')).resolves.toBeUndefined()
    await expect(service.touchLastLogin('user-1', new Date())).resolves.toBeUndefined()
  })
})
