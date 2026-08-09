import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { Public } from '../../../common/decorators/public.decorator'
import { DepartmentService } from '../services/department.service'

import type { DepartmentDto } from '../dto/department.dto'

@ApiTags('org')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departments: DepartmentService) {}

  /** 登录页「申请账户」的部门下拉需要在未登录时可读，因此标记为公开。 */
  @Public()
  @Get()
  @ApiOperation({ summary: '部门清单（十三部门）' })
  list(): Promise<DepartmentDto[]> {
    return this.departments.listForDisplay()
  }
}
