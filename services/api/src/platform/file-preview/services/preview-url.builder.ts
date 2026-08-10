/**
 * 拼 kkFileView 4.x 的预览地址（deployment-environment.md 3.2）。
 *
 * 纯函数，不碰 IO，因为这里每一步都很容易搞反，而搞反的表现是
 * 「kkFileView 打开一片空白」——没有报错，只能靠盯 URL 排查。三条硬规则：
 *
 * 1. **先 Base64 再 URL 编码**，顺序不能反。预签名 URL 里带 `&X-Amz-*` 一堆参数，
 *    不先 Base64 的话第一个 `&` 就把 query 截断了。
 * 2. **`fullfilename` 必带**。对象键常常没有扩展名，kkFileView 靠这个参数
 *    挑渲染器；不给它就按纯文本渲染，dwg 图纸会变成一屏乱码。
 * 3. **水印带人**。方案里「文件水印与下载日志」落在这里：谁打开的，水印上写着谁。
 */
export interface PreviewUrlInput {
  baseUrl: string
  presignedUrl: string
  fileName: string
  watermarkText: string
}

export function buildPreviewUrl(input: PreviewUrlInput): string {
  const encodedUrl = encodeURIComponent(toBase64(input.presignedUrl))
  const params = [
    `url=${encodedUrl}`,
    `fullfilename=${encodeURIComponent(input.fileName)}`,
    `watermarkTxt=${encodeURIComponent(input.watermarkText)}`,
  ]

  return `${input.baseUrl}/onlinePreview?${params.join('&')}`
}

export function toBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

/**
 * 水印文案：姓名 + 工号。
 * 用工号而不只是姓名——重名的人有，重号的人没有，截图外流时要认得出是谁。
 */
export function composeWatermark(displayName: string, userCode: string): string {
  const name = displayName.trim()
  return name ? `${name} ${userCode}` : userCode
}
