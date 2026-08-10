import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto'
import { InvoiceActionDto } from '../dto/invoice-action.dto'
import { IssueInvoiceDto } from '../dto/issue-invoice.dto'
import { VoidInvoiceDto } from '../dto/void-invoice.dto'
import { InvoiceCreditNoteService } from '../services/invoice-credit-note.service'
import { InvoiceIssuanceService } from '../services/invoice-issuance.service'
import { InvoiceReadService } from '../services/invoice-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { InvoiceRequestView } from '../dto/invoice-request-view.dto'

/**
 * 开票执行、交付跟踪与红冲作废。
 * 一律用动作端点而非 PATCH status（api-conventions.md），每一步的执行人与时刻都要留痕。
 */
@ApiTags('invoice-request')
@Controller('invoice-requests')
export class InvoiceIssuanceController {
  constructor(
    private readonly issuance: InvoiceIssuanceService,
    private readonly creditNotes: InvoiceCreditNoteService,
    private readonly reads: InvoiceReadService,
  ) {}

  @Post(':id/send-to-finance')
  @HttpCode(200)
  @ApiOperation({ summary: '送财务开票（三方金额不一致时在这一步拦下）' })
  async sendToFinance(
    @Param('id') id: string,
    @Body() dto: InvoiceActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    return this.reads.render(await this.issuance.sendToFinance(id, dto.versionLock, user))
  }

  @Post(':id/issue')
  @HttpCode(200)
  @ApiOperation({ summary: '财务开票并回填发票号；开出即「已开票交付」' })
  async issue(
    @Param('id') id: string,
    @Body() dto: IssueInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    return this.reads.render(await this.issuance.issue(id, dto.versionLock, dto.invoiceNo, user))
  }

  @Post(':id/mark-sent')
  @HttpCode(200)
  @ApiOperation({ summary: 'INV-04 已寄出（只推进时间线，状态不变）' })
  async markSent(
    @Param('id') id: string,
    @Body() dto: InvoiceActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    return this.reads.render(await this.issuance.markSent(id, dto.versionLock, user))
  }

  @Post(':id/mark-signed')
  @HttpCode(200)
  @ApiOperation({ summary: 'INV-04 客户已签收（必须先寄出）' })
  async markSigned(
    @Param('id') id: string,
    @Body() dto: InvoiceActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    return this.reads.render(await this.issuance.markSigned(id, dto.versionLock, user))
  }

  @Post(':id/void')
  @HttpCode(200)
  @ApiOperation({ summary: '作废（仅未开票前，理由必填）' })
  async voidInvoice(
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    return this.reads.render(await this.issuance.void(id, dto.versionLock, dto.reason, user))
  }

  @Post(':id/credit-note')
  @ApiOperation({ summary: '红冲：新开一张负数发票申请挂在原票下，原票不动' })
  async creditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    const record = await this.creditNotes.create(
      id,
      dto.reason,
      dto.amountIncTaxMinor ? BigInt(dto.amountIncTaxMinor) : null,
      user,
    )
    return this.reads.render(record)
  }
}
