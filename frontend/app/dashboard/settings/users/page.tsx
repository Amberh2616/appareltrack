'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listUsers,
  inviteUser,
  updateUser,
  activateUser,
  deactivateUser,
  getUserStats,
  getRoles,
  User,
} from '@/lib/api/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  merchandiser: 'bg-blue-100 text-blue-800',
  factory: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('merchandiser');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');

  // Queries
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, roleFilter, statusFilter],
    queryFn: () => listUsers({
      search: search || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: getUserStats,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      toast.success(`Invitation sent to ${data.user.email}`);
      setIsInviteOpen(false);
      resetInviteForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      setIsEditOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      toast.success('User activated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      toast.success('User deactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole('merchandiser');
    setInviteFirstName('');
    setInviteLastName('');
  };

  const handleInvite = () => {
    inviteMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
      first_name: inviteFirstName,
      last_name: inviteLastName,
    });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    updateMutation.mutate({
      id: selectedUser.id,
      data: {
        email: selectedUser.email,
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        role: selectedUser.role,
      },
    });
  };

  const roles = rolesData?.roles || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-slate-500">Manage users and their permissions</p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Inactive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-400">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.by_role.admin || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <Users className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {user.first_name || user.last_name
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : user.username}
                        </div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[user.role] || 'bg-gray-100'}>
                      {user.role_display}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Shield className="mr-2 h-4 w-4" />
                          Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.is_active ? (
                          <DropdownMenuItem
                            onClick={() => deactivateMutation.mutate(user.id)}
                            className="text-red-600"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => activateMutation.mutate(user.id)}
                            className="text-green-600"
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new user to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={selectedUser.first_name}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={selectedUser.last_name}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, last_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value) =>
                    setSelectedUser({ ...selectedUser, role: value as User['role'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
