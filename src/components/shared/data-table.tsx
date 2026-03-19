"use client"

import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type OnChangeFn,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Enable global search filter */
  searchable?: boolean
  /** Placeholder for the search input */
  searchPlaceholder?: string
  /** Column ID to use for global filtering */
  searchColumn?: string
  /** Page size. Default: 20 */
  pageSize?: number
  /** Callback when a row is clicked */
  onRowClick?: (row: TData) => void
  /** Additional actions to render next to search */
  actions?: React.ReactNode
  /** Show pagination. Default: true */
  showPagination?: boolean
  /** Additional className on the table wrapper */
  className?: string
  /** Empty state message */
  emptyMessage?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = false,
  searchPlaceholder = "Search...",
  searchColumn,
  pageSize = 20,
  onRowClick,
  actions,
  showPagination = true,
  className,
  emptyMessage = "No results found.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: searchColumn ? undefined : globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters as OnChangeFn<ColumnFiltersState>,
    onGlobalFilterChange: searchColumn ? undefined : setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: { pageSize },
    },
  })

  // Handle search input — either global or column-specific
  const handleSearch = (value: string) => {
    if (searchColumn) {
      table.getColumn(searchColumn)?.setFilterValue(value)
    } else {
      setGlobalFilter(value)
    }
  }

  const searchValue = searchColumn
    ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""
    : globalFilter

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      {(searchable || actions) && (
        <div className="flex items-center justify-between gap-3">
          {searchable && (
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground transition-colors"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground/50">
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {table.getFilteredRowModel().rows.length} result{table.getFilteredRowModel().rows.length !== 1 && "s"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-muted-foreground tabular-nums">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
