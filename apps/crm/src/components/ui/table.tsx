import * as React from "react";

import { cn } from "@/lib/utils";

type ResponsiveTableContextValue = {
  page: number;
  pageSize: number;
  totalRows: number;
  setTotalRows: (total: number) => void;
  setPage: (page: number) => void;
};

const ResponsiveTableContext = React.createContext<ResponsiveTableContextValue | null>(null);

function getResponsivePageSize() {
  if (typeof window === "undefined") return 10;
  if (window.innerWidth < 640) return 5;
  if (window.innerWidth < 1024) return 8;
  return 10;
}

function useResponsivePageSize() {
  const [pageSize, setPageSize] = React.useState(getResponsivePageSize);

  React.useEffect(() => {
    const update = () => setPageSize(getResponsivePageSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return pageSize;
}

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, children, ...props }, ref) => {
    const pageSize = useResponsivePageSize();
    const [page, setPage] = React.useState(1);
    const [totalRows, setTotalRows] = React.useState(0);
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

    React.useEffect(() => {
      setPage(1);
    }, [pageSize]);

    React.useEffect(() => {
      setPage((current) => Math.min(current, pageCount));
    }, [pageCount]);

    const contextValue = React.useMemo(
      () => ({
        page,
        pageSize,
        totalRows,
        setTotalRows,
        setPage,
      }),
      [page, pageSize, totalRows],
    );

    return (
      <ResponsiveTableContext.Provider value={contextValue}>
        <div className="relative w-full overflow-auto">
          <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props}>
            {children}
          </table>

          {totalRows > pageSize && (
            <div className="flex flex-col gap-2 border-t bg-muted/30 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                {totalRows} ligne{totalRows > 1 ? "s" : ""} · {pageSize} par page
              </span>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <button
                  type="button"
                  className="rounded-md border bg-background px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="Page précédente"
                >
                  Précédent
                </button>
                <span className="min-w-20 text-center font-medium">
                  {page} / {pageCount}
                </span>
                <button
                  type="button"
                  className="rounded-md border bg-background px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  aria-label="Page suivante"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </ResponsiveTableContext.Provider>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(ResponsiveTableContext);
    const rows = React.Children.toArray(children);
    const totalRows = rows.length;

    React.useEffect(() => {
      context?.setTotalRows(totalRows);
    }, [context, totalRows]);

    const start = context ? (context.page - 1) * context.pageSize : 0;
    const visibleRows = context ? rows.slice(start, start + context.pageSize) : rows;

    return (
      <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props}>
        {visibleRows}
      </tbody>
    );
  },
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
