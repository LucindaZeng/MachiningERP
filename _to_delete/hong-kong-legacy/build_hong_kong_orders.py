#!/usr/bin/env python3
"""Generate the Hong Kong customer formal-order price-rule baseline."""

from pathlib import Path

from hong_kong_orders import (
    HK_ALERTS,
    HK_APPROVALS,
    HK_CALCULATION_RULES,
    HK_DEPARTMENT_CONTROLS,
    HK_DOCUMENTS,
    HK_ORDER_FIELDS,
    HK_ORDER_PRINCIPLES,
    HK_ORDER_WORKFLOW,
    HK_REPORTS,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "workflows" / "hong-kong-manufacturing-orders.md"


def bullets(items):
    return "\n".join(f"- {item}" for item in items)


def numbered(items):
    return "\n".join(f"{idx}. {item}" for idx, item in enumerate(items, 1))


def table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def build():
    return "\n\n".join([
        "# 香港代生产客户正式订单70%价格规则",
        "> 本文件由 `tools/build_hong_kong_orders.py` 根据 `tools/hong_kong_orders.py` 生成，是ERP V2.0客户价格规则研发基线。",
        "## 核心原则\n\n" + bullets(HK_ORDER_PRINCIPLES),
        "## 必填字段\n\n" + table(["分组", "字段与口径"], HK_ORDER_FIELDS),
        "## 价格计算\n\n" + table(["指标", "计算", "控制"], HK_CALCULATION_RULES),
        "## 完整流程\n\n" + numbered(HK_ORDER_WORKFLOW),
        "## 系统生成文件\n\n" + table(["文件/报表", "内容"], HK_DOCUMENTS),
        "## 审批权限\n\n" + bullets(HK_APPROVALS),
        "## 预警\n\n" + bullets(HK_ALERTS),
        "## 管理报表\n\n" + table(["报表", "内容"], HK_REPORTS),
        "## 部门责任\n\n" + table(["角色", "责任"], HK_DEPARTMENT_CONTROLS),
        "",
    ])


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print(OUT)
