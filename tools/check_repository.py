#!/usr/bin/env python3
"""Dependency-free checks for the MachiningERP repository baseline."""

from __future__ import annotations

import re
import subprocess
import sys
import zipfile
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CHANGELOG.md",
    "LICENSE",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/ISSUE_TEMPLATE/feature_request.yml",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/integration_request.yml",
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/workflows/repository-check.yml",
    "docs/制造业ERP软件规划方案_V2.0.docx",
    "docs/制造业ERP软件规划方案_V2.1.docx",
    "docs/制造业ERP软件规划方案_V2.2.docx",
    "docs/制造业ERP软件规划方案_V2.3.docx",
    "docs/workflows/tail-quantity-rework.md",
    "docs/features/aged-work-order-monitoring.md",
    "docs/features/machine-loading-plan.md",
    "docs/architecture/adr/0003-technology-stack.md",
    "docs/development/development-guide.md",
    "docs/development/development-schedule.md",
    "docs/api/api-conventions.md",
    "docs/api/api-reference.md",
    "TODO.md",
    "docs/product/department-operating-model.md",
    "docs/product/department-control-matrix.md",
    "docs/product/requirements-baseline.md",
    "docs/architecture/system-context.md",
    "docs/workflows/cross-operation-rework.md",
    "docs/workflows/rework-cost-accounting.md",
    "docs/workflows/order-to-pack-lifecycle.md",
    "docs/features/metal-price-center.md",
    "docs/features/finance-executive-ai.md",
    "docs/features/operation-level-costing.md",
    "tools/department_controls.py",
    "tools/build_department_matrix.py",
    "tools/order_lifecycle.py",
    "tools/build_order_lifecycle.py",
    "tools/rework_costing.py",
    "tools/build_rework_costing.py",
    "tools/process_costing.py",
    "tools/build_process_costing.py",
]

MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
BASELINE_FILE = Path("packages/shared/src/baseline.ts")
BASELINE_CONST = re.compile(
    r"REQUIREMENTS_BASELINE_VERSION\s*=\s*['\"]([^'\"]+)['\"]"
)
LOCAL_ABSOLUTE = re.compile(r"(?:/Users/|[A-Za-z]:\\\\)")


def repository_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [ROOT / line for line in result.stdout.splitlines() if line]


def check_required(errors: list[str]) -> None:
    for name in REQUIRED:
        if not (ROOT / name).exists():
            errors.append(f"missing required file: {name}")


def check_markdown_links(files: list[Path], errors: list[str]) -> None:
    for path in files:
        if path.suffix.lower() != ".md" or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if LOCAL_ABSOLUTE.search(text):
            errors.append(f"local absolute path found in {path.relative_to(ROOT)}")
        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip().strip("<>")
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = unquote(target.split("#", 1)[0])
            if not target:
                continue
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                errors.append(
                    f"broken relative link in {path.relative_to(ROOT)}: {raw_target}"
                )


def check_issue_forms(errors: list[str]) -> None:
    for name in ("feature_request.yml", "bug_report.yml", "integration_request.yml"):
        path = ROOT / ".github" / "ISSUE_TEMPLATE" / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for key in ("name:", "description:", "body:"):
            if not re.search(rf"^{re.escape(key)}", text, re.MULTILINE):
                errors.append(f"{path.relative_to(ROOT)} missing top-level {key}")
        ids = re.findall(r"^\s+id:\s*([A-Za-z0-9_-]+)\s*$", text, re.MULTILINE)
        if len(ids) != len(set(ids)):
            errors.append(f"duplicate field id in {path.relative_to(ROOT)}")


def check_planning_document(version: str | None, errors: list[str]) -> None:
    builder = ROOT / "tools" / "build_erp_plan.py"
    if builder.exists() and 'DOC_VERSION = "V2.1"' not in builder.read_text(encoding="utf-8"):
        errors.append("tools/build_erp_plan.py is not configured for V2.1")
    # 完整性校验对准**当前基线**那一版，而不是某个写死的历史版本
    docx = ROOT / "docs" / f"制造业ERP软件规划方案_{version or 'V2.3'}.docx"
    if docx.exists():
        try:
            with zipfile.ZipFile(docx) as archive:
                bad = archive.testzip()
                if bad:
                    errors.append(f"DOCX ZIP contains a corrupt member: {bad}")
                if "word/document.xml" not in archive.namelist():
                    errors.append("DOCX is missing word/document.xml")
        except zipfile.BadZipFile:
            errors.append(f"{docx.name} 不是有效的 DOCX ZIP 包")


def read_baseline_version(errors: list[str]) -> str | None:
    """读出需求基线版本号的唯一事实源。

    用正则而不是执行 TypeScript：这个脚本只依赖 Python 标准库，
    为了读一个常量把 node/tsc 拉进来，代价远大于收益。
    """
    source = ROOT / BASELINE_FILE
    if not source.exists():
        errors.append(
            f"需求基线版本号的唯一事实源不存在：{BASELINE_FILE}"
            "（登录页角标与本检查都从它取值）"
        )
        return None

    matched = BASELINE_CONST.search(source.read_text(encoding="utf-8"))
    if not matched:
        errors.append(
            f"在 {BASELINE_FILE} 中找不到 REQUIREMENTS_BASELINE_VERSION 常量；"
            "它是登录页角标与规划方案校验的共同来源，不能删除或改名"
        )
        return None

    return matched.group(1)


def check_baseline_version(version: str | None, errors: list[str]) -> None:
    """常量与 Word 方案必须对得上。

    单靠一个常量挡不住漂移——它照样可以被改成一个并不存在的版本。
    真正的约束是这一条：**常量指向哪一版，仓库里就必须有哪一版的 Word 方案**，
    两边任意一侧单独动，仓库检查就是红的。
    """
    if version is None:
        return

    expected = ROOT / "docs" / f"制造业ERP软件规划方案_{version}.docx"
    if expected.exists():
        return

    available = sorted(
        path.name for path in (ROOT / "docs").glob("制造业ERP软件规划方案_*.docx")
    )
    errors.append(
        f"需求基线常量为 {version}，但缺少对应的规划方案 "
        f"docs/{expected.name}。"
        f"现有版本：{'、'.join(available) if available else '（一份都没有）'}。"
        f"请补齐该版 Word 方案，或把 {BASELINE_FILE} 里的 "
        "REQUIREMENTS_BASELINE_VERSION 改回实际版本"
    )


def check_prohibited_files(files: list[Path], errors: list[str]) -> None:
    prohibited_names = {".env", "id_rsa", "id_ed25519"}
    prohibited_suffixes = {".pem", ".p12"}
    for path in files:
        relative = path.relative_to(ROOT)
        if path.name in prohibited_names or path.suffix.lower() in prohibited_suffixes:
            errors.append(f"potential secret file must not be versioned: {relative}")
        if "__pycache__" in relative.parts or path.suffix == ".pyc":
            errors.append(f"generated Python cache must not be versioned: {relative}")


def main() -> int:
    errors: list[str] = []
    files = repository_files()
    baseline_version = read_baseline_version(errors)
    check_required(errors)
    check_markdown_links(files, errors)
    check_issue_forms(errors)
    check_baseline_version(baseline_version, errors)
    check_planning_document(baseline_version, errors)
    check_prohibited_files(files, errors)

    if errors:
        print("Repository checks failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Repository checks passed ({len(files)} versioned/candidate files inspected).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
