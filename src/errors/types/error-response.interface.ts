export interface SuccessResponse<T = unknown> {
  success: true;
  status_code: number;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

// TODO: Remove status_code and code in production
export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  action?: string;
  status_code: number;
  errors?: FieldError[];

  // Dev only
  stack?: string;
  detail?: string;
  path?: string;
}

export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}
