import { parseDurationSeconds } from '../services/token-duration'

describe('有效期解析', () => {
  it.each([
    ['3600', 3600],
    ['45s', 45],
    ['45m', 2700],
    ['8h', 28800],
    ['7d', 604800],
    [' 8h ', 28800],
  ])('%s → %i 秒', (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected)
  })

  it.each(['', '0h', '-1h', '8w', 'abc', '8 h'])('非法输入 %p 直接抛错', (input) => {
    expect(() => parseDurationSeconds(input)).toThrow(RangeError)
  })
})
