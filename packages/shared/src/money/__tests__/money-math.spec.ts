import { fromMinor, moneyOf, toMinor, zeroMinor } from '../money-codec'
import {
  addMinor,
  allocateMinor,
  compareMinor,
  convertMinor,
  isNegativeMinor,
  multiplyMinor,
  subtractMinor,
  sumMinor,
} from '../money-math'

describe('金额编解码（整数分 ↔ 定点字符串）', () => {
  it('按币种精度换算，并对超精度输入四舍五入', () => {
    expect(toMinor('1234.56', 'CNY')).toEqual({ minor: 123456n, currency: 'CNY' })
    expect(toMinor('1234.565', 'CNY')).toEqual({ minor: 123457n, currency: 'CNY' })
    expect(toMinor('1234.564', 'CNY')).toEqual({ minor: 123456n, currency: 'CNY' })
  })

  it('零精度币种（JPY）不产生小数位', () => {
    expect(toMinor('1234', 'JPY')).toEqual({ minor: 1234n, currency: 'JPY' })
    expect(fromMinor({ minor: 1234n, currency: 'JPY' })).toEqual({ amount: '1234', currency: 'JPY' })
  })

  it('回写时补齐到币种精度位数', () => {
    expect(fromMinor({ minor: 5n, currency: 'CNY' })).toEqual({ amount: '0.05', currency: 'CNY' })
    expect(moneyOf('10', 'USD')).toEqual({ amount: '10.00', currency: 'USD' })
  })

  it('负数与零可正常表达', () => {
    expect(fromMinor({ minor: -123n, currency: 'CNY' }).amount).toBe('-1.23')
    expect(zeroMinor('CNY')).toEqual({ minor: 0n, currency: 'CNY' })
  })

  it('非有限数直接抛错，不静默取 0', () => {
    expect(() => toMinor('abc', 'CNY')).toThrow()
    expect(() => toMinor('Infinity', 'CNY')).toThrow(RangeError)
  })

  it('舍入模式可显式指定', () => {
    expect(toMinor('1.005', 'CNY', 'DOWN').minor).toBe(100n)
    expect(toMinor('1.001', 'CNY', 'UP').minor).toBe(101n)
    expect(toMinor('1.005', 'CNY', 'HALF_EVEN').minor).toBe(100n)
  })
})

describe('金额运算', () => {
  const cny = (minor: bigint) => ({ minor, currency: 'CNY' as const })

  it('加减与求和', () => {
    expect(addMinor(cny(100n), cny(23n))).toEqual(cny(123n))
    expect(subtractMinor(cny(100n), cny(123n))).toEqual(cny(-23n))
    expect(sumMinor([cny(100n), cny(200n), cny(1n)])).toEqual(cny(301n))
  })

  it('空集合求和返回 null，避免凭空造出币种', () => {
    expect(sumMinor([])).toBeNull()
  })

  it('币种不一致一律抛错', () => {
    expect(() => addMinor(cny(1n), { minor: 1n, currency: 'USD' })).toThrow(TypeError)
    expect(() => compareMinor(cny(1n), { minor: 1n, currency: 'USD' })).toThrow(TypeError)
  })

  it('比较与负数判定', () => {
    expect(compareMinor(cny(1n), cny(2n))).toBe(-1)
    expect(compareMinor(cny(2n), cny(1n))).toBe(1)
    expect(compareMinor(cny(2n), cny(2n))).toBe(0)
    expect(isNegativeMinor(cny(-1n))).toBe(true)
    expect(isNegativeMinor(cny(0n))).toBe(false)
  })

  it('乘倍率：13% 增值税与香港 70% 折算', () => {
    expect(multiplyMinor(cny(10000n), '1.13')).toEqual(cny(11300n))
    expect(multiplyMinor(cny(10000n), '0.7')).toEqual(cny(7000n))
    // 5% 损耗 + 5% 管理费利润：分两步各自取整，口径与成本分析表一致
    expect(multiplyMinor(multiplyMinor(cny(10000n), '1.05'), '1.05')).toEqual(cny(11025n))
  })

  it('汇率换算按目标币种精度取整', () => {
    expect(convertMinor(cny(72000n), '0.1389', 'USD')).toEqual({ minor: 10001n, currency: 'USD' })
  })

  it('按权重分摊且合计不丢分', () => {
    const parts = allocateMinor(cny(100n), ['1', '1', '1'])
    expect(parts.map((part) => part.minor)).toEqual([34n, 33n, 33n])
    expect(parts.reduce((sum, part) => sum + part.minor, 0n)).toBe(100n)
  })

  it('权重合计为 0 时拒绝分摊', () => {
    expect(() => allocateMinor(cny(100n), ['0', '0'])).toThrow(RangeError)
  })
})
