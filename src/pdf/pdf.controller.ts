import {
  Body,
  Controller,
  Post,
  Get,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { PdfService } from './pdf.service';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('api/pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Get()
  getHello(): string {
    return 'Working';
  }
  @Post('names')
  async getNames(@Body('inputPath') url: string): Promise<any> {
    if (!url) {
      throw new BadRequestException(
        'inputPath is required in the request body',
      );
    }
    return await this.pdfService.getNames(url);
  }

  @Post('rename')
  async rename(
    @Body('inputPath') url: string,
    @Body('oldFields') oldFields: string[],
    @Body('newFields') newFields: string[],
    @Body('output') output: string,
  ): Promise<any> {
    if (!url)
      throw new BadRequestException(
        'inputPath is required in the request body',
      );
    if (!oldFields)
      throw new BadRequestException(
        'oldFields is required in the request body',
      );
    if (!newFields)
      throw new BadRequestException(
        'newFields is required in the request body',
      );
    if (!output)
      throw new BadRequestException('output is required in the request body');

    return await this.pdfService.renameFields(
      url,
      oldFields,
      newFields,
      output,
    );
  }

  @Post('fill')
  async fill(
    @Body('inputPath') url: string,
    @Body('fieldNames') fieldNames: string[],
    @Body('fieldValues') fieldValues: string[],
    @Body('output') output: string,
    @Body('signatureFields')
    signatureFields: { name: string; placeholder_id: string; type: string }[],
    @Body('placeholders') placeholders: { id: string; name: string }[],
    @Body('recipients')
    recipients: {
      send_email: boolean;
      send_email_delay: number;
      id: string;
      name: string;
      email: string;
      placeholder_name: string;
    }[],
  ) {
    if (!url)
      throw new BadRequestException(
        'inputPath is required in the request body',
      );
    if (!fieldNames)
      throw new BadRequestException(
        'fieldNames is required in the request body',
      );
    if (!fieldValues)
      throw new BadRequestException(
        'fieldValues is required in the request body',
      );
    if (!output)
      throw new BadRequestException('output is required in the request body');
    if (!signatureFields)
      throw new BadRequestException(
        'signatureFields is required in the request body',
      );
    if (!placeholders)
      throw new BadRequestException(
        'placeholders is required in the request body',
      );
    if (!recipients)
      throw new BadRequestException(
        'recipients is required in the request body',
      );

    return await this.pdfService.fillForm(
      url,
      fieldNames,
      fieldValues,
      output,
      signatureFields,
      placeholders,
      recipients,
    );
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(@UploadedFiles() files: Array<File>) {
    console.log(files);
    if (!files)
      throw new BadRequestException('files is required in the request');
    const uploadedFiles = [];
    for (const file of files) {
      // const file = data.get('files') as File;
      const pdfStream = await file.arrayBuffer();
      const arr = new Uint8Array(pdfStream);
      const fileUrl = await this.pdfService.uploadFiles(file.name, arr);
      uploadedFiles.push({ name: file.name, url: fileUrl });
    }
    return { uploadedFiles };
  }
}
