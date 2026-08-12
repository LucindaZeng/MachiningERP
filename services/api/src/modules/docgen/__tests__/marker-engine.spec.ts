import { BizError } from '../../../common/errors/biz-error'
import { SELECTED_MARK, UNSELECTED_MARK } from '../constants/marker-syntax'
import { renderCell, rootContext } from '../services/cell-renderer'
import {
  isMarkerOnly,
  parseMarkers,
  repeatArraysOf,
  repeatValueAt,
  valueAt,
} from '../services/marker-parser'
import { blockHeight, blocksBottomUp, planRepeatBlocks } from '../services/repeat-plan'

/**
 * 标记引擎的逐条钉死。
 *
 * 这一层是 docgen 里最值得细测的部分：它决定了业务改模板时会不会填错，
 * 而填错**不会抛异常**——只会安静地出一份数字错位的对外单据。
 */

describe('标记解析', () => {
  it('认得三种标记，普通文字不当标记', () => {
    expect(parseMarkers('客户：{{customer.name}}')).toEqual([
      { kind: 'scalar', raw: '{{customer.name}}', path: 'customer.name' },
    ])
    expect(parseMarkers('{{*lines.qty}}')).toEqual([
      { kind: 'repeat', raw: '{{*lines.qty}}', arrayName: 'lines', field: 'qty' },
    ])
    expect(parseMarkers('{{?currency=CNY}}RMB')).toEqual([
      { kind: 'select', raw: '{{?currency=CNY}}', path: 'currency', expected: 'CNY' },
    ])
    expect(parseMarkers('没有标记的一行字')).toEqual([])
  })

  it('一格里多个标记按出现顺序全部取出', () => {
    const markers = parseMarkers('{{?a=1}}甲 {{?a=2}}乙 {{b}}')
    expect(markers.map((marker) => marker.kind)).toEqual(['select', 'select', 'scalar'])
  })

  it('写坏的标记按普通文字处理，不抛异常', () => {
    // 空标记体、缺右定界符、勾选缺等号、重复缺字段名
    expect(parseMarkers('{{}}')).toEqual([])
    expect(parseMarkers('{{未闭合')).toEqual([])
    expect(parseMarkers('{{?currency}}')).toEqual([])
    expect(parseMarkers('{{?=CNY}}')).toEqual([])
    expect(parseMarkers('{{*lines}}')).toEqual([])
    expect(parseMarkers('{{*lines.}}')).toEqual([])
    expect(parseMarkers('{{*.qty}}')).toEqual([])
  })

  it('整格只有一个标记时才走原生类型分支', () => {
    expect(isMarkerOnly('{{amount}}')).toBe(true)
    expect(isMarkerOnly('  {{amount}}  ')).toBe(true)
    expect(isMarkerOnly('合计 {{amount}}')).toBe(false)
    expect(isMarkerOnly('{{a}}{{b}}')).toBe(false)
  })

  it('点分路径取值；任一段缺失给 undefined 而不是抛', () => {
    const source = { a: { b: { c: 1 } } }
    expect(valueAt(source, 'a.b.c')).toBe(1)
    expect(valueAt(source, 'a.x.c')).toBeUndefined()
    expect(valueAt(source, 'a.b.c.d')).toBeUndefined()
    expect(valueAt(null, 'a')).toBeUndefined()
    expect(valueAt('字符串', 'a')).toBeUndefined()
  })

  it('重复行取值：# 给 1 基序号', () => {
    expect(repeatValueAt({ qty: 5 }, 'qty', 0)).toBe(5)
    expect(repeatValueAt({ qty: 5 }, '#', 0)).toBe(1)
    expect(repeatValueAt({ qty: 5 }, '#', 7)).toBe(8)
  })

  it('一行涉及的数组名去重保序', () => {
    expect(repeatArraysOf(['{{*lines.a}}', '{{*lines.b}}', '{{x}}'])).toEqual(['lines'])
    expect(repeatArraysOf(['{{*a.x}}', '{{*b.y}}'])).toEqual(['a', 'b'])
    expect(repeatArraysOf(['纯文字'])).toEqual([])
  })
})

describe('单元格渲染', () => {
  const context = rootContext({
    amount: 1234.5,
    when: new Date(2026, 7, 11),
    currency: 'CNY',
    flag: true,
    nothing: null,
    nested: { name: '万富鑫' },
  })

  it('没有标记时返回 undefined——调用方据此保持原值不动', () => {
    expect(renderCell('固定表头', context)).toBeUndefined()
  })

  it('整格一个标记时保留原生类型', () => {
    expect(renderCell('{{amount}}', context)).toBe(1234.5)
    expect(renderCell('{{when}}', context)).toBeInstanceOf(Date)
    expect(renderCell('{{flag}}', context)).toBe(true)
  })

  it('混排时拼成字符串，日期取 YYYY-MM-DD，空值出空串', () => {
    expect(renderCell('合计 {{amount}} 元', context)).toBe('合计 1234.5 元')
    expect(renderCell('日期：{{when}}', context)).toBe('日期：2026-08-11')
    expect(renderCell('备注：{{nothing}}', context)).toBe('备注：')
    expect(renderCell('缺字段：{{missing}}', context)).toBe('缺字段：')
  })

  it('取不到值的整格标记返回 null——把这一格清空', () => {
    expect(renderCell('{{missing}}', context)).toBeNull()
    expect(renderCell('{{nothing}}', context)).toBeNull()
  })

  it('勾选标记按字符串相等判定，数字与布尔也按文本比', () => {
    expect(renderCell('{{?currency=CNY}}RMB', context)).toBe(`${SELECTED_MARK}RMB`)
    expect(renderCell('{{?currency=USD}}USD', context)).toBe(`${UNSELECTED_MARK}USD`)
    expect(renderCell('{{?flag=true}}是', context)).toBe(`${SELECTED_MARK}是`)
    expect(renderCell('{{?amount=1234.5}}命中', context)).toBe(`${SELECTED_MARK}命中`)
    // 取不到的路径永远不会命中
    expect(renderCell('{{?missing=x}}', context)).toBe(UNSELECTED_MARK)
  })

  it('重复标记落在非重复行上给空值，而不是让整份文件出不来', () => {
    expect(renderCell('{{*lines.qty}}', context)).toBeNull()
  })

  it('重复上下文里取元素字段与序号', () => {
    const repeat = { payload: {}, item: { qty: 9 }, index: 2 }
    expect(renderCell('{{*lines.qty}}', repeat)).toBe(9)
    expect(renderCell('第 {{*lines.#}} 行', repeat)).toBe('第 3 行')
  })

  it('重复行里也能取表头字段——两种标记混在同一格', () => {
    const repeat = { payload: { currency: 'CNY' }, item: { qty: 9 }, index: 0 }
    expect(renderCell('{{*lines.qty}} {{currency}}', repeat)).toBe('9 CNY')
  })

  it('非标量对象落到字符串，不会把 [object Object] 之外的东西写进单元格', () => {
    const odd = rootContext({ blob: { toString: () => '自定义' } })
    expect(renderCell('{{blob}}', odd)).toBe('自定义')
  })
})

describe('重复区域规划', () => {
  const row = (rowNumber: number, ...texts: string[]) => ({ rowNumber, texts })

  it('连续同数组行并成一个区域，不连续的另起一块', () => {
    const blocks = planRepeatBlocks(
      [
        row(1, '表头'),
        row(2, '{{*lines.a}}'),
        row(3, '{{*lines.b}}'),
        row(4, '小计'),
        row(5, '{{*lines.c}}'),
      ],
      '测试表',
    )

    expect(blocks).toEqual([
      { arrayName: 'lines', startRow: 2, endRow: 3 },
      { arrayName: 'lines', startRow: 5, endRow: 5 },
    ])
  })

  it('相邻但不同数组的两行是两个区域', () => {
    const blocks = planRepeatBlocks([row(1, '{{*a.x}}'), row(2, '{{*b.y}}')], '测试表')
    expect(blocks.map((block) => block.arrayName)).toEqual(['a', 'b'])
  })

  it('一行同时引用两个数组判为模板错误，并点名行号', () => {
    expect(() => planRepeatBlocks([row(3, '{{*a.x}}', '{{*b.y}}')], '报价单')).toThrow(BizError)
    try {
      planRepeatBlocks([row(3, '{{*a.x}}', '{{*b.y}}')], '报价单')
    } catch (error) {
      expect((error as BizError).code).toBe('SYS_9052')
      expect((error as BizError).message).toContain('第 3 行')
      expect((error as BizError).message).toContain('报价单')
    }
  })

  it('没有重复行时得到空清单', () => {
    expect(planRepeatBlocks([row(1, '纯表头'), row(2)], '测试表')).toEqual([])
  })

  it('展开顺序自下而上——先动上面会把下面的行号推走', () => {
    const blocks = [
      { arrayName: 'a', startRow: 2, endRow: 2 },
      { arrayName: 'b', startRow: 9, endRow: 10 },
    ]
    expect(blocksBottomUp(blocks).map((block) => block.startRow)).toEqual([9, 2])
    // 原数组不被就地改动
    expect(blocks[0]!.startRow).toBe(2)
  })

  it('区域高度含首尾两行', () => {
    expect(blockHeight({ arrayName: 'a', startRow: 5, endRow: 5 })).toBe(1)
    expect(blockHeight({ arrayName: 'a', startRow: 5, endRow: 7 })).toBe(3)
  })
})
