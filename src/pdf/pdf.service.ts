import { Injectable } from '@nestjs/common';
import { PDFCheckBox, PDFDocument, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class PdfService {
  async uploadFiles(output: string, file: Uint8Array): Promise<string> {
    const fileName = `pdf/${uuidv4()}/${output}`;
    const s3 = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_BUCKET_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_BUCKET_SECRET_ACCESS_KEY!,
      },
      region: process.env.AWS_S3_REGION!,
    });
    // const modifiedPdfBytes = await file.arrayBuffer();
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: fileName,
      Body: file,
      ContentType: 'application/pdf',
    });
    const uploadResponse = await s3.send(command);
    console.log('PDF uploaded successfully:', uploadResponse);
    const fileUrl = `${process.env.S3_BASE_URL}${fileName}`;
    return fileUrl;
  }

  async getNames(url: string, cond = false): Promise<any> {
    const response = await fetch(url);
    const pdfBuffer = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const fieldsName = [];
    fields.forEach((field) => {
      const type = field.constructor.name;
      const name = field.getName();
      if (cond) {
        if (type == 'PDFTextField') {
          fieldsName.push([type, name]);
        }
      } else {
        fieldsName.push([type, name]);
      }
      // console.log(`${type}: ${name}`);
    });
    return fieldsName;
  }

  async renameFields(
    url: string,
    oldFields: string[],
    newFields: string[],
    output: string,
  ): Promise<{ success: boolean; error: any | null; fileURL: string | null }> {
    const response = await fetch(url);
    const pdfBuffer = await response.arrayBuffer();
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    for (let i = 0; i < oldFields.length; i++) {
      const textField = form.getField(oldFields[i]);
      const fieldType = textField.constructor.name;
      if (textField) {
        const widgets = textField.acroField.getWidgets();
        const props = [];
        widgets.forEach((w) => {
          let value;
          if (fieldType == 'PDFRadioGroup') {
            value = w.getOnValue();
          }
          // console.log(w.get);
          const rect = w.getRectangle();
          const page = pdfDoc.getPages().find((p) => p.ref === w.P());
          //   console.log(page);
          if (fieldType == 'PDFRadioGroup') {
            props.push({
              dimensions: rect,
              page: page,
              value: value.encodedName,
            });
          } else {
            props.push({ dimensions: rect, page: page });
          }
          // console.log(rect);
        });
        form.removeField(textField);
        if (fieldType == 'PDFRadioGroup') {
          const radiogroup = form.createRadioGroup(newFields[i]);
          props.forEach((prop) => {
            radiogroup.addOptionToPage(
              prop.value.replace('/', ''),
              prop.page,
              prop.dimensions,
            );
          });
        } else if (fieldType == 'PDFTextField') {
          const textfield = form.createTextField(newFields[i]);
          props.forEach((prop) => {
            const dimensions = prop.dimensions;
            textfield.addToPage(prop.page, {
              ...dimensions,
              borderWidth: 0,
            });
          });
        } else if (fieldType == 'PDFCheckBox') {
          const textfield = form.createCheckBox(newFields[i]);
          props.forEach((prop) => {
            const dimensions = prop.dimensions;
            textfield.addToPage(prop.page, {
              ...dimensions,
              borderWidth: 0,
            });
          });
        }
      } else {
        continue;
      }
    }
    const modifiedPdfBytes = await pdfDoc.save();
    try {
      const fileUrl = await this.uploadFiles(output, modifiedPdfBytes);

      return {
        success: true,
        error: null,
        fileURL: fileUrl,
      };
    } catch (error) {
      console.error('Error uploading PDF:', error);
      return {
        success: false,
        error: error,
        fileURL: null,
      };
    }
  }

  async fillForm(
    url: string,
    fieldNames: string[],
    fieldValues: string[],
    output: string,
    signatureFields: { name: string; placeholder_id: string; type: string }[],
    placeholders: { id: string; name: string }[],
    recipients: {
      send_email: boolean;
      send_email_delay: number;
      id: string;
      name: string;
      email: string;
      placeholder_name: string;
    }[],
  ): Promise<any> {
    const file = await fetch(url);
    const pdfBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const results = [];
    for (let i = 0; i < fieldNames.length; i++) {
      if (form.getField(fieldNames[i])) {
        const fieldType = form.getField(fieldNames[i]).constructor.name;
        if (fieldType == 'PDFTextField') {
          const field = form.getField(fieldNames[i]) as PDFTextField;
          field.setText(fieldValues[i]);
        } else if (fieldType == 'PDFRadioGroup') {
          const field = form.getField(fieldNames[i]) as PDFRadioGroup;
          field.select(fieldValues[i]);
        } else if (fieldType == 'PDFCheckBox') {
          const field = form.getField(fieldNames[i]) as PDFCheckBox;
          if (fieldValues[i]) {
            field.check();
          }
        }
        results.push({
          success: true,
          message: 'Field filled',
          field: fieldNames[i],
        });
      } else {
        results.push({
          success: false,
          message: 'Field Not found',
          field: fieldNames[i],
        });
      }
    }
    const modifiedPdfBytes = await pdfDoc.save();
    const fileUrl = await this.uploadFiles(output, modifiedPdfBytes);

    console.log('fileURl:', fileUrl);
    // const textFields = await this.getNames(url, true);
    const props = [];
    for (let i = 0; i < signatureFields.length; i++) {
      const textField = form.getField(signatureFields[i].name);
      if (textField) {
        const widgets = textField.acroField.getWidgets();

        widgets.forEach((w) => {
          const rect = w.getRectangle();
          const page = pdfDoc.getPages().find((p) => p.ref === w.P());

          const pageSize = page.getSize();

          const resolution = 72; // Assuming 72 DPI if not specified in PDF
          const conversionFactor = 72 / resolution;
          const rectInPixels = {
            x: rect.x * conversionFactor,
            y:
              pageSize.height -
              rect.y * conversionFactor -
              rect.height * conversionFactor,
            width: rect.width * conversionFactor,
            height: rect.height * conversionFactor,
          };

          const pageIndex = pdfDoc.getPages().findIndex((p) => p.ref === w.P());

          const factorY = 1.32;
          const factorX = 1.37;
          // let Xadd = 30;
          // let Yadd = 200;
          // 5.340990535697877 y factor
          // 1.371002448616161 x factor
          props.push({
            page: pageIndex + 1,
            x: rectInPixels.x * factorX,
            y: rectInPixels.y * factorY,
            placeholder_id: signatureFields[i].placeholder_id,
            required: true,
            fixed_width: false,
            lock_sign_date: false,
            type: signatureFields[i].type,
          });
        });
      }
    }
    const dataToSend = {
      fileName: output,
      fileURL: fileUrl,
      placeholders: [...placeholders],
      signatureFields: props,
      documentName: output,
      recipients: recipients,
    };
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-Api-Key': process.env.SIGNWELL_API_KEY!,
      },
      body: JSON.stringify({
        draft: false,
        reminders: true,
        apply_signing_order: false,
        text_tags: false,
        allow_decline: true,
        allow_reassign: true,
        files: [
          {
            name: dataToSend.fileName,
            file_url: dataToSend.fileURL,
          },
        ],
        name: dataToSend.fileName.split('.')[0],
        placeholders: [
          ...dataToSend.placeholders,
          // { id: "rehani", name: "Rehani" },
        ],
        fields: [dataToSend.signatureFields],
      }),
    };

    const response = await fetch(
      'https://www.signwell.com/api/v1/document_templates/',
      options,
    );
    const data = await response.json();
    console.log('data', data);
    if (data.status == 'Created') {
      const template_id = data.id;
      const template_link = data.template_link;
      await new Promise((r) => setTimeout(r, 10000));
      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-Api-Key': process.env.SIGNWELL_API_KEY!,
        },
        body: JSON.stringify({
          test_mode: false,
          draft: false,
          embedded_signing: true,
          template_id: template_id,
          name: dataToSend.documentName,
          recipients: [...dataToSend.recipients],
        }),
      };

      const response = await fetch(
        'https://www.signwell.com/api/v1/document_templates/documents/',
        options,
      );
      const datas = await response.json();
      console.log('Datas', datas);
      const document_id = datas.id;
      const embedded_urls = datas.recipients;
      return {
        message: 'Successfully Created the Sign Document',
        data: {
          document_id,
          embedded_urls,
          template_id,
          template_link,
        },
      };
    } else {
      // console.log()
      throw new Error('Failed to create a sign well document');
    }
  }
}
