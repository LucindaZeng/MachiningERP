import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { DOCGEN_ERRORS } from '@machining-erp/shared'
import { Injectable, Logger } from '@nestjs/common'
import { Workbook } from 'exceljs'

import { BizError } from '../../../common/errors/biz-error'
import {
  TEMPLATE_DEFINITIONS,
  type DocgenTemplateId,
  type TemplateDefinition,
} from '../constants/template-registry'

import { fillWorksheet } from './worksheet-filler'

/** 出具结果：字节 + 出具时用的模板版本（要随生成记录一起留痕）。 */
export interface RenderedWorkbook {
  bytes: Uint8Array
  templateId: DocgenTemplateId
  templateVersion: number
  /** 模板登记的中文名，用于拼文件名 */
  label: string
}

/**
 * 模板渲染：读模板 → 填数 → 出字节。**不碰存储、不碰数据库、不认识任何业务单据**。
 *
 * 模板文件读进来就缓存住：模板是随代码发布的只读资产，一次进程生命周期内不会变，
 * 而 xlsx 解压是这条链路上最贵的一步。缓存的是**字节**不是工作簿对象——
 * ExcelJS 的 Workbook 在填充时会被就地改写，共用一个实例第二次出具就串数据了。
 */
/**
 * ExcelJS 的 .d.ts 引用的是**非泛型**的 `Buffer`，而 @types/node 22 起 Buffer 带了
 * 泛型参数，两者结构上兼容、名义上不兼容。这个转换只为消掉那个名义差异，
 * 不改变任何运行时行为——集中一处，免得每个调用点各写一次 as。
 */
type ExcelBuffer = Parameters<Workbook['xlsx']['load']>[0]

function asExcelBuffer(bytes: Buffer): ExcelBuffer {
  return bytes as unknown as ExcelBuffer
}

@Injectable()
export class TemplateRendererService {
  private readonly logger = new Logger(TemplateRendererService.name)
  private readonly cache = new Map<string, Buffer>()

  /**
   * 模板目录。用 `__dirname` 而不是 `process.cwd()`：
   * jest 从 src 跑、生产从 dist 跑，只有相对自身位置才两边都对
   * （dist 侧由 nest-cli.json 的 assets 规则把 .xlsx 复制过去）。
   */
  private readonly templateDir = join(__dirname, '..', 'templates')

  async render(templateId: DocgenTemplateId, payload: unknown): Promise<RenderedWorkbook> {
    const definition = this.definitionOf(templateId)
    const book = await this.openTemplate(templateId, definition)

    try {
      for (const sheet of book.worksheets) {
        fillWorksheet(sheet, payload)
      }
      const bytes = new Uint8Array(await book.xlsx.writeBuffer())
      return {
        bytes,
        templateId,
        templateVersion: definition.version,
        label: definition.label,
      }
    } catch (error) {
      if (BizError.is(error)) throw error
      this.logger.error(`模板 ${templateId} 渲染失败`, error instanceof Error ? error.stack : '')
      throw new BizError(DOCGEN_ERRORS.RENDER_FAILED, { cause: error })
    }
  }

  private definitionOf(templateId: DocgenTemplateId): TemplateDefinition {
    const definition = TEMPLATE_DEFINITIONS[templateId]
    if (!definition) {
      throw new BizError(DOCGEN_ERRORS.TEMPLATE_NOT_FOUND, {
        message: `未登记的单据模板：${templateId}`,
      })
    }
    return definition
  }

  private async openTemplate(
    templateId: DocgenTemplateId,
    definition: TemplateDefinition,
  ): Promise<Workbook> {
    const book = new Workbook()
    try {
      await book.xlsx.load(asExcelBuffer(await this.bytesOf(definition)))
    } catch (error) {
      throw new BizError(DOCGEN_ERRORS.TEMPLATE_UNREADABLE, {
        message: `单据模板 ${definition.fileName} 无法读取`,
        cause: error,
      })
    }
    if (book.worksheets.length === 0) {
      throw new BizError(DOCGEN_ERRORS.TEMPLATE_UNREADABLE, {
        message: `单据模板 ${templateId} 里没有工作表`,
      })
    }
    return book
  }

  private async bytesOf(definition: TemplateDefinition): Promise<Buffer> {
    const cached = this.cache.get(definition.fileName)
    if (cached) return cached

    try {
      const bytes = await readFile(join(this.templateDir, definition.fileName))
      this.cache.set(definition.fileName, bytes)
      return bytes
    } catch (error) {
      throw new BizError(DOCGEN_ERRORS.TEMPLATE_NOT_FOUND, {
        message: `找不到模板文件 ${definition.fileName}`,
        cause: error,
      })
    }
  }
}
