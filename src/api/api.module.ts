import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { ApiController } from './api.controller';
import { PdfModule } from 'src/pdf/pdf.module';

@Module({
  imports: [PdfModule],
  providers: [ApiService],
  controllers: [ApiController],
})
export class ApiModule {}
