import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_30xx —— 工程变更申请（ECN，业务规格第 6 章）。
 *
 * 归在 ORD 段：ECN 由**业务**把客户的改图/改材料/改表面处理诉求提进系统，
 * 工程只是评估方；错误要回到业务员的工作台上，与 BOM 申请（ORD_24xx）同理。
 *
 * 本段最重要的一类是 `OUT_OF_SCOPE` 与 `SAMPLE_STAGE_REDIRECT`：
 * 它们不是「你填错了」，而是「这件事该走另一条路」——因此消息里必须
 * **点名正确去处**，否则用户只会把同一张单换个字眼再提一次。
 * 这与 contract-order 的 `REDIRECTED_INTENTS` 是同一张表的两个方向。
 */
export const ECN_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_3000',
    status: 404,
    message: '工程变更申请不存在',
  },
  NOT_EDITABLE: {
    code: 'ORD_3001',
    status: 409,
    message: '变更申请已被他人修改或已离开可编辑状态，请刷新后重试',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_3002',
    status: 403,
    message: '提交工程变更申请需要业务操作权限',
  },
  /** 影响评估与批准是工程岗的职责，业务不能自己评估自己提的变更 */
  ENGINEER_ROLE_REQUIRED: {
    code: 'ORD_3003',
    status: 403,
    message: '影响评估与变更批准需要工程操作权限',
  },
  /**
   * 越界的变更类型。消息由 `redirectHintFor` 补上正确去处，
   * 因此这里的默认文案只是兜底——真正有用的是那句「请走 XXX」。
   */
  OUT_OF_SCOPE: {
    code: 'ORD_3004',
    status: 422,
    message: '该变更类型不属于工程变更申请的受理范围',
  },
  /**
   * 样品阶段的改图走报价变更（业务规格 4.3）。
   * 样品本来就是拿来改的，每改一次都开一张 ECN 会把变更记录淹掉，
   * 而样品阶段真正要重算的是价格。
   */
  SAMPLE_STAGE_REDIRECT: {
    code: 'ORD_3005',
    status: 422,
    message: '样品阶段的产品变更请走报价单修改申请（业务规格 4.3），由报价工程师重新核价',
  },
  /** 改图必须给出新版图纸，否则「变更后」是一句没有依据的描述 */
  NEW_DRAWING_REQUIRED: {
    code: 'ORD_3006',
    status: 422,
    message: '图纸变更必须上传新版图纸后才能提交评估',
  },
  /** 业务规格第 6 章：改图必须联动改工艺路线，未同步不得发布 */
  ROUTING_NOT_SYNCED: {
    code: 'ORD_3007',
    status: 422,
    message: '图纸变更尚未同步更新工艺路线，不允许批准发布',
  },
  /** 中途改工序只能对指定批次版本生效，否则已投产批次会被无声地改掉 */
  EFFECTIVE_BATCH_REQUIRED: {
    code: 'ORD_3008',
    status: 422,
    message: '工艺工序变更必须指定生效批次版本后才能批准',
  },
  IMPACT_ASSESSMENT_REQUIRED: {
    code: 'ORD_3009',
    status: 422,
    message: '请先完成工程影响评估（在制、已采购、已完工、已发货四项）再送会签',
  },
  REJECT_REASON_REQUIRED: {
    code: 'ORD_3010',
    status: 400,
    message: '驳回工程变更必须填写理由',
  },
  IMPACT_SCOPE_DUPLICATED: {
    code: 'ORD_3011',
    status: 400,
    message: '同一影响范围只能评估一次',
  },
  SIGNOFF_NOT_COMPLETE: {
    code: 'ORD_3012',
    status: 422,
    message: '跨部门会签尚未完成，不能批准',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type EcnErrorKey = keyof typeof ECN_ERRORS
