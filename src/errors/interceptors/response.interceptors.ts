import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  PaginationMeta,
  SuccessResponse,
} from '../types/error-response.interface';
import { Response } from 'express';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

@Injectable()
export class ResponseInterceptors implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse> {
    const statusCode = context
      .switchToHttp()
      .getResponse<Response>().statusCode;

    return next.handle().pipe(
      map((data: unknown): SuccessResponse => {
        // let message = 'Request processed successfully';
        let bodyData: unknown = data;
        let meta: PaginationMeta | undefined;

        if (isRecord(data)) {
          const hasDataAndMeta = 'data' in data && 'meta' in data;
          const hasMessageAndData =
            typeof data.message === 'string' && 'data' in data;

          if (hasMessageAndData) {
            // message = data.message as string;
            bodyData = data['data'];
            if (hasDataAndMeta && isRecord(data.meta)) {
              meta = data.meta as unknown as PaginationMeta;
            }
          } else if (hasDataAndMeta) {
            bodyData = data['data'];
            meta = data.meta as PaginationMeta;
          }
        }

        return {
          success: true,
          status_code: statusCode,
          // message,
          data: bodyData,
          ...(meta !== undefined ? { meta } : {}),
        };
      }),
    );
  }
}
