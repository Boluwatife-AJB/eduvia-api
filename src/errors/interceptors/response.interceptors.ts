import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { SuccessResponse } from '../types/error-response.interface';
import { Response } from 'express';

@Injectable()
export class ResponseInterceptors implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse> {
    const response = context.switchToHttp().getResponse<Response>();
    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((data) => {
        // If the service returned a paginated result with meta,
        // promote the meta to the top level of the envelope

        const hasMeta =
          data && typeof data === 'object' && 'meta' in data && 'data' in data;

        return {
          success: true,
          status_code: statusCode,
          data: hasMeta ? data.data : data,
          ...(hasMeta && { meta: data.meta }),
        } satisfies SuccessResponse;
      }),
    );
  }
}
