#!/usr/bin/env python3
"""Generate the operation-level costing Markdown baseline."""

from pathlib import Path

from process_costing import (
    PROCESS_COST_ACCEPTANCE,
    PROCESS_COST_ALERTS,
    PROCESS_COST_APPROVALS,
    PROCESS_COST_COMPONENTS,
    PROCESS_COST_FIELDS,
    PROCESS_COST_FORMULAS,
    PROCESS_COST_MATRIX,
    PROCESS_COST_PRINCIPLES,
    PROCESS_COST_REPORTS,
    PROCESS_COST_WORKFLOW,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "features" / "operation-level-costing.md"


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
        "# 工序级制造成本核算",
        "> 本文件由 `tools/build_process_costing.py` 根据 `tools/process_costing.py` 生成，是ERP V2.0工序成本研发基线。",
        "## 核算原则\n\n" + bullets(PROCESS_COST_PRINCIPLES),
        "## 工序成本字段\n\n" + table(["分组", "字段与口径"], PROCESS_COST_FIELDS),
        "## 成本构成\n\n" + table(["成本组", "必须归集的内容"], PROCESS_COST_COMPONENTS),
        "## 计算公式\n\n" + table(["指标", "公式", "控制"], PROCESS_COST_FORMULAS),
        "## 工艺成本采集矩阵\n\n" + table(["工艺", "成本内容", "主要数据来源"], PROCESS_COST_MATRIX),
        "## 完整流程\n\n" + numbered(PROCESS_COST_WORKFLOW),
        "## 审批权限\n\n" + bullets(PROCESS_COST_APPROVALS),
        "## 预警\n\n" + bullets(PROCESS_COST_ALERTS),
        "## 报表\n\n" + table(["报表", "系统生成内容"], PROCESS_COST_REPORTS),
        "## 验收场景\n\n" + numbered(PROCESS_COST_ACCEPTANCE),
        "",
    ])


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print(OUT)
