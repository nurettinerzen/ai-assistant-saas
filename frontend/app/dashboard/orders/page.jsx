/**
 * Trendyol Orders Page
 * View and manage orders from Trendyol marketplace
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import {
  Package,
  Search,
  RefreshCw,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';

// Order status colors
const STATUS_COLORS = {
  Created: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
  Picking: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Package },
  Invoiced: { bg: 'bg-teal-100', text: 'text-teal-800', icon: Package },
  Shipped: { bg: 'bg-teal-100', text: 'text-teal-800', icon: Truck },
  Delivered: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
  Cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  UnDelivered: { bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertCircle },
  Returned: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Package }
};

// Status text in Turkish
const STATUS_TEXT = {
  Created: 'Sipariş Oluşturuldu',
  Picking: 'Hazırlanıyor',
  Invoiced: 'Faturalandı',
  Shipped: 'Kargoya Verildi',
  Delivered: 'Teslim Edildi',
  Cancelled: 'İptal Edildi',
  UnDelivered: 'Teslim Edilemedi',
  Returned: 'İade Edildi'
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 0,
    size: 20,
    totalPages: 0,
    totalElements: 0
  });

  useEffect(() => {
    checkConnectionAndLoadOrders();
  }, []);

  useEffect(() => {
    if (connected) {
      loadOrders();
    }
  }, [statusFilter, pagination.page]);

  // Check Trendyol connection and load orders
  const checkConnectionAndLoadOrders = async () => {
    setLoading(true);
    try {
      const statusResponse = await apiClient.get('/api/trendyol/status');
      setConnected(statusResponse.data.connected);

      if (statusResponse.data.connected) {
        await loadOrders();
      }
    } catch (error) {
      console.error('Failed to check Trendyol status:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // Load orders from Trendyol
  const loadOrders = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('size', pagination.size);

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await apiClient.get(`/api/trendyol/orders?${params.toString()}`);

      setOrders(response.data.orders || []);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.totalPages || 0,
        totalElements: response.data.totalElements || 0
      }));
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Siparişler yüklenemedi');
    }
  };

  // Refresh orders
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
    toast.success('Siparişler güncellendi');
  };

  // View order details
  const handleViewOrder = async (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  // Filter orders by search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(query) ||
      order.customerFirstName?.toLowerCase().includes(query) ||
      order.lines?.some(line => line.productName?.toLowerCase().includes(query))
    );
  });

  // Get status badge
  const getStatusBadge = (status) => {
    const config = STATUS_COLORS[status] || STATUS_COLORS.Created;
    const StatusIcon = config.icon;

    return (
      <Badge className={`${config.bg} ${config.text} flex items-center gap-1`}>
        <StatusIcon className="h-3 w-3" />
        {STATUS_TEXT[status] || status}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-neutral-200 rounded animate-pulse"></div>
          <div className="h-10 w-32 bg-neutral-200 rounded animate-pulse"></div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-6 w-32 bg-neutral-200 rounded mb-4"></div>
              <div className="h-4 w-full bg-neutral-200 rounded mb-2"></div>
              <div className="h-4 w-2/3 bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Siparişler</h1>
          <p className="text-neutral-600 mt-1">Trendyol mağazanızdaki siparişleri görüntüleyin</p>
        </div>

        <EmptyState
          icon={ShoppingBag}
          title="Trendyol Bağlı Değil"
          description="Siparişlerinizi görüntülemek için önce Trendyol hesabınızı bağlayın."
          action={{
            label: 'Entegrasyonlara Git',
            href: '/dashboard/integrations'
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Siparişler</h1>
          <p className="text-neutral-600 mt-1">
            Trendyol mağazanızdaki siparişleri görüntüleyin
            {pagination.totalElements > 0 && (
              <span className="ml-2 text-sm">({pagination.totalElements} sipariş)</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Sipariş no, müşteri adı veya ürün ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Durum Filtrele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="Created">Sipariş Oluşturuldu</SelectItem>
            <SelectItem value="Picking">Hazırlanıyor</SelectItem>
            <SelectItem value="Shipped">Kargoya Verildi</SelectItem>
            <SelectItem value="Delivered">Teslim Edildi</SelectItem>
            <SelectItem value="Cancelled">İptal Edildi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sipariş Bulunamadı"
          description={searchQuery || statusFilter !== 'all'
            ? "Arama kriterlerinize uygun sipariş bulunamadı."
            : "Henüz sipariş bulunmuyor."}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.orderNumber}
              className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewOrder(order)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg text-neutral-900">
                      #{order.orderNumber}
                    </h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.orderDate || order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg text-neutral-900">
                    {formatCurrency(order.totalPrice)}
                  </p>
                  {order.customerFirstName && (
                    <p className="text-sm text-neutral-500">{order.customerFirstName}</p>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-neutral-700 mb-2">Ürünler:</p>
                <div className="space-y-2">
                  {(order.lines || []).slice(0, 3).map((line, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-neutral-600 truncate max-w-[70%]">
                        {line.productName} x{line.quantity}
                      </span>
                      <span className="text-neutral-900 font-medium">
                        {formatCurrency(line.price * line.quantity)}
                      </span>
                    </div>
                  ))}
                  {(order.lines || []).length > 3 && (
                    <p className="text-sm text-neutral-500">
                      +{order.lines.length - 3} ürün daha
                    </p>
                  )}
                </div>
              </div>

              {/* Cargo Info */}
              {order.cargoProviderName && (
                <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-neutral-600">
                  <Truck className="h-4 w-4" />
                  <span>{order.cargoProviderName}</span>
                  {order.cargoTrackingNumber && (
                    <span className="font-mono bg-neutral-100 px-2 py-0.5 rounded">
                      {order.cargoTrackingNumber}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 0}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Önceki
          </Button>
          <span className="flex items-center px-4 text-sm text-neutral-600">
            Sayfa {pagination.page + 1} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages - 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Sonraki
          </Button>
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Sipariş #{selectedOrder?.orderNumber}
              {selectedOrder && getStatusBadge(selectedOrder.status)}
            </DialogTitle>
            <DialogDescription>
              Sipariş detayları ve kargo bilgileri
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 py-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">Sipariş Tarihi</p>
                  <p className="font-medium">{formatDate(selectedOrder.orderDate || selectedOrder.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Toplam Tutar</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedOrder.totalPrice)}</p>
                </div>
              </div>

              {/* Customer Info */}
              {selectedOrder.customerFirstName && (
                <div className="bg-neutral-50 rounded-lg p-4">
                  <h4 className="font-medium text-neutral-900 mb-2">Müşteri Bilgileri</h4>
                  <p className="text-sm text-neutral-600">{selectedOrder.customerFirstName}</p>
                  {selectedOrder.shipmentAddress && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-neutral-600">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span>
                        {selectedOrder.shipmentAddress.district}, {selectedOrder.shipmentAddress.city}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Products */}
              <div>
                <h4 className="font-medium text-neutral-900 mb-3">Ürünler</h4>
                <div className="space-y-3">
                  {(selectedOrder.lines || []).map((line, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
                      <div>
                        <p className="font-medium text-neutral-900">{line.productName}</p>
                        <p className="text-sm text-neutral-500">
                          {line.barcode && `Barkod: ${line.barcode} • `}
                          Adet: {line.quantity}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(line.price * line.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cargo Info */}
              {selectedOrder.cargoProviderName && (
                <div className="bg-teal-50 rounded-lg p-4">
                  <h4 className="font-medium text-teal-900 mb-2 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Kargo Bilgileri
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-teal-700">Kargo Firması:</span> {selectedOrder.cargoProviderName}</p>
                    {selectedOrder.cargoTrackingNumber && (
                      <p>
                        <span className="text-teal-700">Takip No:</span>{' '}
                        <span className="font-mono bg-teal-100 px-2 py-0.5 rounded">
                          {selectedOrder.cargoTrackingNumber}
                        </span>
                      </p>
                    )}
                    {selectedOrder.cargoTrackingUrl && (
                      <a
                        href={selectedOrder.cargoTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800"
                      >
                        Kargo Takibi <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
