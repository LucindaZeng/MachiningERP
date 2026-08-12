# docgen —— 按受控模板出具对外单据

## 这个模块负责什么，不负责什么

| | 归谁 | 为什么 |
| --- | --- | --- |
| 「把我屏幕上这张表另存为 Excel」 | 前端 `apps/web/src/utils/export-excel.ts`（SheetJS） | 导的是**当前视图**，不需要版本、不需要留痕，走一趟服务端只是白等 |
| 「按公司模板出具一份发给客户的单据」 | **本模块** | 要留生成记录与模板版本、要盖汇率快照、要能被审计、要能在线预览 |

这条边界写在这里是因为它会被反复问。判据很简单：**这份文件会不会离开公司**。会，就走 docgen。

当前出具的单据：国内／国外报价单、CNC 成本分析表、客户对账单、报关四件套
（形式发票／商业发票／装箱单／出口合同／报关数据包），外加报价与成本分析的**多选合并比较表**。

## 业务人员怎么改模板（不用改代码）

模板文件在 `templates/`，就是普通的 `.xlsx`，用 Excel 直接打开改。

1. **改版式**（字体、列宽、边框、加一列备注、换 logo）：直接改，存盘即可。
2. **挪动填充位置**：把带 `{{}}` 的那一格**整格剪切**到新位置。标记跟着走，代码不用动。
3. **改完请把 `constants/template-registry.ts` 里这份模板的 `version` 加一。**
   这个号会随每一份出具记录落库；日后客户拿着一份旧单来问「这数怎么算的」，
   得先知道它是用哪一版模板出的。
4. 改完跑一次 `pnpm -F @machining-erp/api test -- docgen`：
   `template-rendering.spec.ts` 会拿真模板跑一遍，模板被改坏会当场红。

**不要做的两件事**：

- 不要删掉带 `{{*...}}` 的那一整行——那是明细行的样板，删了就没有明细。
  想让某列不显示，把那一格清空即可。
- 不要在明细行里写公式。复制行时 Excel 公式里的行号**不会**跟着走，
  第二行开始会算出错数。金额一律由后端算好填进来。

## 标记语法

四种，全部写在单元格文本里，可以和普通文字混排。

| 写法 | 含义 | 例 |
| --- | --- | --- |
| `{{customer.name}}` | 标量，按点分路径取值 | `客户名称：{{customer.name}}` |
| `{{*lines.qty}}` | 明细行。`lines` 是集合名，`qty` 是字段 | `{{*lines.qty}}` |
| `{{*lines.#}}` | 明细行的序号（从 1 起） | `{{*lines.#}}` |
| `{{?currency=CNY}}` | 勾选：相等出 `⊙`，否则出 `○` | `{{?currency=CNY}}RMB` |

几条约定：

- **整格只有一个标记**时写入原生类型（数字、日期），单元格自带的数字格式因此仍然有效，
  客户能对那一列求和。和文字混排时结果是字符串。
- 取不到值时**清空该格**，不写 `undefined`，也不写 0。
- **连续的、引用同一个集合的行**构成一个明细区域，可以跨多行。
  没有 `{{#each}}…{{/each}}` 这类成对定界符——在 Excel 里成对定界符最容易漏删一半。
- 一行同时引用两个集合会被判为模板错误并点名行号（`SYS_9052`），因为那没有确定的展开方式。

## 代码分层

```
constants/marker-syntax.ts        标记语法的定义
constants/template-registry.ts    模板清单：文件名、版本、阶梯/工艺列数上限
services/marker-parser.ts         纯：文本 → 标记
services/cell-renderer.ts         纯：标记 + 数据 → 单元格值
services/repeat-plan.ts           纯：哪几行是明细区域
services/worksheet-filler.ts      唯一认识 ExcelJS 的一支
services/template-renderer.service.ts  读模板（缓存字节）→ 填 → 出字节
services/document-issue.service.ts     渲染 + 落对象存储，四条出具路径共用
services/*-payload.mapper.ts      各单据记录 → 模板数据
services/docgen.service.ts        报价 / 成本 / 对账：出具 → 登记 → 审计
services/merge-export.service.ts  多选合并
services/customs-render.adapter.ts 报关：登记进 customs 的渲染注册表
```

前三支是纯函数、不认识 ExcelJS，因此能逐条测；覆盖率红线也压在它们身上。

## 两处容易踩的坑（都已被测试钉住）

1. **合并单元格写盘会丢。** ExcelJS 的 `duplicateRow` 复制字体、边框、行高，
   但复制出的合并区只活在内存模型里，另存后就没了。因此每份副本都要
   「先 `unMergeCells` 再 `mergeCells`」——先拆是因为内存里那份还在，
   不拆会撞上 `Cannot merge already merged cells`。
   丢了合并不只是不好看：产品名称本来跨 B:G，散开后会被右边的列盖住。
2. **多行区域的行序。** 逐个模板行各自复制 N 份得到的是「AAABBB」，
   要的是「ABABAB」。做法是先在区域末尾一次性追加 `份数 × 区域高度` 行，
   再逐行把样式搬过去。

## 生成物存在哪

- **报关文件**落在 `CustomsDocument` 自己的版本链行上（`objectKey` / `fileName`），
  预览按 `customs-document` 走。docgen **不**再为它记一份，两处登记会出现两份真相。
- **其余单据**落 `GeneratedDocument` 表，预览按 `generated-document` 走。
  这张表刻意没有 `doc_no` / 状态机 / 乐观锁：它不是单据，是单据的生成物，
  写下即不可变——要新的就再出一份，旧的原样留着。

## 还没做的

- **PDF**。当前只出 Excel。既定路线是**同一份填好的 xlsx 经 LibreOffice headless 转 PDF**，
  以侧车形式接在 `DocumentRenderer` 端口后面（也就是 dev-guide §1 里 `doc-render` 的抽取目标）。
  选它是因为它不引入第二份版式真相；Puppeteer + HTML 模板要维护两套版式，
  pdf-lib 要用代码重画版式，两者都会和业务手上的 .xlsx 慢慢分家。
  在此之前，客户要 PDF 可以在预览页直接打印为 PDF。
- **报关明细多行**。`CustomsDossierRecord` 目前一票一条商品，因此 `lines` 恒为一行。
  一票多品名（拼柜）到来时改的是取数，模板与引擎不用动。
- **报价单上的客户联系人／电话／传真**。客户档案里还没有这几个字段，模板上留空供手填。
