"""Generate the detailed department control matrix in Markdown."""

from __future__ import annotations

from pathlib import Path

from department_controls import DEPARTMENT_DETAILS, GLOBAL_ALERT_RULES, GLOBAL_APPROVAL_RULES


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "product" / "department-control-matrix.md"


def bullet_block(items: list[str]) -> list[str]:
    lines: list[str] = []
    for item in items:
        lines.extend([f"- {item}", ""])
    return lines


def build() -> None:
    lines = [
        "# 十部门功能、权限、预警与报表矩阵",
        "",
        "> 本文件由 `tools/build_department_matrix.py` 根据 `tools/department_controls.py` 生成。详细业务流程、字段、系统边界和验收场景以 ERP Word 规划方案 V2.0 为准。",
        "",
        "## 全公司统一审核权限规则",
        "",
        *bullet_block(GLOBAL_APPROVAL_RULES),
        "## 全公司统一预警处理规则",
        "",
        *bullet_block(GLOBAL_ALERT_RULES),
    ]
    for department in DEPARTMENT_DETAILS:
        lines.extend(
            [
                f"## {department['name']}",
                "",
                f"**控制边界：** {department['scope']}",
                "",
                "### 具体功能明细",
                "",
                *bullet_block(department["functions"]),
                "### 审核与授权权限",
                "",
                *bullet_block(department["approvals"]),
                "### 预警信息",
                "",
                *bullet_block(department["alerts"]),
                "### 系统生成报表",
                "",
                *bullet_block(department["reports"]),
            ]
        )
    OUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Generated {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
