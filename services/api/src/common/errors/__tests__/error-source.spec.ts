import { SYSTEM_ERRORS } from '@machining-erp/shared'

import { BizError } from '../biz-error'
import { captureErrorSource } from '../error-source'

describe('抛出点解析', () => {
  it('认得带函数名的帧，路径截到 src/ 之后', () => {
    const stack = [
      'Error: boom',
      '    at BizError.<anonymous> (/repo/services/api/src/common/errors/biz-error.ts:30:5)',
      '    at CustomsService.declare (/repo/services/api/src/modules/customs/services/customs.service.ts:87:11)',
    ].join('\n')

    expect(captureErrorSource(stack)).toBe('modules/customs/services/customs.service.ts:87')
  })

  it('认得不带函数名的裸路径帧', () => {
    const stack = ['Error: boom', '    at /repo/services/api/src/modules/customs/x.ts:12:3'].join('\n')
    expect(captureErrorSource(stack)).toBe('modules/customs/x.ts:12')
  })

  it('跳过错误设施自己的帧——否则每条错误都指向 biz-error.ts', () => {
    const stack = [
      'Error: boom',
      '    at new BizError (/repo/services/api/src/common/errors/biz-error.ts:30:5)',
      '    at captureErrorSource (/repo/services/api/src/common/errors/error-source.ts:22:9)',
      '    at real (/repo/services/api/src/modules/customs/services/a.ts:9:1)',
    ].join('\n')

    expect(captureErrorSource(stack)).toBe('modules/customs/services/a.ts:9')
  })

  it('跳过 node_modules 与 node 内部帧——对定位业务问题没价值', () => {
    const stack = [
      'Error: boom',
      '    at Object.run (/repo/node_modules/@nestjs/core/x.js:10:1)',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
      '    at real (/repo/services/api/src/modules/customs/services/b.ts:41:7)',
    ].join('\n')

    expect(captureErrorSource(stack)).toBe('modules/customs/services/b.ts:41')
  })

  it('没有 src/ 段时保留整条路径，不硬猜', () => {
    const stack = ['Error: boom', '    at f (/opt/tool/lib/thing.js:5:1)'].join('\n')
    expect(captureErrorSource(stack)).toBe('/opt/tool/lib/thing.js:5')
  })

  it('解析不出来时返回 null，绝不因此再抛一个错——错误设施不该成为新的故障源', () => {
    expect(captureErrorSource(undefined)).toBeNull()
    expect(captureErrorSource('')).toBeNull()
    expect(captureErrorSource('Error: boom\n    at <anonymous>')).toBeNull()
  })
})

describe('BizError 自动记下抛出点', () => {
  it('构造即捕获，指向抛错那一行所在的文件', () => {
    const error = new BizError(SYSTEM_ERRORS.UNKNOWN)
    // 抛出点是本测试文件，而不是 biz-error.ts
    expect(error.source).toContain('error-source.spec.ts')
  })

  it('同一个错误码在不同位置抛出，source 各不相同——这正是它存在的理由', () => {
    const first = new BizError(SYSTEM_ERRORS.UNKNOWN)
    const second = new BizError(SYSTEM_ERRORS.UNKNOWN)

    expect(first.code).toBe(second.code)
    expect(first.source).not.toBe(second.source)
  })
})
