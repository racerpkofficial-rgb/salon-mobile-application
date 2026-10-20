import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  adminService,
  AdminDashboardData,
  AdminOffer,
  PlanWithStats
} from '../services/admin.service';
import { dialogService } from '../services/dialog.service';
import { SalonOwnerData, SupportTicket, TicketStatus } from '../types';
import { formatCoordinates } from '../utils/location';

type AdminTab =
  | 'OVERVIEW'
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'PLANS'
  | 'PAYMENTS'
  | 'CUSTOMERS'
  | 'OFFERS'
  | 'TICKETS';

export function AdminDashboardScreen() {
  const { user, token, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [tab, setTab] = useState<AdminTab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Data states
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [pendingSalons, setPendingSalons] = useState<SalonOwnerData[]>([]);
  const [activeSalons, setActiveSalons] = useState<SalonOwnerData[]>([]);
  const [suspendedSalons, setSuspendedSalons] = useState<SalonOwnerData[]>([]);
  const [plans, setPlans] = useState<PlanWithStats[]>([]);
  const [payments, setPayments] = useState<{ totalVolume: number; count: number; data: any[] } | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [offers, setOffers] = useState<AdminOffer[]>([]);

  // Support Tickets states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketStats, setTicketStats] = useState<{ total: number; open: number; inProgress: number; resolved: number; closed: number }>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  });
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);

  // Ticket Details & Status Update Modal states
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketStatusSelection, setTicketStatusSelection] = useState<TicketStatus>('OPEN');
  const [ticketAdminNotes, setTicketAdminNotes] = useState('');
  const [updatingTicketStatus, setUpdatingTicketStatus] = useState(false);

  // Modals
  const [selectedSalon, setSelectedSalon] = useState<SalonOwnerData | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [createOfferVisible, setCreateOfferVisible] = useState(false);
  const [newOffer, setNewOffer] = useState({
    title: '',
    code: '',
    discountPercent: '20',
    description: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [dash, pend, act, susp, pln, pay, cust, off, tck] = await Promise.all([
        adminService.getDashboard(token).catch(() => null),
        adminService.getPendingSalons(token).catch(() => ({ data: [] })),
        adminService.getActiveSalons(token).catch(() => ({ data: [] })),
        adminService.getSuspendedSalons(token).catch(() => ({ data: [] })),
        adminService.getSubscriptionPlans(token).catch(() => ({ data: [] })),
        adminService.getPayments(token).catch(() => null),
        adminService.getCustomers(token).catch(() => ({ count: 0, data: [] })),
        adminService.getOffers(token).catch(() => ({ data: [] })),
        adminService.getSupportTickets(token, { status: 'ALL', page: 1, limit: 30 }).catch(() => null)
      ]);

      if (dash) setDashboard(dash);
      setPendingSalons(pend.data || []);
      setActiveSalons(act.data || []);
      setSuspendedSalons(susp.data || []);
      setPlans(pln.data || []);
      if (pay) setPayments(pay);
      setCustomers(cust.data || []);
      setOffers(off.data || []);
      if (tck) {
        setTickets(tck.tickets || []);
        if (tck.stats) setTicketStats(tck.stats);
        setTicketTotalPages(tck.totalPages || 1);
      }
    } catch {
      // quiet
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async (page = 1, status = ticketStatusFilter, search = ticketSearch) => {
    if (!token) return;
    setTicketsLoading(true);
    try {
      const res = await adminService.getSupportTickets(token, {
        page,
        limit: 30,
        status: status === 'ALL' ? undefined : status,
        search: search.trim() || undefined
      });
      setTickets(res.tickets || []);
      if (res.stats) setTicketStats(res.stats);
      setTicketPage(res.page || 1);
      setTicketTotalPages(res.totalPages || 1);
    } catch {
      // quiet
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleOpenTicket = (t: SupportTicket) => {
    setSelectedTicket(t);
    setTicketStatusSelection(t.status);
    setTicketAdminNotes(t.adminNotes || '');
  };

  const handleUpdateTicketStatus = async () => {
    if (!token || !selectedTicket) return;
    setUpdatingTicketStatus(true);
    try {
      const res = await adminService.updateTicketStatus(token, selectedTicket.ticketId, {
        status: ticketStatusSelection,
        adminNotes: ticketAdminNotes.trim() || undefined
      });
      dialogService.showSuccess('Status Updated', `Ticket ${selectedTicket.ticketId} is now marked as ${ticketStatusSelection}.`);
      setSelectedTicket(res.ticket);
      // Refresh list & dashboard stats
      await fetchTickets(ticketPage, ticketStatusFilter, ticketSearch);
      const dash = await adminService.getDashboard(token).catch(() => null);
      if (dash) setDashboard(dash);
    } catch (e) {
      dialogService.showError('Update Failed', e instanceof Error ? e.message : 'Could not update ticket status.');
    } finally {
      setUpdatingTicketStatus(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTicket) {
        setSelectedTicket(null);
        return true;
      }
      if (selectedSalon) {
        setSelectedSalon(null);
        return true;
      }
      if (rejectModalVisible) {
        setRejectModalVisible(false);
        return true;
      }
      if (createOfferVisible) {
        setCreateOfferVisible(false);
        return true;
      }
      if (tab !== 'OVERVIEW') {
        setTab('OVERVIEW');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectedTicket, selectedSalon, rejectModalVisible, createOfferVisible, tab]);

  // Actions
  const handleApprove = async (salonId: string, salonName: string) => {
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      await adminService.approveSalon(token, salonId);
      dialogService.showSuccess('Salon Approved! 🎉', `"${salonName}" is now ACTIVE and discoverable by all customers.`);
      setSelectedSalon(null);
      await loadData();
    } catch (e) {
      dialogService.showError('Approval Error', e instanceof Error ? e.message : 'Failed to approve salon');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!token || !selectedSalon?._id || actionLoading) return;
    const trimmedReason = rejectReason.trim();
    if (!trimmedReason) {
      setRejectError('A rejection reason is required before rejecting.');
      dialogService.showError('Validation Error', 'Please provide a reason explaining why the application is rejected.');
      return;
    }

    setActionLoading(true);
    setRejectError(null);
    try {
      await adminService.rejectSalon(token, selectedSalon._id, trimmedReason);
      dialogService.showSuccess('Salon Rejected', `"${selectedSalon.salonName}" has been rejected with notice to the owner.`);
      setRejectModalVisible(false);
      setSelectedSalon(null);
      setRejectReason('');
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reject salon';
      setRejectError(msg);
      dialogService.showError('Rejection Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (salonId: string, salonName: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      await adminService.suspendSalon(token, salonId);
      dialogService.showSuccess('Salon Suspended', `"${salonName}" has been removed from customer discovery.`);
      setSelectedSalon(null);
      await loadData();
    } catch (e) {
      dialogService.showError('Suspension Error', e instanceof Error ? e.message : 'Failed to suspend salon');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (salonId: string, salonName: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      await adminService.reactivateSalon(token, salonId);
      dialogService.showSuccess('Salon Reactivated', `"${salonName}" is now ACTIVE and discoverable again.`);
      setSelectedSalon(null);
      await loadData();
    } catch (e) {
      dialogService.showError('Reactivation Error', e instanceof Error ? e.message : 'Failed to reactivate salon');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleOffer = async (id: string) => {
    if (!token) return;
    try {
      await adminService.toggleOffer(token, id);
      await loadData();
    } catch (e) {
      dialogService.showError('Error', e instanceof Error ? e.message : 'Failed to toggle offer');
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!token) return;
    try {
      await adminService.deleteOffer(token, id);
      dialogService.showSuccess('Offer Deleted', 'The promotional offer has been removed.');
      await loadData();
    } catch (e) {
      dialogService.showError('Error', e instanceof Error ? e.message : 'Failed to delete offer');
    }
  };

  const handleCreateOffer = async () => {
    if (!token) return;
    if (!newOffer.title.trim() || !newOffer.code.trim() || !newOffer.description.trim()) {
      dialogService.showError('Validation Error', 'Please fill in all offer details.');
      return;
    }
    setActionLoading(true);
    try {
      await adminService.createOffer(token, {
        title: newOffer.title.trim(),
        code: newOffer.code.trim().toUpperCase(),
        discountPercent: parseInt(newOffer.discountPercent, 10) || 20,
        description: newOffer.description.trim(),
        validUntil: newOffer.validUntil
      });
      dialogService.showSuccess('Offer Created', `Promo code ${newOffer.code.toUpperCase()} is now live.`);
      setCreateOfferVisible(false);
      setNewOffer({
        title: '',
        code: '',
        discountPercent: '20',
        description: '',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 1000).toISOString().split('T')[0]
      });
      await loadData();
    } catch (e) {
      dialogService.showError('Creation Failed', e instanceof Error ? e.message : 'Could not create offer');
    } finally {
      setActionLoading(false);
    }
  };

  const tabs: { key: AdminTab; label: string; badge?: number }[] = [
    { key: 'OVERVIEW', label: 'Dashboard' },
    { key: 'PENDING', label: 'Pending Salons', badge: pendingSalons.length },
    { key: 'ACTIVE', label: 'Active Salons', badge: activeSalons.length },
    { key: 'SUSPENDED', label: 'Suspended Salons', badge: suspendedSalons.length },
    { key: 'PLANS', label: 'Plans & Revenue' },
    { key: 'PAYMENTS', label: 'Payments' },
    { key: 'CUSTOMERS', label: 'Customers', badge: customers.length },
    { key: 'OFFERS', label: 'Offers & Promos' },
    { key: 'TICKETS', label: 'Support Tickets', badge: ticketStats.open }
  ];

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <View>
          <View style={s.brandBadge}>
            <Text style={s.brandBadgeText}>👑 SUPER ADMIN PORTAL</Text>
          </View>
          <Text style={s.headerTitle}>Book My Salon Management</Text>
          <Text style={s.headerEmail}>Signed in: {user?.email}</Text>
        </View>
        <Pressable onPress={() => setShowLogoutModal(true)} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign out</Text>
        </Pressable>
      </View>

      {/* Luxury Logout Confirmation Modal */}
      <LogoutConfirmModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          setShowLogoutModal(false);
          await logout();
        }}
      />

      {/* Navigation Pills Bar */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {tabs.map((t) => {
            const isActive = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[s.tabItem, isActive && s.tabItemActive]}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>{t.label}</Text>
                {typeof t.badge === 'number' && t.badge > 0 && (
                  <View style={[s.tabBadge, isActive && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeText, isActive && s.tabBadgeTextActive]}>{t.badge}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={s.loadingText}>Loading admin telemetry...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {tab === 'OVERVIEW' && (
            <View>
              {/* 4-Grid Key Metrics */}
              <View style={s.metricsGrid}>
                <Pressable
                  style={[s.metricCard, s.metricCardWarning]}
                  onPress={() => setTab('PENDING')}
                >
                  <Text style={s.metricIcon}>⏳</Text>
                  <Text style={s.metricNumber}>{dashboard?.stats?.pendingSalons ?? pendingSalons.length}</Text>
                  <Text style={s.metricLabel}>Pending Reviews</Text>
                  <Text style={s.metricAction}>Review Queue →</Text>
                </Pressable>

                <Pressable
                  style={[s.metricCard, s.metricCardSuccess]}
                  onPress={() => setTab('ACTIVE')}
                >
                  <Text style={s.metricIcon}>✓</Text>
                  <Text style={s.metricNumber}>{dashboard?.stats?.activeSalons ?? activeSalons.length}</Text>
                  <Text style={s.metricLabel}>Active Salons</Text>
                  <Text style={s.metricAction}>View Catalogue →</Text>
                </Pressable>

                <Pressable
                  style={s.metricCard}
                  onPress={() => setTab('CUSTOMERS')}
                >
                  <Text style={s.metricIcon}>👥</Text>
                  <Text style={s.metricNumber}>{dashboard?.stats?.totalCustomers ?? customers.length}</Text>
                  <Text style={s.metricLabel}>Registered Customers</Text>
                  <Text style={s.metricAction}>View Users →</Text>
                </Pressable>

                <Pressable
                  style={s.metricCard}
                  onPress={() => setTab('PAYMENTS')}
                >
                  <Text style={s.metricIcon}>💳</Text>
                  <Text style={s.metricNumber}>{dashboard?.stats?.activeSubscriptions ?? 0}</Text>
                  <Text style={s.metricLabel}>Active Subscriptions</Text>
                  <Text style={s.metricAction}>View Ledger →</Text>
                </Pressable>

                <Pressable
                  style={[s.metricCard, ticketStats.open > 0 ? s.metricCardWarning : null]}
                  onPress={() => setTab('TICKETS')}
                >
                  <Text style={s.metricIcon}>🎫</Text>
                  <Text style={s.metricNumber}>{ticketStats.open}</Text>
                  <Text style={s.metricLabel}>Open Support Tickets</Text>
                  <Text style={s.metricAction}>Manage Queue →</Text>
                </Pressable>
              </View>

              {/* Support Tickets Alert */}
              {ticketStats.open > 0 && (
                <View style={[s.quickAlert, { borderColor: '#EAB308', backgroundColor: 'rgba(234, 179, 8, 0.08)' }]}>
                  <Text style={[s.quickAlertTitle, { color: '#CA8A04' }]}>🎫 {ticketStats.open} Support Ticket(s) Awaiting Resolution</Text>
                  <Text style={s.quickAlertBody}>
                    Customers or salon owners have filed support tickets. Inspect the queue and update status.
                  </Text>
                  <Pressable onPress={() => setTab('TICKETS')} style={[s.quickAlertBtn, { backgroundColor: '#CA8A04' }]}>
                    <Text style={s.quickAlertBtnText}>Go to Support Tickets →</Text>
                  </Pressable>
                </View>
              )}

              {/* Pending Approvals Quick Alert */}
              {pendingSalons.length > 0 && (
                <View style={s.quickAlert}>
                  <Text style={s.quickAlertTitle}>🚨 {pendingSalons.length} Salon(s) Awaiting Compliance Review</Text>
                  <Text style={s.quickAlertBody}>
                    These salons have submitted details and payment. They will remain invisible to customers until you approve them.
                  </Text>
                  <Pressable onPress={() => setTab('PENDING')} style={s.quickAlertBtn}>
                    <Text style={s.quickAlertBtnText}>Go to Pending Queue →</Text>
                  </Pressable>
                </View>
              )}

              {/* Recent Registrations Section */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>RECENT SALON REGISTRATIONS</Text>
                <View style={s.cardList}>
                  {dashboard?.recentRegistrations?.salons?.map((sItem) => (
                    <Pressable
                      key={sItem._id}
                      onPress={() => setSelectedSalon(sItem)}
                      style={s.listItem}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{sItem.salonName}</Text>
                        <Text style={s.itemSub}>{sItem.city} • {sItem.phone}</Text>
                      </View>
                      <View
                        style={[
                          s.statusTag,
                          sItem.status === 'PENDING_APPROVAL'
                            ? s.statusTagWarn
                            : sItem.status === 'ACTIVE'
                            ? s.statusTagSuccess
                            : s.statusTagDefault
                        ]}
                      >
                        <Text style={s.statusTagText}>{sItem.status.replace('_', ' ')}</Text>
                      </View>
                    </Pressable>
                  ))}
                  {(!dashboard?.recentRegistrations?.salons || dashboard.recentRegistrations.salons.length === 0) && (
                    <Text style={s.emptyNotice}>No recent salon registrations.</Text>
                  )}
                </View>
              </View>

              {/* Recent Customers Section */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>RECENT CUSTOMER SIGNUPS</Text>
                <View style={s.cardList}>
                  {dashboard?.recentRegistrations?.customers?.map((cItem) => (
                    <View key={cItem._id} style={s.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{cItem.name}</Text>
                        <Text style={s.itemSub}>{cItem.email}</Text>
                      </View>
                      <Text style={s.itemDate}>{new Date(cItem.createdAt).toLocaleDateString()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: PENDING SALONS */}
          {tab === 'PENDING' && (
            <View>
              <Text style={s.tabHeading}>Pending Salon Approvals ({pendingSalons.length})</Text>
              <Text style={s.tabSub}>
                Review salon details, physical addresses, and services before granting platform discovery permissions.
              </Text>

              {pendingSalons.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyIcon}>🎉</Text>
                  <Text style={s.emptyTitle}>No Pending Reviews</Text>
                  <Text style={s.emptyBody}>All salon submissions have been verified and processed.</Text>
                </View>
              ) : (
                <View style={s.cardsStack}>
                  {pendingSalons.map((sItem) => (
                    <View key={sItem._id} style={s.reviewCard}>
                      <View style={s.reviewHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.reviewSalonName}>{sItem.salonName}</Text>
                          <Text style={s.reviewLocation}>📍 {sItem.city} • {sItem.address}</Text>
                        </View>
                        <View style={s.warnPill}>
                          <Text style={s.warnPillText}>PENDING</Text>
                        </View>
                      </View>

                      <Text style={s.reviewDesc}>{sItem.description}</Text>

                      <View style={s.metaGrid}>
                        <Text style={s.metaItem}>👤 Owner: {(sItem.ownerId as any)?.name || 'Partner'}</Text>
                        <Text style={s.metaItem}>✉️ {(sItem.ownerId as any)?.email || sItem.email}</Text>
                        <Text style={s.metaItem}>📞 {sItem.phone}</Text>
                        <Text style={s.metaItem}>💳 Subscription: {sItem.subscriptionStatus}</Text>
                      </View>

                      <View style={s.reviewActionsRow}>
                        <Pressable
                          onPress={() => setSelectedSalon(sItem)}
                          style={s.inspectBtn}
                        >
                          <Text style={s.inspectBtnText}>Inspect Details</Text>
                        </Pressable>

                        <Pressable
                          disabled={actionLoading}
                          onPress={() => sItem._id && handleApprove(sItem._id, sItem.salonName)}
                          style={s.approveBtn}
                        >
                          <Text style={s.approveBtnText}>✓ Approve</Text>
                        </Pressable>

                        <Pressable
                          disabled={actionLoading}
                          onPress={() => {
                            setSelectedSalon(sItem);
                            setRejectReason('');
                            setRejectError(null);
                            setRejectModalVisible(true);
                          }}
                          style={[s.rejectBtn, actionLoading && { opacity: 0.5 }]}
                        >
                          <Text style={s.rejectBtnText}>✕ Reject</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: ACTIVE SALONS */}
          {tab === 'ACTIVE' && (
            <View>
              <Text style={s.tabHeading}>Active & Discoverable Salons ({activeSalons.length})</Text>
              <Text style={s.tabSub}>
                These verified salons are publicly discoverable and taking bookings on Book My Salon.
              </Text>

              {activeSalons.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyTitle}>No Active Salons</Text>
                  <Text style={s.emptyBody}>Approve pending salon registrations to make them live.</Text>
                </View>
              ) : (
                <View style={s.cardsStack}>
                  {activeSalons.map((sItem) => (
                    <View key={sItem._id} style={s.activeCard}>
                      <View style={s.activeHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.reviewSalonName}>{sItem.salonName}</Text>
                          <Text style={s.reviewLocation}>📍 {sItem.city} • {sItem.address}</Text>
                        </View>
                        <View style={s.successPill}>
                          <Text style={s.successPillText}>LIVE</Text>
                        </View>
                      </View>

                      <Text style={s.activeMeta}>
                        📞 {sItem.phone} | ✉️ {sItem.email} | Services: {sItem.services?.length || 0}
                      </Text>

                      <View style={s.activeActionsRow}>
                        <Pressable
                          onPress={() => setSelectedSalon(sItem)}
                          style={s.inspectBtn}
                        >
                          <Text style={s.inspectBtnText}>Inspect Details</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => sItem._id && handleSuspend(sItem._id, sItem.salonName)}
                          style={s.suspendBtn}
                        >
                          <Text style={s.suspendBtnText}>Suspend Listing</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: SUSPENDED SALONS */}
          {tab === 'SUSPENDED' && (
            <View>
              <Text style={s.tabHeading}>Suspended Salons ({suspendedSalons.length})</Text>
              <Text style={s.tabSub}>
                Salons temporarily removed from customer search due to compliance, partner request, or reviews.
              </Text>

              {suspendedSalons.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyTitle}>No Suspended Salons</Text>
                  <Text style={s.emptyBody}>All platform partners are currently in good standing.</Text>
                </View>
              ) : (
                <View style={s.cardsStack}>
                  {suspendedSalons.map((sItem) => (
                    <View key={sItem._id} style={s.suspendedCard}>
                      <Text style={s.reviewSalonName}>{sItem.salonName}</Text>
                      <Text style={s.reviewLocation}>{sItem.city} • {sItem.address}</Text>
                      <View style={s.activeActionsRow}>
                        <Pressable
                          onPress={() => setSelectedSalon(sItem)}
                          style={s.inspectBtn}
                        >
                          <Text style={s.inspectBtnText}>Inspect Details</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => sItem._id && handleReactivate(sItem._id, sItem.salonName)}
                          style={s.approveBtn}
                        >
                          <Text style={s.approveBtnText}>Reactivate Listing</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: SUBSCRIPTION PLANS */}
          {tab === 'PLANS' && (
            <View>
              <Text style={s.tabHeading}>Partner Subscription Tiers</Text>
              <Text style={s.tabSub}>
                Active plans, pricing structure, and subscriber performance.
              </Text>

              <View style={s.cardsStack}>
                {plans.map((p) => (
                  <View key={p.id} style={s.planCard}>
                    <View style={s.planHeader}>
                      <Text style={s.planTitle}>{p.name} Tier</Text>
                      <Text style={s.planTagline}>{p.tagline}</Text>
                    </View>

                    <View style={s.planPriceBox}>
                      <Text style={s.planPriceText}>Monthly: ₹{p.monthlyPrice}</Text>
                      <Text style={s.planPriceText}>Annual: ₹{p.yearlyPrice}</Text>
                    </View>

                    <View style={s.divider} />

                    <View style={s.planStatsRow}>
                      <View style={s.statCol}>
                        <Text style={s.statNumber}>{p.activeSubscribers}</Text>
                        <Text style={s.statTitle}>Active Salons</Text>
                      </View>
                      <View style={s.statCol}>
                        <Text style={s.statNumber}>{p.totalSubscribers}</Text>
                        <Text style={s.statTitle}>Total Subscribed</Text>
                      </View>
                      <View style={s.statCol}>
                        <Text style={s.statNumber}>₹{p.totalRevenue}</Text>
                        <Text style={s.statTitle}>Total Volume</Text>
                      </View>
                    </View>

                    <View style={s.featuresBox}>
                      {p.features.map((f, i) => (
                        <Text key={i} style={s.featureText}>• {f}</Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 6: PAYMENTS */}
          {tab === 'PAYMENTS' && (
            <View>
              <View style={s.payHeader}>
                <View>
                  <Text style={s.tabHeading}>Mock Payments & Ledger</Text>
                  <Text style={s.tabSub}>All subscription checkout transactions processed in development.</Text>
                </View>
                <View style={s.volBadge}>
                  <Text style={s.volLabel}>TOTAL VOLUME</Text>
                  <Text style={s.volVal}>₹{payments?.totalVolume || 0}</Text>
                </View>
              </View>

              <View style={s.cardsStack}>
                {payments?.data?.map((p: any) => (
                  <View key={p._id} style={s.paymentCard}>
                    <View style={s.payRow}>
                      <Text style={s.payTxn}>{p.transactionId}</Text>
                      <Text style={s.payAmount}>₹{p.amount}</Text>
                    </View>
                    <Text style={s.paySalon}>
                      Salon: {p.salonId?.salonName || 'Unknown'} ({p.plan} • {p.billingCycle})
                    </Text>
                    <Text style={s.payMeta}>
                      Partner: {p.ownerId?.name || p.ownerId?.email} • Method: {p.paymentMethod}
                    </Text>
                    <Text style={s.payDate}>Processed: {new Date(p.createdAt).toLocaleString()}</Text>
                  </View>
                ))}
                {(!payments?.data || payments.data.length === 0) && (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyTitle}>No Transactions Recorded</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 7: CUSTOMERS */}
          {tab === 'CUSTOMERS' && (
            <View>
              <Text style={s.tabHeading}>Customer Accounts ({customers.length})</Text>
              <Text style={s.tabSub}>Users registered for discovery and appointments.</Text>

              <View style={s.cardsStack}>
                {customers.map((c: any) => (
                  <View key={c._id} style={s.customerCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.custName}>{c.name}</Text>
                      <Text style={s.custEmail}>{c.email}</Text>
                      <Text style={s.custJoined}>Joined: {new Date(c.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={s.activeBadgePill}>
                      <Text style={s.activeBadgePillText}>CUSTOMER</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 8: OFFERS & PROMOTIONS */}
          {tab === 'OFFERS' && (
            <View>
              <View style={s.offerHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.tabHeading}>Platform Offers & Discounts</Text>
                  <Text style={s.tabSub}>Create promo codes for client bookings.</Text>
                </View>
                <Pressable
                  onPress={() => setCreateOfferVisible(true)}
                  style={s.newOfferBtn}
                >
                  <Text style={s.newOfferBtnText}>+ New Offer</Text>
                </Pressable>
              </View>

              <View style={s.cardsStack}>
                {offers.map((off) => (
                  <View key={off._id} style={s.offerCard}>
                    <View style={s.offerRow}>
                      <View style={s.codeTag}>
                        <Text style={s.codeText}>{off.code}</Text>
                      </View>
                      <Text style={s.discountText}>{off.discountPercent}% OFF</Text>
                    </View>

                    <Text style={s.offerTitle}>{off.title}</Text>
                    <Text style={s.offerDesc}>{off.description}</Text>
                    <Text style={s.offerValid}>Valid until: {new Date(off.validUntil).toLocaleDateString()}</Text>

                    <View style={s.offerActionRow}>
                      <Pressable
                        onPress={() => handleToggleOffer(off._id)}
                        style={[s.toggleBtn, off.isActive && s.toggleBtnActive]}
                      >
                        <Text style={s.toggleBtnText}>{off.isActive ? '✓ Active' : 'Paused'}</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDeleteOffer(off._id)}
                        style={s.delBtn}
                      >
                        <Text style={s.delBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 9: SUPPORT TICKETS MANAGEMENT */}
          {tab === 'TICKETS' && (
            <View>
              <View style={s.tabHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.tabTitle}>Support Tickets ({ticketStats.total})</Text>
                  <Text style={s.tabSub}>Review and resolve incident reports, billing issues, and technical bugs.</Text>
                </View>
                <Pressable
                  onPress={() => void fetchTickets(1, ticketStatusFilter, ticketSearch)}
                  style={s.refreshBtn}
                >
                  <Text style={s.refreshBtnText}>🔄 Refresh</Text>
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={s.searchWrap}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search ticket ID, customer, email, subject..."
                  placeholderTextColor={colors.subtle}
                  value={ticketSearch}
                  onChangeText={(text) => setTicketSearch(text)}
                  onSubmitEditing={() => void fetchTickets(1, ticketStatusFilter, ticketSearch)}
                  returnKeyType="search"
                />
                {ticketSearch.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setTicketSearch('');
                      void fetchTickets(1, ticketStatusFilter, '');
                    }}
                    style={s.searchClearBtn}
                  >
                    <Text style={s.searchClearText}>✕</Text>
                  </Pressable>
                )}
              </View>

              {/* Status Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
                {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((st) => {
                  const isSelected = ticketStatusFilter === st;
                  const count =
                    st === 'ALL'
                      ? ticketStats.total
                      : st === 'OPEN'
                      ? ticketStats.open
                      : st === 'IN_PROGRESS'
                      ? ticketStats.inProgress
                      : st === 'RESOLVED'
                      ? ticketStats.resolved
                      : ticketStats.closed;

                  return (
                    <Pressable
                      key={st}
                      onPress={() => {
                        setTicketStatusFilter(st);
                        void fetchTickets(1, st, ticketSearch);
                      }}
                      style={[s.filterChip, isSelected && s.filterChipActive]}
                    >
                      <Text style={[s.filterChipText, isSelected && s.filterChipTextActive]}>
                        {st === 'ALL' ? 'All' : st.replace('_', ' ')} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Ticket List */}
              {ticketsLoading ? (
                <View style={s.ticketLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.gold} />
                  <Text style={s.ticketLoadingText}>Loading support tickets...</Text>
                </View>
              ) : tickets.length === 0 ? (
                <View style={s.emptyTicketsCard}>
                  <Text style={s.emptyTicketsIcon}>🎫</Text>
                  <Text style={s.emptyTicketsTitle}>No Tickets Found</Text>
                  <Text style={s.emptyTicketsSub}>
                    {ticketSearch
                      ? 'No tickets match your search criteria. Try a different keyword.'
                      : ticketStatusFilter !== 'ALL'
                      ? `There are currently no tickets with status ${ticketStatusFilter}.`
                      : 'No support reports have been filed by customers or salon owners.'}
                  </Text>
                </View>
              ) : (
                <View style={s.ticketsList}>
                  {tickets.map((t) => {
                    const statusBg =
                      t.status === 'OPEN'
                        ? 'rgba(234, 179, 8, 0.15)'
                        : t.status === 'IN_PROGRESS'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : t.status === 'RESOLVED'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(148, 163, 184, 0.15)';
                    const statusColor =
                      t.status === 'OPEN'
                        ? '#D97706'
                        : t.status === 'IN_PROGRESS'
                        ? '#2563EB'
                        : t.status === 'RESOLVED'
                        ? '#16A34A'
                        : '#64748B';

                    return (
                      <Pressable
                        key={t._id}
                        style={s.ticketCard}
                        onPress={() => handleOpenTicket(t)}
                      >
                        <View style={s.ticketTopRow}>
                          <View style={s.ticketIdBadge}>
                            <Text style={s.ticketIdText}>{t.ticketId}</Text>
                          </View>
                          <View style={[s.ticketStatusBadge, { backgroundColor: statusBg }]}>
                            <Text style={[s.ticketStatusText, { color: statusColor }]}>
                              {t.status.replace('_', ' ')}
                            </Text>
                          </View>
                        </View>

                        <View style={s.ticketMetaRow}>
                          <View style={s.categoryTag}>
                            <Text style={s.categoryTagText}>{t.category}</Text>
                          </View>
                          <Text style={s.ticketDate}>
                            {new Date(t.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>

                        <Text style={s.ticketSubject}>{t.subject}</Text>
                        <Text style={s.ticketDesc} numberOfLines={2}>
                          {t.description}
                        </Text>

                        <View style={s.ticketDivider} />

                        <View style={s.ticketFooter}>
                          <View style={{ flex: 1 }}>
                            <View style={s.userInfoRow}>
                              <Text style={s.userRoleBadge}>{t.userRole}</Text>
                              <Text style={s.userNameText}>{t.userName}</Text>
                            </View>
                            <Text style={s.userEmailText}>{t.userEmail}</Text>
                          </View>
                          <Text style={s.manageTicketPrompt}>Manage Status →</Text>
                        </View>

                        {t.adminNotes ? (
                          <View style={s.notesPreview}>
                            <Text style={s.notesPreviewLabel}>Notes: </Text>
                            <Text style={s.notesPreviewText} numberOfLines={1}>
                              {t.adminNotes}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* SALON DETAILS MODAL */}
      <Modal visible={!!selectedSalon && !rejectModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <ScrollView contentContainerStyle={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{selectedSalon?.salonName}</Text>
                <Pressable onPress={() => setSelectedSalon(null)}>
                  <Text style={s.closeText}>✕</Text>
                </Pressable>
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalLabel}>STATUS</Text>
                <Text style={s.modalVal}>{selectedSalon?.status.replace('_', ' ')}</Text>
              </View>

              {selectedSalon?.rejectionReason ? (
                <View style={[s.modalSection, { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 8 }]}>
                  <Text style={[s.modalLabel, { color: '#991B1B' }]}>REJECTION REASON</Text>
                  <Text style={{ color: '#991B1B', fontSize: 13 }}>{selectedSalon.rejectionReason}</Text>
                </View>
              ) : null}

              <View style={s.modalSection}>
                <Text style={s.modalLabel}>DESCRIPTION</Text>
                <Text style={s.modalVal}>{selectedSalon?.description}</Text>
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalLabel}>LOCATION & ADDRESS</Text>
                <Text style={s.modalVal}>{selectedSalon?.address}, {selectedSalon?.city}</Text>
                <Text style={s.modalSub}>
                  {formatCoordinates(selectedSalon?.location)
                    ? `Coordinates: ${formatCoordinates(selectedSalon?.location)}`
                    : 'Coordinates: Not configured'}
                </Text>
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalLabel}>CONTACT</Text>
                <Text style={s.modalVal}>Phone: {selectedSalon?.phone}</Text>
                <Text style={s.modalVal}>Email: {selectedSalon?.email}</Text>
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalLabel}>SERVICES ({selectedSalon?.services?.length || 0})</Text>
                {selectedSalon?.services?.map((svc, i) => (
                  <View key={i} style={s.serviceLine}>
                    <Text style={s.svcName}>• {svc.name} ({svc.category || 'General'})</Text>
                    <Text style={s.svcPrice}>₹{svc.price} | {svc.durationMinutes || 30} mins</Text>
                  </View>
                ))}
              </View>

              {/* Action Bar */}
              <View style={s.modalActions}>
                {selectedSalon?.status === 'PENDING_APPROVAL' && (
                  <>
                    <PrimaryButton
                      label="✓ Approve & Make Live"
                      loading={actionLoading}
                      onPress={() => selectedSalon?._id && handleApprove(selectedSalon._id, selectedSalon.salonName)}
                    />
                    <View style={{ height: 10 }} />
                    <SecondaryButton
                      label="✕ Reject Registration"
                      disabled={actionLoading}
                      onPress={() => {
                        setRejectReason('');
                        setRejectError(null);
                        setRejectModalVisible(true);
                      }}
                    />
                  </>
                )}

                {selectedSalon?.status === 'ACTIVE' && (
                  <SecondaryButton
                    label="Suspend Listing from Discovery"
                    onPress={() => selectedSalon?._id && handleSuspend(selectedSalon._id, selectedSalon.salonName)}
                  />
                )}

                {selectedSalon?.status === 'SUSPENDED' && (
                  <PrimaryButton
                    label="Reactivate Salon Listing"
                    onPress={() => selectedSalon?._id && handleReactivate(selectedSalon._id, selectedSalon.salonName)}
                  />
                )}

                <View style={{ height: 10 }} />
                <Pressable onPress={() => setSelectedSalon(null)} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>Close</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REJECT MODAL */}
      <Modal visible={rejectModalVisible} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: 420 }]}>
            <Text style={s.modalTitle}>Reject Salon Registration</Text>
            <Text style={s.modalSub}>
              Please provide a reason. The salon owner will receive this reason in their notification email to correct and resubmit.
            </Text>

            <TextInput
              style={[
                s.reasonInput,
                rejectError ? { borderColor: colors.danger, borderWidth: 1.5 } : null
              ]}
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={(text) => {
                setRejectReason(text);
                if (rejectError) setRejectError(null);
              }}
              placeholder="Explain why the application is rejected (required)..."
              placeholderTextColor={colors.subtle}
            />

            {rejectError ? (
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>
                ⚠️ {rejectError}
              </Text>
            ) : null}

            <View style={s.modalActions}>
              <PrimaryButton
                label={actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                loading={actionLoading}
                disabled={actionLoading || !rejectReason.trim()}
                onPress={() => void handleReject()}
              />
              <View style={{ height: 10 }} />
              <SecondaryButton
                label="Cancel"
                disabled={actionLoading}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectError(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE OFFER MODAL */}
      <Modal visible={createOfferVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: 520 }]}>
            <Text style={s.modalTitle}>Create Promotional Offer</Text>
            <TextInput
              style={s.input}
              placeholder="Offer Title (e.g. Festival Hair Ritual)"
              value={newOffer.title}
              onChangeText={(t) => setNewOffer((prev) => ({ ...prev, title: t }))}
            />
            <TextInput
              style={s.input}
              placeholder="Promo Code (e.g. FESTIVE25)"
              autoCapitalize="characters"
              value={newOffer.code}
              onChangeText={(t) => setNewOffer((prev) => ({ ...prev, code: t }))}
            />
            <TextInput
              style={s.input}
              placeholder="Discount Percentage (e.g. 25)"
              keyboardType="numeric"
              value={newOffer.discountPercent}
              onChangeText={(t) => setNewOffer((prev) => ({ ...prev, discountPercent: t }))}
            />
            <TextInput
              style={s.input}
              placeholder="Description & Terms"
              value={newOffer.description}
              onChangeText={(t) => setNewOffer((prev) => ({ ...prev, description: t }))}
            />
            <TextInput
              style={s.input}
              placeholder="Valid Until (YYYY-MM-DD)"
              value={newOffer.validUntil}
              onChangeText={(t) => setNewOffer((prev) => ({ ...prev, validUntil: t }))}
            />

            <View style={s.modalActions}>
              <PrimaryButton
                label="Publish Offer Code"
                loading={actionLoading}
                onPress={() => void handleCreateOffer()}
              />
              <View style={{ height: 10 }} />
              <SecondaryButton
                label="Cancel"
                onPress={() => setCreateOfferVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* SUPPORT TICKET DETAILS & STATUS UPDATE MODAL */}
      <Modal
        visible={!!selectedTicket}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTicket(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '90%' }]}>
            <ScrollView contentContainerStyle={s.modalContent} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={s.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>Support Ticket</Text>
                  <Text style={s.ticketModalId}>{selectedTicket?.ticketId}</Text>
                </View>
                <Pressable onPress={() => setSelectedTicket(null)} style={s.closeModalBtn}>
                  <Text style={s.closeText}>✕</Text>
                </Pressable>
              </View>

              {selectedTicket && (
                <>
                  {/* Submitter Info Card */}
                  <View style={s.detailCard}>
                    <Text style={s.detailSectionLabel}>SUBMITTED BY</Text>
                    <View style={s.submitterHeaderRow}>
                      <Text style={s.submitterName}>{selectedTicket.userName}</Text>
                      <View style={s.rolePill}>
                        <Text style={s.rolePillText}>{selectedTicket.userRole}</Text>
                      </View>
                    </View>
                    <Text style={s.detailSubText}>Account: {selectedTicket.userEmail}</Text>
                    {selectedTicket.contactEmail && selectedTicket.contactEmail !== selectedTicket.userEmail ? (
                      <Text style={s.detailSubText}>Follow-up Email: {selectedTicket.contactEmail}</Text>
                    ) : null}
                    <Text style={s.detailDateText}>
                      Submitted: {new Date(selectedTicket.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  {/* Problem Details Card */}
                  <View style={s.detailCard}>
                    <Text style={s.detailSectionLabel}>REPORTED ISSUE</Text>
                    <View style={s.categoryTagFull}>
                      <Text style={s.categoryTagFullText}>{selectedTicket.category}</Text>
                    </View>
                    <Text style={s.detailSubjectText}>{selectedTicket.subject}</Text>
                    <Text style={s.detailBodyText}>{selectedTicket.description}</Text>
                  </View>

                  {/* Resolution History if resolved */}
                  {(selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED') && selectedTicket.resolvedAt ? (
                    <View style={[s.detailCard, { backgroundColor: 'rgba(34, 197, 94, 0.08)', borderColor: '#86EFAC' }]}>
                      <Text style={[s.detailSectionLabel, { color: '#16A34A' }]}>RESOLUTION RECORD</Text>
                      <Text style={s.resolutionDateText}>
                        Resolved on: {new Date(selectedTicket.resolvedAt).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}

                  {/* Status & Resolution Controls */}
                  <View style={s.statusControlCard}>
                    <Text style={s.detailSectionLabel}>UPDATE TICKET STATUS</Text>
                    <View style={s.statusButtonsGrid}>
                      {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((st) => {
                        const isCurrent = ticketStatusSelection === st;
                        const activeBg =
                          st === 'OPEN'
                            ? '#EAB308'
                            : st === 'IN_PROGRESS'
                            ? '#3B82F6'
                            : st === 'RESOLVED'
                            ? '#22C55E'
                            : '#64748B';

                        return (
                          <Pressable
                            key={st}
                            onPress={() => setTicketStatusSelection(st)}
                            style={[
                              s.statusOptionBtn,
                              isCurrent && { backgroundColor: activeBg, borderColor: activeBg }
                            ]}
                          >
                            <Text
                              style={[
                                s.statusOptionText,
                                isCurrent && { color: '#FFFFFF', fontWeight: '800' }
                              ]}
                            >
                              {isCurrent ? '✓ ' : ''}{st.replace('_', ' ')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={[s.detailSectionLabel, { marginTop: 14 }]}>ADMIN RESOLUTION NOTES</Text>
                    <TextInput
                      style={s.adminNotesInput}
                      multiline
                      numberOfLines={3}
                      placeholder="Log internal notes, customer communication, or resolution steps..."
                      placeholderTextColor={colors.subtle}
                      value={ticketAdminNotes}
                      onChangeText={setTicketAdminNotes}
                      textAlignVertical="top"
                    />

                    <View style={{ height: 16 }} />

                    <PrimaryButton
                      label="Save Status & Notes"
                      loading={updatingTicketStatus}
                      onPress={() => void handleUpdateTicketStatus()}
                    />

                    <View style={{ height: 10 }} />

                    <SecondaryButton
                      label="Close Details"
                      onPress={() => setSelectedTicket(null)}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 15,

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  brandBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start'
  },
  brandBadgeText: { fontSize: 10, fontWeight: '800', color: colors.gold, letterSpacing: 0.5 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 4 },
  headerEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  logoutText: { fontSize: 12, fontWeight: '700', color: colors.ink },

  tabsWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  tabsScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  tabItemActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  tabBadgeActive: { backgroundColor: colors.gold },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: colors.gold },
  tabBadgeTextActive: { color: '#FFFFFF' },

  content: { padding: 20, paddingBottom: 40 },
  loadingWrap: { paddingVertical: 80, alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  metricCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },

  metricCardWarning: { borderColor: colors.gold, backgroundColor: '#FFFBEB' },
  metricCardSuccess: { borderColor: colors.success, backgroundColor: '#ECFDF5' },
  metricIcon: { fontSize: 20, marginBottom: 6 },
  metricNumber: { fontSize: 28, fontWeight: '800', color: colors.ink },
  metricLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', marginTop: 2 },
  metricAction: { fontSize: 11, color: colors.gold, fontWeight: '700', marginTop: 8 },

  quickAlert: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 20
  },
  quickAlertTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  quickAlertBody: { fontSize: 12, color: '#78350F', lineHeight: 18, marginTop: 4 },
  quickAlertBtn: { marginTop: 10 },
  quickAlertBtnText: { fontSize: 12, fontWeight: '800', color: '#92400E' },

  section: { marginTop: 12, marginBottom: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.gold, letterSpacing: 1.2, marginBottom: 10 },
  cardList: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemDate: { fontSize: 11, color: colors.muted },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  statusTagWarn: { backgroundColor: '#FEF3C7' },
  statusTagSuccess: { backgroundColor: '#D1FAE5' },
  statusTagDefault: { backgroundColor: colors.background },
  statusTagText: { fontSize: 10, fontWeight: '700', color: colors.ink },
  emptyNotice: { padding: 14, color: colors.muted, fontSize: 12, textAlign: 'center' },

  tabHeading: { fontSize: 20, fontWeight: '800', color: colors.ink },
  tabSub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 16, lineHeight: 18 },

  cardsStack: { gap: 14 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.gold
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reviewSalonName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  reviewLocation: { fontSize: 12, color: colors.muted, marginTop: 3 },
  warnPill: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  warnPillText: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  reviewDesc: { fontSize: 12, color: colors.muted, marginVertical: 8, lineHeight: 17 },
  metaGrid: { gap: 3, marginBottom: 12 },
  metaItem: { fontSize: 12, color: colors.ink },
  reviewActionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  inspectBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inspectBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  approveBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center'
  },
  approveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  rejectBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  activeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  successPill: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successBorder, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  successPillText: { fontSize: 9, fontWeight: '800', color: colors.success },
  activeMeta: { fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 12 },
  activeActionsRow: { flexDirection: 'row', gap: 10 },
  suspendBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },
  suspendBtnText: { fontSize: 12, fontWeight: '700', color: colors.danger },

  suspendedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECDD3'
  },

  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  planHeader: { marginBottom: 8 },
  planTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  planTagline: { fontSize: 12, color: colors.muted, marginTop: 2 },
  planPriceBox: { flexDirection: 'row', gap: 16, marginVertical: 6 },
  planPriceText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  planStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  statCol: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '800', color: colors.ink },
  statTitle: { fontSize: 11, color: colors.muted, marginTop: 2 },
  featuresBox: { marginTop: 10 },
  featureText: { fontSize: 12, color: colors.muted, lineHeight: 18 },

  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  volBadge: { backgroundColor: colors.surface, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  volLabel: { fontSize: 9, fontWeight: '700', color: colors.gold, letterSpacing: 0.5 },
  volVal: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 2 },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payTxn: { fontSize: 12, fontWeight: '700', color: colors.gold },
  payAmount: { fontSize: 16, fontWeight: '800', color: colors.ink },
  paySalon: { fontSize: 13, fontWeight: '600', color: colors.ink, marginTop: 4 },
  payMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  payDate: { fontSize: 10, color: colors.muted, marginTop: 4 },

  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  custName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  custEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  custJoined: { fontSize: 10, color: colors.muted, marginTop: 4 },
  activeBadgePill: { backgroundColor: colors.goldSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  activeBadgePillText: { fontSize: 10, fontWeight: '800', color: colors.gold },

  offerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  newOfferBtn: {
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm
  },
  newOfferBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeTag: { backgroundColor: colors.goldSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  codeText: { fontSize: 13, fontWeight: '800', color: colors.gold },
  discountText: { fontSize: 14, fontWeight: '800', color: colors.success },
  offerTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 8 },
  offerDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  offerValid: { fontSize: 10, color: colors.muted, marginTop: 6 },
  offerActionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  toggleBtnActive: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  toggleBtnText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  delBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECDD3'
  },
  delBtnText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },

  emptyBox: { paddingVertical: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyBody: { fontSize: 12, color: colors.muted, marginTop: 4, textAlign: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '85%',
    padding: 20
  },
  modalContent: { paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  closeText: { fontSize: 18, color: colors.muted, fontWeight: '700' },
  modalSection: { marginBottom: 12 },
  modalLabel: { fontSize: 10, fontWeight: '700', color: colors.gold, letterSpacing: 1 },
  modalVal: { fontSize: 14, color: colors.ink, marginTop: 2, fontWeight: '500' },
  modalSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  serviceLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  svcName: { fontSize: 12, color: colors.ink },
  svcPrice: { fontSize: 12, fontWeight: '700', color: colors.gold },
  modalActions: { marginTop: 18 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: colors.muted, fontSize: 13, fontWeight: '600' },

  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    padding: 12,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
    marginVertical: 14
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 10
  },

  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  tabTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },

  // Support Tickets Styles
  refreshBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  refreshBtnText: { fontSize: 11, fontWeight: '700', color: colors.ink },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 13,
    color: colors.ink
  },
  searchClearBtn: { padding: 6 },
  searchClearText: { fontSize: 13, color: colors.muted, fontWeight: '700' },

  filterScroll: { gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '800' },

  ticketLoadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  ticketLoadingText: { fontSize: 12, color: colors.muted },

  emptyTicketsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 10
  },
  emptyTicketsIcon: { fontSize: 36, marginBottom: 10 },
  emptyTicketsTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  emptyTicketsSub: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  ticketsList: { gap: 12, paddingBottom: 20 },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  ticketTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketIdBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border
  },
  ticketIdText: { fontSize: 12, fontWeight: '800', color: colors.gold, letterSpacing: 0.5 },
  ticketStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  ticketStatusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  ticketMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  categoryTag: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs
  },
  categoryTagText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  ticketDate: { fontSize: 10, color: colors.muted },

  ticketSubject: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 10 },
  ticketDesc: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },

  ticketDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userRoleBadge: {
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: colors.goldSoft,
    color: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  userNameText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  userEmailText: { fontSize: 11, color: colors.muted, marginTop: 2 },
  manageTicketPrompt: { fontSize: 11, fontWeight: '700', color: colors.gold },

  notesPreview: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: radius.xs,
    marginTop: 10
  },
  notesPreviewLabel: { fontSize: 10, fontWeight: '700', color: colors.gold },
  notesPreviewText: { fontSize: 10, color: colors.muted, flex: 1 },

  // Ticket Modal Specific Styles
  ticketModalId: { fontSize: 12, fontWeight: '700', color: colors.gold, marginTop: 2 },
  closeModalBtn: { padding: 8 },
  detailCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  detailSectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: 8
  },
  submitterHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submitterName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  rolePill: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  rolePillText: { fontSize: 10, fontWeight: '800', color: colors.gold },
  detailSubText: { fontSize: 12, color: colors.muted, marginTop: 4 },
  detailDateText: { fontSize: 11, color: colors.muted, marginTop: 6 },

  categoryTagFull: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8
  },
  categoryTagFullText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  detailSubjectText: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  detailBodyText: { fontSize: 13, color: colors.ink, lineHeight: 20 },

  resolutionDateText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  statusControlCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  statusButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  statusOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  statusOptionText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  adminNotesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    padding: 10,
    fontSize: 12,
    color: colors.ink,
    minHeight: 60
  }
});
