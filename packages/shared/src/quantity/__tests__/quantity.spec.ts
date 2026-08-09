import {
  addQuantity,
  compareQuantity,
  formatQuantity,
  isPositiveQuantity,
  isZeroQuantity,
  multiplyQuantity,
  quantityOf,
  subtractQuantity,
} from '../quantity'

describe('数量（decimal 字符串，禁止浮点）', () => {
  it('统一按 6 位小数规整', () => {
    expect(quantityOf(100)).toBe('100.000000')
    expect(quantityOf('1.5')).toBe('1.500000')
  })

  it('加减不丢精度（0.1 + 0.2 用浮点会是 0.30000000000000004）', () => {
    expect(addQuantity(quantityOf('0.1'), quantityOf('0.2'))).toBe('0.300000')
    expect(subtractQuantity(quantityOf('100'), quantityOf('58'))).toBe('42.000000')
  })

  it('乘倍率', () => {
    expect(multiplyQuantity(quantityOf('12.5'), '4')).toBe('50.000000')
  })

  it('比较与判定', () => {
    expect(compareQuantity(quantityOf('1'), quantityOf('2'))).toBe(-1)
    expect(compareQuantity(quantityOf('2'), quantityOf('1'))).toBe(1)
    expect(compareQuantity(quantityOf('2'), quantityOf('2'))).toBe(0)
    expect(isPositiveQuantity(quantityOf('0.000001'))).toBe(true)
    expect(isPositiveQuantity(quantityOf('0'))).toBe(false)
    expect(isZeroQuantity(quantityOf('0'))).toBe(true)
  })

  it('展示时去掉尾部无意义的 0', () => {
    expect(formatQuantity(quantityOf('100'))).toBe('100')
    expect(formatQuantity(quantityOf('1.50'))).toBe('1.5')
  })

  it('非有限数直接抛错', () => {
    expect(() => quantityOf('abc')).toThrow(RangeError)
  })
})
