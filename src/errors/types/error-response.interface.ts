export interface SuccessResponse<T = unknown> {
  success: true;
  status_code: number;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  status_code: number;
  code: string; // Machine-readable error code
  message: string; // Human-readable error message
  action?: string; // Action to take to resolve the error
  errors?: FieldError[]; // Validation errors

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
