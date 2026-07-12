#!/usr/bin/env python3
"""Generate the detailed order lifecycle Markdown from the shared definition."""

from pathlib import Path

from order_lifecycle import (
    LIFECYCLE_REPORTS,
    LIFECYCLE_STAGES,
    ORDER_ALERTS,
    ORDER_TYPE_ALERTS,
    ORDER_TYPE_CONTROL_RULES,
    ORDER_TYPE_REPORTS,
    ORDER_TYPES,
    ORDER_MONITORING_END,
    ORDER_MONITORING_START,
    QUANTITY_HANDOFF_RULES,
    SLA_RULES,
    TIMING_FIELDS,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "workflows" / "order-to-pack-lifecycle.md"


def bullets(items):
    return "\n".join(f"- {item}" for item in items)


def build() -> str:
    lines = [
        "# 从报价到全检包装的订单全生命周期",
        "",
        "> 本文件由 `tools/build_order_lifecycle.py` 根据 `tools/order_lifecycle.py` 生成，是ERP V2.0的订单流程研发基线。香港代生产客户正式订单70%价格规则见 [香港客户价格规则](hong-kong-manufacturing-orders.md)，每道工艺独立核算见 [工序级成本](../features/operation-level-costing.md)。",
        "",
        "## 监测边界",
        "",
        f"- 主流程开始：{ORDER_MONITORING_START}",
        f"- 生产履约结束：{ORDER_MONITORING_END}",
        "",
        "## 业务订单三分类与收费规则",
        "",
        "| 订单类型 | 客户付费规则 | 收费方式 | 审核与业务控制 | 成本及财务处理 |",
        "| --- | --- | --- | --- | --- |",
    ]
    lines.extend(f"| {order_type} | {pay_rule} | {charge_mode} | {control} | {finance} |" for order_type, pay_rule, charge_mode, control, finance in ORDER_TYPES)
    lines.extend(["", "### 通用控制", "", bullets(ORDER_TYPE_CONTROL_RULES), "", "### 专项预警", "", bullets(ORDER_TYPE_ALERTS), "", "### 专项报表", "", "| 报表 | 内容 |", "| --- | --- |"])
    lines.extend(f"| {name} | {definition} |" for name, definition in ORDER_TYPE_REPORTS)
    lines.extend([
        "",
        "## 节点明细",
        "",
    ])
    phase = None
    for item in LIFECYCLE_STAGES:
        if item["phase"] != phase:
            phase = item["phase"]
            lines.extend([f"### {phase}", ""])
        lines.extend(
            [
                f"#### {item['code']} {item['stage']}",
                "",
                f"- 责任：{item['owner']}",
                f"- 适用：{item['required']}",
                f"- 起点：{item['start']}",
                f"- 动作：{item['actions']}",
                f"- 终点：{item['finish']}",
                f"- 控制：{item['control']}",
                f"- 预警：{item['alerts']}",
                "",
            ]
        )
    lines.extend(["## 节点计时字段", "", "| 字段 | 口径 |", "| --- | --- |"])
    lines.extend(f"| {name} | {definition} |" for name, definition in TIMING_FIELDS)
    lines.extend(["", "## SLA与改期规则", "", bullets(SLA_RULES), "", "## 工序数量交接规则", "", bullets(QUANTITY_HANDOFF_RULES)])
    lines.extend(["", "## 订单级预警", "", bullets(ORDER_ALERTS), "", "## 系统生成报表", "", "| 报表 | 内容 |", "| --- | --- |"])
    lines.extend(f"| {name} | {definition} |" for name, definition in LIFECYCLE_REPORTS)
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print(OUT)
