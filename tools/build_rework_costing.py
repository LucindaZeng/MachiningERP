#!/usr/bin/env python3
"""Generate the rework cost-accounting workflow Markdown."""

from pathlib import Path

from rework_costing import (
    REWORK_ALERTS,
    REWORK_APPROVAL_RULES,
    REWORK_COST_COMPONENTS,
    REWORK_COST_PRINCIPLES,
    REWORK_ORDER_FIELDS,
    REWORK_REPORTS,
    REWORK_SCENARIOS,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "workflows" / "rework-cost-accounting.md"


def bullets(items):
    return "\n".join(f"- {item}" for item in items)


def table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def build():
    return "\n\n".join([
        "# 返工子订单、重复成本与责任归集",
        "> 本文件由 `tools/build_rework_costing.py` 根据 `tools/rework_costing.py` 生成，是ERP V1.7返工成本研发基线。",
        "## 核心原则\n\n" + bullets(REWORK_COST_PRINCIPLES),
        "## 返工订单必填字段\n\n" + table(["分组", "字段与口径"], REWORK_ORDER_FIELDS),
        "## 返工成本组成\n\n" + table(["成本组", "内容"], REWORK_COST_COMPONENTS),
        "## 两类关键场景\n\n" + table(["场景", "返工路线", "重复成本", "供应商追加应付", "责任成本归集"], REWORK_SCENARIOS),
        "## 审批与关闭\n\n" + bullets(REWORK_APPROVAL_RULES),
        "## 预警\n\n" + bullets(REWORK_ALERTS),
        "## 系统生成报表\n\n" + table(["报表", "内容"], REWORK_REPORTS),
        "",
    ])


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print(OUT)
