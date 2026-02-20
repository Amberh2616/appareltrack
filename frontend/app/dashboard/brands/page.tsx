'use client';

/**
 * Brand Management Page - v2.3.0
 * Manage brands with BOM format configuration
 */

import { useState } from 'react';
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from '@/lib/hooks/useBrands';
import { Brand, BrandCreate, BomFormat, BOM_FORMAT_OPTIONS } from '@/lib/types/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Pencil, Trash2, Tag } from 'lucide-react';

export default function BrandsPage() {
  const { data: brands, isLoading, error } = useBrands();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  // Form state
  const [formData, setFormData] = useState<BrandCreate>({
    code: '',
    name: '',
    bom_format: 'auto',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      bom_format: 'auto',
      notes: '',
    });
  };

  const handleCreate = async () => {
    try {
      await createBrand.mutateAsync(formData);
      toast.success('Brand created successfully');
      setIsCreateOpen(false);
      resetForm();
    } catch (err) {
      toast.error('Failed to create brand');
    }
  };

  const handleEdit = (brand: Brand) => {
    setSelectedBrand(brand);
    setFormData({
      code: brand.code,
      name: brand.name,
      bom_format: brand.bom_format,
      notes: brand.notes,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedBrand) return;
    try {
      await updateBrand.mutateAsync({
        id: selectedBrand.id,
        data: formData,
      });
      toast.success('Brand updated successfully');
      setIsEditOpen(false);
      setSelectedBrand(null);
      resetForm();
    } catch (err) {
      toast.error('Failed to update brand');
    }
  };

  const handleDelete = async () => {
    if (!selectedBrand) return;
    try {
      await deleteBrand.mutateAsync(selectedBrand.id);
      toast.success('Brand deleted successfully');
      setIsDeleteOpen(false);
      setSelectedBrand(null);
    } catch (err) {
      toast.error('Failed to delete brand');
    }
  };

  const getFormatLabel = (format: BomFormat) => {
    const option = BOM_FORMAT_OPTIONS.find((o) => o.value === format);
    return option?.label || format;
  };

  const getFormatBadgeColor = (format: BomFormat) => {
    switch (format) {
      case 'vertical_table':
        return 'bg-blue-100 text-blue-800';
      case 'horizontal_table':
        return 'bg-purple-100 text-purple-800';
      case 'free_text':
        return 'bg-green-100 text-green-800';
      case 'mixed':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">Failed to load brands</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage brands and their BOM extraction format configurations
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Brand
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold">{brands?.length || 0}</div>
          <div className="text-sm text-gray-500">Total Brands</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold">
            {brands?.filter((b) => b.bom_format === 'vertical_table').length || 0}
          </div>
          <div className="text-sm text-gray-500">Vertical Table</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold">
            {brands?.filter((b) => b.bom_format === 'horizontal_table').length || 0}
          </div>
          <div className="text-sm text-gray-500">Horizontal Table</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold">
            {brands?.reduce((sum, b) => sum + b.styles_count, 0) || 0}
          </div>
          <div className="text-sm text-gray-500">Total Styles</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>BOM Format</TableHead>
              <TableHead>Styles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No brands yet. Click "Add Brand" to create one.
                </TableCell>
              </TableRow>
            ) : (
              brands?.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-gray-400" />
                      <span className="font-mono font-medium">{brand.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>{brand.name}</TableCell>
                  <TableCell>
                    <Badge className={getFormatBadgeColor(brand.bom_format)}>
                      {getFormatLabel(brand.bom_format)}
                    </Badge>
                  </TableCell>
                  <TableCell>{brand.styles_count}</TableCell>
                  <TableCell>
                    {brand.is_active ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-500">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(brand)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            setSelectedBrand(brand);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Brand</DialogTitle>
            <DialogDescription>
              Create a new brand with BOM extraction format configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Brand Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., LLL, NIKE"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Brand Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., lululemon athletica"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom_format">BOM Format</Label>
              <Select
                value={formData.bom_format}
                onValueChange={(value: BomFormat) =>
                  setFormData({ ...formData, bom_format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {BOM_FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes about this brand's tech pack format..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.code || !formData.name || createBrand.isPending}
            >
              {createBrand.isPending ? 'Creating...' : 'Create Brand'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
            <DialogDescription>
              Update brand configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Brand Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Brand Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bom_format">BOM Format</Label>
              <Select
                value={formData.bom_format}
                onValueChange={(value: BomFormat) =>
                  setFormData({ ...formData, bom_format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOM_FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateBrand.isPending}>
              {updateBrand.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Brand</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedBrand?.name}"? This action cannot be
              undone.
              {selectedBrand && selectedBrand.styles_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This brand has {selectedBrand.styles_count} associated styles.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBrand.isPending}
            >
              {deleteBrand.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
