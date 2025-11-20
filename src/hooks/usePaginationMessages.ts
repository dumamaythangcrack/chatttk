import { useState, useCallback } from "react";

export const usePaginationMessages = (pageSize: number = 30) => {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<any[]>([]);

  const paginate = useCallback((allItems: any[]) => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return allItems.slice(start, end);
  }, [page, pageSize]);

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);

  return { page, items, setItems, paginate, nextPage, prevPage };
};
