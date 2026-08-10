/**
 * 可预览扩展名判定。
 *
 * 名单本身住在 `@machining-erp/shared` 的 file-extensions —— 上传白名单与
 * 预览白名单必须同源，否则会出现「传得上去但点开一片空白」的组合。
 * 这里只做转出，不再抄一份。
 */
export { extensionOf, isPreviewable, PREVIEWABLE_EXTENSIONS } from '@machining-erp/shared'
