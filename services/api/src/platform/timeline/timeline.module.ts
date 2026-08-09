import { Global, Module } from '@nestjs/common'

import { DOC_TIMELINE_REPOSITORY } from './repositories/doc-timeline.repository.port'
import { PrismaDocTimelineRepository } from './repositories/prisma-doc-timeline.repository'
import { DocTimelineService } from './services/doc-timeline.service'

@Global()
@Module({
  providers: [
    DocTimelineService,
    { provide: DOC_TIMELINE_REPOSITORY, useClass: PrismaDocTimelineRepository },
  ],
  exports: [DocTimelineService],
})
export class TimelineModule {}
