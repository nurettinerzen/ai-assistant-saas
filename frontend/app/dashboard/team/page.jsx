'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { usePermissions, getRoleDisplayName, getRoleBadgeColor } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  MoreVertical,
  Trash2,
  RefreshCw,
  Shield,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export default function TeamPage() {
  const { can, isOwner, user } = usePermissions();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'STAFF' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        apiClient.team.getMembers(),
        can('team:invite') ? apiClient.team.getInvitations() : Promise.resolve({ data: { invitations: [] } }),
      ]);

      setMembers(membersRes.data.members || []);
      setInvitations(invitationsRes.data.invitations || []);
    } catch (error) {
      console.error('Failed to load team data:', error);
      toast.error('Ekip verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email) {
      toast.error('Email adresi gerekli');
      return;
    }

    setInviting(true);
    try {
      await apiClient.team.sendInvite(inviteForm);
      toast.success('Davet gönderildi');
      setInviteModalOpen(false);
      setInviteForm({ email: '', role: 'STAFF' });
      loadData();
    } catch (error) {
      const message = error.response?.data?.error || 'Davet gönderilemedi';
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await apiClient.team.updateRole(userId, newRole);
      toast.success('Rol güncellendi');
      loadData();
    } catch (error) {
      const message = error.response?.data?.error || 'Rol güncellenemedi';
      toast.error(message);
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    if (!confirm(`${memberName || 'Bu kullanıcıyı'} ekipten çıkarmak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await apiClient.team.removeMember(userId);
      toast.success('Kullanıcı ekipten çıkarıldı');
      loadData();
    } catch (error) {
      const message = error.response?.data?.error || 'Kullanıcı ekipten çıkarılamadı';
      toast.error(message);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      await apiClient.team.cancelInvite(inviteId);
      toast.success('Davet iptal edildi');
      loadData();
    } catch (error) {
      toast.error('Davet iptal edilemedi');
    }
  };

  const handleResendInvite = async (inviteId) => {
    try {
      await apiClient.team.resendInvite(inviteId);
      toast.success('Davet yeniden gönderildi');
      loadData();
    } catch (error) {
      toast.error('Davet yeniden gönderilemedi');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!can('team:view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle className="h-16 w-16 text-neutral-300 mb-4" />
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">Erişim Engellendi</h2>
        <p className="text-neutral-500">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Ekip Yönetimi</h1>
          <p className="text-neutral-600 mt-1">Ekip üyelerinizi yönetin ve yeni davetler gönderin</p>
        </div>
        {can('team:invite') && (
          <Button onClick={() => setInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Davet Gönder
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Users className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Toplam Üye</p>
                <p className="text-2xl font-bold">{members.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Bekleyen Davet</p>
                <p className="text-2xl font-bold">{invitations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Senin Rolün</p>
                <p className="text-2xl font-bold">{getRoleDisplayName(user?.role)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Ekip Üyeleri ({members.length})</TabsTrigger>
          {can('team:invite') && (
            <TabsTrigger value="invitations">
              Bekleyen Davetler ({invitations.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Ekip Üyeleri</CardTitle>
              <CardDescription>
                İşletmenize erişimi olan tüm kullanıcılar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  Henüz ekip üyesi yok
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Katılma Tarihi</TableHead>
                      <TableHead>Davet Eden</TableHead>
                      {isOwner && <TableHead className="text-right">İşlemler</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-700 font-semibold">
                                {(member.name || member.email)[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{member.name || 'İsimsiz'}</p>
                              <p className="text-sm text-neutral-500">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isOwner && member.role !== 'OWNER' && member.id !== user?.id ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) => handleRoleChange(member.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MANAGER">Yönetici</SelectItem>
                                <SelectItem value="STAFF">Personel</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getRoleBadgeColor(member.role)}>
                              {getRoleDisplayName(member.role)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(member.acceptedAt || member.createdAt)}</TableCell>
                        <TableCell>
                          {member.invitedBy ? (
                            <span className="text-sm text-neutral-600">
                              {member.invitedBy.name || member.invitedBy.email}
                            </span>
                          ) : (
                            <span className="text-sm text-neutral-400">-</span>
                          )}
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            {member.role !== 'OWNER' && member.id !== user?.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleRemoveMember(member.id, member.name)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Ekipten Çıkar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        {can('team:invite') && (
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Bekleyen Davetler</CardTitle>
                <CardDescription>
                  Henüz kabul edilmemiş davetler
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">
                    Bekleyen davet yok
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Gönderilme Tarihi</TableHead>
                        <TableHead>Son Geçerlilik</TableHead>
                        <TableHead>Davet Eden</TableHead>
                        <TableHead className="text-right">İşlemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-neutral-400" />
                              {invite.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(invite.role)}>
                              {getRoleDisplayName(invite.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(invite.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-neutral-400" />
                              {formatDate(invite.expiresAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {invite.invitedBy?.name || invite.invitedBy?.email || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(invite.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => handleCancelInvite(invite.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ekibe Davet Gönder</DialogTitle>
            <DialogDescription>
              Yeni bir ekip üyesi davet edin. Davet linki email adresine gönderilecek.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Adresi</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGER">
                      <div className="flex flex-col">
                        <span>Yönetici</span>
                        <span className="text-xs text-neutral-500">
                          Asistan oluşturma, kampanya yönetimi, ekip daveti
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="STAFF">
                      <div className="flex flex-col">
                        <span>Personel</span>
                        <span className="text-xs text-neutral-500">
                          Sadece görüntüleme ve temel işlemler
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Davet Gönder
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
