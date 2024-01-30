import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Get()
  getHello(): { message: string } {
    return {
      message: 'Api Is working fine',
    };
  }
}
