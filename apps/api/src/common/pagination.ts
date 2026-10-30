export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePage(page?: string, pageSize?: string): PageParams {
  const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
  return { page: p, pageSize: ps, skip: (p - 1) * ps, take: ps };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(items: T[], total: number, params: PageParams): Paginated<T> {
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize) || 1,
  };
}
