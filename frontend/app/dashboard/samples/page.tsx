"use client";

/**
 * Sample Request List Page
 * Phase 3-1: Sample Request System MVP
 *
 * Displays:
 * - List of all SampleRequests (TanStack Table)
 * - Create new SampleRequest button
 * - Filter by status, brand
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { useSampleRequests, useCreateSampleRequest } from '@/lib/hooks/useSamples';
import type {
  SampleRequest,
  CreateSampleRequestPayload,
  SampleRequestStatus,
} from '@/types/samples';
import {
  SampleRequestTypeLabels,
  SampleRequestStatusLabels,
  PriorityLabels,
} from '@/types/samples';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, ArrowUpDown, Search, Columns3 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// Fetch StyleRevisions for the dropdown (not parsing.Revision!)
interface StyleRevisionOption {
  id: string;
  revision_label: string;
  style_number: string | null;
  style_name: string | null;
  status: string;
}

function useStyleRevisions() {
  return useQuery({
    queryKey: ['style-revisions-list'],
    queryFn: async () => {
      const response = await apiClient<{ results: StyleRevisionOption[] }>('/style-revisions/');
      return response.results;
    },
  });
}

export default function SampleRequestListPage() {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleRequestStatus | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch sample requests (server-side search + status filter)
  const { data: requests = [], isLoading, error } = useSampleRequests({
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  });

  const createMutation = useCreateSampleRequest();

  // Table columns
  const columns = useMemo<ColumnDef<SampleRequest>[]>(() => [
    {
      accessorKey: 'style_number',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Style
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.original.style_number || row.original.brand_name || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'request_type',
      header: 'Type',
      cell: ({ row }) => (
        <div>
          {SampleRequestTypeLabels[row.original.request_type] || row.original.request_type}
        </div>
      ),
    },
    {
      accessorKey: 'quantity_requested',
      header: 'Qty',
      cell: ({ row }) => <div className="text-center">{row.original.quantity_requested}</div>,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.original.priority;
        return (
          <Badge
            variant={
              priority === 'urgent' ? 'destructive' : priority === 'normal' ? 'default' : 'secondary'
            }
          >
            {PriorityLabels[priority]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={
              status === 'open'
                ? 'default'
                : status === 'closed'
                  ? 'secondary'
                  : status === 'cancelled'
                    ? 'destructive'
                    : 'outline'
            }
          >
            {SampleRequestStatusLabels[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'due_date',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Due Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div>{row.original.due_date ? format(new Date(row.original.due_date), 'MMM dd, yyyy') : '-'}</div>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div>{format(new Date(row.original.created_at), 'MMM dd, yyyy')}</div>
      ),
    },
  ], []);

  const table = useReactTable({
    data: requests,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Handle row click
  const handleRowClick = (requestId: string) => {
    router.push(`/dashboard/samples/${requestId}`);
  };

  // Handle create request
  const handleCreateRequest = async (payload: CreateSampleRequestPayload) => {
    try {
      const newRequest = await createMutation.mutateAsync(payload);
      setIsCreateDialogOpen(false);
      router.push(`/dashboard/samples/${newRequest.id}`);
    } catch (err) {
      console.error('Failed to create sample request:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-muted-foreground">Loading sample requests...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load sample requests
          </h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sample Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage sample requests across all brands and revisions
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/samples/kanban')}
          >
            <Columns3 className="mr-2 h-4 w-4" />
            View Kanban
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by style or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as SampleRequestStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-sm font-medium">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                    No sample requests found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row.original.id)}
                    className="border-t cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <CreateSampleRequestDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateRequest}
        isCreating={createMutation.isPending}
      />
    </div>
  );
}

// ========================================
// Create Sample Request Dialog
// ========================================

interface CreateSampleRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: CreateSampleRequestPayload) => void;
  isCreating: boolean;
}

function CreateSampleRequestDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: CreateSampleRequestDialogProps) {
  const { data: revisions = [], isLoading: revisionsLoading } = useStyleRevisions();
  const [formData, setFormData] = useState<CreateSampleRequestPayload>({
    revision: '',
    brand_name: '',
    request_type: 'proto',
    quantity_requested: 1,
    priority: 'normal',
    need_quote_first: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.revision) {
      alert('Please select a revision');
      return;
    }
    onCreate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sample Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Revision (Tech Pack)</label>
            {revisionsLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading revisions...
              </div>
            ) : (
              <Select
                value={formData.revision}
                onValueChange={(value) => setFormData({ ...formData, revision: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a style revision..." />
                </SelectTrigger>
                <SelectContent>
                  {revisions.map((rev) => (
                    <SelectItem key={rev.id} value={rev.id}>
                      {rev.style_number} - {rev.style_name} ({rev.revision_label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Brand Name</label>
            <Input
              placeholder="e.g., Nike, Adidas"
              value={formData.brand_name}
              onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Request Type</label>
            <Select
              value={formData.request_type}
              onValueChange={(value) =>
                setFormData({ ...formData, request_type: value as any })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proto">Proto Sample</SelectItem>
                <SelectItem value="fit">Fit Sample</SelectItem>
                <SelectItem value="sales">Sales Sample</SelectItem>
                <SelectItem value="photo">Photo Sample</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Quantity</label>
            <Input
              type="number"
              min="1"
              value={formData.quantity_requested}
              onChange={(e) =>
                setFormData({ ...formData, quantity_requested: parseInt(e.target.value) })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Priority</label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
