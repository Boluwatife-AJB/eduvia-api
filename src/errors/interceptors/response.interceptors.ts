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

/** Ensures pagination meta is always snake_case (handles camelCase from any source). */
function normalizePaginationMeta(raw: unknown): PaginationMeta | undefined {
  if (!isRecord(raw)) return undefined;
  const total = raw['total'];
  if (typeof total !== 'number' || !Number.isFinite(total)) return undefined;

  const page =
    typeof raw['page'] === 'number' && Number.isFinite(raw['page'])
      ? raw['page']
      : 1;
  const limit =
    typeof raw['limit'] === 'number' && Number.isFinite(raw['limit'])
      ? raw['limit']
      : 20;

  const totalPagesRaw = raw['total_pages'] ?? raw['totalPages'];
  const total_pages =
    typeof totalPagesRaw === 'number' && Number.isFinite(totalPagesRaw)
      ? totalPagesRaw
      : Math.ceil(total / limit) || 0;

  const hasNextRaw = raw['has_next_page'] ?? raw['hasNextPage'];
  const has_next_page =
    typeof hasNextRaw === 'boolean'
      ? hasNextRaw
      : page < (Math.ceil(total / limit) || 1);

  const hasPrevRaw = raw['has_previous_page'] ?? raw['hasPreviousPage'];
  const has_previous_page =
    typeof hasPrevRaw === 'boolean' ? hasPrevRaw : page > 1;

  return {
    total,
    page,
    limit,
    total_pages,
    has_next_page,
    has_previous_page,
  };
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
            if (hasDataAndMeta) {
              meta = normalizePaginationMeta(data['meta']);
            }
          } else if (hasDataAndMeta) {
            bodyData = data['data'];
            meta = normalizePaginationMeta(data['meta']);
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
