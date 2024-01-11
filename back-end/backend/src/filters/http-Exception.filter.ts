import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class CustomExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.log("waaaaaaaaaaaaakaaaaaaaaawaaaaaakkkkkkkkkkkkkkkkkk");
    console.log("waaaaaaaaaaaaakaaaaaaaaawaaaaaakkkkkkkkkkkkkkkkkk");
    console.log("waaaaaaaaaaaaakaaaaaaaaawaaaaaakkkkkkkkkkkkkkkkkk");
    console.log("waaaaaaaaaaaaakaaaaaaaaawaaaaaakkkkkkkkkkkkkkkkkk");
    console.log("waaaaaaaaaaaaakaaaaaaaaawaaaaaakkkkkkkkkkkkkkkkkk");
    console.log("waaaaaaaaaaaaakaaaaaaaaawaaaaaakkkkkkkkkkkkkkkkkk");
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    let status = HttpStatus.BAD_REQUEST;
    let message = 'Bad Request';
    let errors = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (status === HttpStatus.INTERNAL_SERVER_ERROR)
        status = HttpStatus.BAD_REQUEST;
      const responseObj = exception.getResponse();
      message = responseObj['message'] || responseObj || null;
      errors = responseObj['errors'] || null;
    }
    response.status(status).json({
      statusCode: status,
      message: message,
      errors: errors,
    });
  }
}
