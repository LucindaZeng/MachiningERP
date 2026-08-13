/**
 * 需求基线版本号——**唯一事实源，升级 Word 方案版本时只改这里**。
 *
 * 之前它是登录页角标里的一个字符串字面量，已经跟着 Word 方案漂了两次
 * （方案出到 V2.5，角标还停在 V2.1）。字面量之所以必然漂，是因为
 * 「改方案」和「改角标」是两件在时间和人上都分开的事，没人会记得第二件。
 *
 * 现在只有这一处。`tools/check_repository.py` 会用正则读走这个值，
 * 断言 `docs/制造业ERP软件规划方案_<版本>.docx` 确实在仓库里——
 * 因此**改了常量却没放对应的 Word 方案，仓库检查会直接红**，反过来也一样。
 * 这条约束才是单一事实源真正的保障：光有常量，仍然可以改成一个不存在的版本。
 */
export const REQUIREMENTS_BASELINE_VERSION = 'V2.5'

/** 登录页角标等处直接可用的展示文案。 */
export const REQUIREMENTS_BASELINE_LABEL = `需求基线 ${REQUIREMENTS_BASELINE_VERSION}`
