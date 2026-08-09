# services/api —— 核心后端（NestJS 模块化单体）

结构与分层约束见 [开发文档第 3 节](../../docs/development/development-guide.md)，接口风格见 [接口规范](../../docs/api/api-conventions.md)。

## 目录

```
src/
  main.ts                 # 启动：全局前缀、校验管道、Swagger
  app.module.ts           # 装配平台能力与业务模块，注册全局守卫/拦截器/过滤器
  config/                 # 类型化配置（端口、JWT、登录风控阈值）
  common/                 # 跨切面：BizError、统一错误出口、响应包裹、traceId、装饰器
  infrastructure/prisma/  # PrismaService（唯一持有者，只允许 repositories/ 注入）
  platform/               # 平台共享能力，业务模块一律复用、禁止各自实现
    numbering/            # 统一单据编号（含用户唯一编码）
    state-machine/        # 单据状态机基类，非法迁移统一拦成 SYS_9012
    audit/                # 审计日志（责任人记唯一编码）
    timeline/             # 节点计时，进入新节点自动结算上一节点耗时
    events/               # 领域事件 + 出箱表（预警/计时/BI 的事实来源）
    notification/         # 统一通知（工作台通知流唯一写入口）
  modules/                # 业务模块，一个模块一个业务域
    auth/                 # 登录、JWT、图形验证码、登录风控
    identity/             # 用户、唯一编码、角色权限、账户申请、密码重置
    org/                  # 十三部门主数据
    masterdata/           # 客户档案（后续扩物料/图纸/BOM/工艺路线）
    quotation/            # 成本分析引擎、报价单闭环、修改申请、原材料价格与当日汇率
```

每个模块固定分层：`controllers/`（仅 HTTP 编解码）、`services/`（用例编排）、`repositories/`（仅数据访问）、`dto/`（一个 DTO 一个文件）、`events/`、`guards/`、`__tests__/`。

## 铁律怎么被强制

| 约束 | 强制手段 |
| --- | --- |
| 单文件 ≤ 400 行、单函数 ≤ 60 行 | ESLint `max-lines` / `max-lines-per-function` |
| 单 controller ≤ 8 个路由 | `tools/check-module-boundaries.mjs` |
| 跨模块只走对方 `index.ts` | ESLint `no-restricted-imports` |
| controller 不碰数据访问层 | ESLint（按目录）+ 模块边界脚本 |
| repository 不写业务、不发事件 | ESLint（按目录）+ 模块边界脚本 |
| 模块必须有 `index.ts` 与 `<name>.module.ts`，且只允许约定目录 | `tools/check-module-boundaries.mjs` |
| 依赖注入接线不被「类型导入」破坏 | `src/__tests__/app-module.spec.ts` 编译全量 AppModule |

## 本地启动

```bash
pnpm install
cp infra/.env.example infra/.env && cp services/api/.env.example services/api/.env
pnpm db:up                 # postgres + redis + minio
pnpm db:migrate            # 首次执行会依 schema.prisma 生成 prisma/migrations/
pnpm db:seed               # 十三部门、权限点、角色矩阵、编号规则、演示账号
pnpm dev:api               # http://localhost:3000/api/v1（文档 /api/v1/docs）
```

演示账号密码统一 `Wfx@2026`（门户账号 `Portal@2026`），与前端 mock 账号一一对应，见 `prisma/seeds/users.seed.ts`。

## 已实现端点

| 端点 | 说明 |
| --- | --- |
| `GET /auth/captcha` | 取图形验证码挑战（连续登录失败 3 次后必填） |
| `POST /auth/login` | 登录签发 JWT；风控 → 验证码 → 账号状态 → 口令校验 |
| `POST /auth/logout` | 注销，服务端立即撤销 token |
| `GET /auth/me` | 当前用户与权限点集合 |
| `POST /auth/account-availability` | 用户名可用性校验（离职释放的用户名可重新登记） |
| `POST /auth/account-requests` | 提交账户申请，注册即发放永不复用的唯一编码 |
| `POST /auth/password-reset-requests` | 忘记密码：派单给 IT 管理员重置 |
| `GET /departments` | 十三部门清单（登录页申请账户的部门下拉需要，故公开） |

## 关键业务口径

- **唯一编码 vs 用户名**：编码 `WFX-2026-0209` 在注册那一刻发放，终身不变、**永不复用**（`issued_user_codes` 台账只增不删）；用户名只是登录句柄，员工离职后 `users.account` 置空即释放，可被新人重新登记，`former_account` 保留原值仅用于提示。所有单据、审批与审计一律引用编码，因此换人不会让历史数据错乱。
- **登录风控**：连续失败 3 次强制图形验证码，8 次临时锁定 30 分钟，锁定窗口过后计数清零。阈值在 `services/api/.env` 可调。
- **忘记密码**：只生成重置申请派单给 IT 管理员，**不发邮件/短信重置链接**（产品决策）。
- **权限点**：登录响应下发 `user.permissions`，前端不再自行推导。香港 70% 价格 `sales.hk-price.view` 是独立权限点。
- **客户档案**：编号由平台统一编号规则生成、不可手改；国内客户必填税号；送货地址最多 5 个且**恰好一个**默认；付款条件三选一，选「预付比例 + 出货前付清」必须给比例。
- **香港 70% 的字段级隔离**：无 `sales.hk-price.view` 时，返回体里 `hk` **整组缺席**而不是给 `false`。列表、详情、报表与导出复用同一个 `toCustomerView` 出口，因此不存在「某个接口漏了裁剪」的可能。
- **敏感字段变更**：银行账号、付款条件、香港勾选等命中敏感清单的修改不会立即生效，而是生成变更申请；审批人必须持有 `customer.sensitive.edit`，且**不能审批自己提交的申请**（职责分离——改银行账号正是典型的舞弊路径）。驳回理由必填并回传提交人。
- **下单闸门**：`CustomerService.assertReadyForOrder(code)` 是 contract-order 模块下单前的硬校验，缺档时抛 `ORD_2104` 并在 `details.missing` 里给出可直接展示的缺失项清单。
- **成本分析计算链**（口径以 `example/成本分析/CNC成本分析.xls` 为准，已用表内三行真实数据逐项验证）：

  ```
  材料金额   = 预估重量 × 材料单价 − 余料 × 余料单价
  小计       = 材料金额 + 加工金额 + Σ工艺列
  损耗       = 小计 × 损耗率(默认 5%)
  管理费利润 = (小计 + 损耗) × 管理费率(默认 5%)     ← 基数是「小计+损耗」，会复利
  合计金额   = 小计 + 损耗 + 管理费利润              ← **不含模具费**
  含税金额   = 合计金额 × (1 + 13%)
  ```

  两个坑写在 `cost-analysis-calculator.ts` 的注释里，也各有测试钉住：① 管理费的基数不是小计；
  ② **中间不取整**——Excel 全程满精度只在显示时四舍五入，逐步取整会让样例第 4 行从 26.38 变成 26.39。
  副作用是各分项的显示值未必正好加得出显示的合计，这与源表现象一致。
- **费率可调，5%/5% 只是默认值**：损耗率与管理费利润率由报价工程师按产品与客户自行调整，
  7% 损耗 + 10% 管理费同样是合法组合（`PUT /cost-analyses/:id/rates`，也可在建单或重核时直接带）。
  校验只挡结构上不可能成立的取值——非整数、负数、超过 100%（后者是为了拦住「7% 误填成 700%」这类少打小数点的输入）。
  改费率直接改价，因此留痕记的是「5% → 7%」这样的可读值，事后追溯不用再换算万分比。
  费率形状 `CostRates` 沉在 `constants/`：仓储端口、service、入参映射与 controller 四处共用，
  放在 `repositories/` 会让 controller 触碰数据访问层而被 ESLint 判违规。
- **核价角色闸门**：`CostingService` 的每个写入口都先过 `assertQuoteEngineer`，闸门在 service 层而不只是 controller 守卫——报价单修改申请触发的重核也会走到这里。
- **报价硬校验**：无成本分析不能建单、每行产品缺图纸不能提交、报价低于成本逐档列出缺口（`findBelowCostTiers`），要求走修改申请让报价工程师重核。
- **材料价格与汇率**一律取「不晚于报价日期的最新一条」，这样半年后重算历史成本分析仍能取回当时的价格。
- **单件成本由后端推导，接口不收**：`resolveUnitCosts` 从成本分析按行算出单件成本再贴到每一档阶梯价上。
  若让调用方自带成本，业务员只要把成本填低就能绕过「低于成本价」这道拦截，整条规则就形同虚设。
  除法用全精度中间值 `exact.total` 再除数量、四舍五入到分——写成 bigint 除法会截断，每件差一分。
- **模具费单列**：挂在报价单表头 `moldFeeMinor`，不摊进任何一档单价。摊进去客户会按数量重复付模具费。
- **审核通过即锁成本分析版本**：`CostingService.lock` 之后 `replaceLines` / `complete` 全部被挡，
  改价只能经 `reviseFrom` 派生 version+1、`rootId` 指向初版的新版本，历史报价永远对得上当时的成本。
- **报价单修改申请**只有「重核」与「驳回」两个出口，没有「直接改价」的口子：改价必然伴随一份新的成本分析版本。
  驳回理由必填，且原样回到提交人的工作台。
- **成本与毛利按权限整组缺席**：`toQuotationView` 只在持有 `quote.costing.edit` 或 `quote.approve` 时才写出
  `cost` 这一组字段；无权限者拿到的对象里没有这个键，而不是给 0——单一序列化出口让泄露在结构上不可能发生。

## 测试

```bash
pnpm -F @machining-erp/api test          # 单元测试
pnpm -F @machining-erp/api test:cov      # 覆盖率（核心算法目录门槛 90% 分支）
```

Prisma 只出现在 `repositories/` 里，service 依赖模块内定义的仓储端口（port），因此 service 层单测用内存假实现即可跑满分支，不需要数据库。
