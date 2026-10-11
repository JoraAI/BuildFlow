/**
 * Icecream-inventory-buyer - join via invite code, OTP login,
 * then a single-scroll home: Shop → Cart → Recent orders → Account.
 * Catalog = manufacturer item master rows marked b2bPublished.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { buyerFetch, getBuyerToken, setBuyerToken } from '../lib/api';

type Buyer = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  companyName: string;
  customerName: string;
  customerId?: string;
};

type CustomerProfile = {
  id: string;
  name: string;
  businessName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  paymentTerms?: string | null;
  buyerRole?: 'DISTRIBUTOR' | 'CUSTOMER' | null;
  tradeDiscountPct?: number | null;
};

type CatalogItem = {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  rate: string | number;
  mrp?: string | number | null;
  listRate?: string | number | null;
  discountPct?: string | number | null;
  category?: string | null;
};

type Order = {
  id: string;
  soNumber: string;
  status: string;
  total: string | number;
  orderDate?: string | null;
  createdAt?: string | null;
  carrier?: string | null;
  trackingRef?: string | null;
  shippedAt?: string | null;
  lines: Array<{ itemName: string; quantity: string | number; unit: string }>;
};

type AuthMode = 'join' | 'login';

type InvitePreview = {
  companyName: string;
  expiresAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  customer: {
    id: string;
    name: string;
    businessName?: string | null;
    email?: string | null;
    phone?: string | null;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    gstin?: string | null;
  };
};

const NAVY = '#1E3A5F';
const AMBER = '#F59E0B';
const RECENT_LIMIT = 10;

function formatOrderDate(order: Order): string {
  const raw = order.orderDate ?? order.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function QtyStepper({
  qty,
  onDec,
  onInc,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  if (qty <= 0) {
    return (
      <Pressable style={styles.btnSmall} onPress={onInc}>
        <Text style={styles.btnText}>Add</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onDec}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable style={styles.stepBtn} onPress={onInc}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function BuyerHome() {
  const [token, setToken] = useState<string | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('join');
  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [successNote, setSuccessNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getBuyerToken().then(setToken);
  }, []);

  const loadCatalog = useCallback(async () => {
    const rows = await buyerFetch<CatalogItem[]>('/buyer/catalog');
    setCatalog(rows);
  }, []);

  const loadOrders = useCallback(async () => {
    const rows = await buyerFetch<Order[]>('/buyer/orders');
    setOrders(rows);
  }, []);

  const loadProfile = useCallback(async () => {
    const data = await buyerFetch<{ buyer: Buyer; customer: CustomerProfile }>('/buyer/profile');
    setBuyer(data.buyer);
    setProfile(data.customer);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadCatalog().catch((e) => setError(String(e.message)));
    void loadOrders().catch(() => undefined);
    void loadProfile().catch(() => undefined);
  }, [token, loadCatalog, loadOrders, loadProfile]);

  const cartLines = useMemo(
    () =>
      catalog
        .filter((c) => (cart[c.id] ?? 0) > 0)
        .map((c) => ({ ...c, qty: cart[c.id]! })),
    [catalog, cart],
  );

  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);
  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + Number(l.rate) * l.qty, 0),
    [cartLines],
  );

  const visibleOrders = showAllOrders ? orders : orders.slice(0, RECENT_LIMIT);

  const setQty = (id: string, next: number) => {
    setCart((c) => {
      const copy = { ...c };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const previewInvite = async () => {
    setBusy(true);
    setError('');
    setInvitePreview(null);
    try {
      const data = await buyerFetch<InvitePreview>('/buyer/auth/preview-invite', {
        method: 'POST',
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      setInvitePreview(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const claimInvite = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await buyerFetch<{ accessToken: string; buyer: Buyer }>('/buyer/auth/claim-invite', {
        method: 'POST',
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      await setBuyerToken(data.accessToken);
      setToken(data.accessToken);
      setBuyer(data.buyer);
      setInvitePreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    setBusy(true);
    setError('');
    try {
      await buyerFetch('/buyer/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await buyerFetch<{ accessToken: string; buyer: Buyer }>('/buyer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      await setBuyerToken(data.accessToken);
      setToken(data.accessToken);
      setBuyer(data.buyer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async () => {
    if (cartLines.length === 0) return;
    setBusy(true);
    setError('');
    setSuccessNote('');
    try {
      const created = await buyerFetch<Order>('/buyer/orders', {
        method: 'POST',
        body: JSON.stringify({
          lines: cartLines.map((l) => ({
            resourceId: l.id,
            quantity: l.qty,
            rate: Number(l.rate),
          })),
        }),
      });
      setCart({});
      await loadOrders();
      setSuccessNote(
        created?.soNumber ? `Order ${created.soNumber} placed` : 'Order placed successfully',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setBusy(true);
    setError('');
    try {
      const data = await buyerFetch<{ buyer: Buyer; customer: CustomerProfile }>('/buyer/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name,
          businessName: profile.businessName,
          gstin: profile.gstin,
          pan: profile.pan,
          phone: profile.phone,
          email: profile.email,
          billingAddress: profile.billingAddress,
          shippingAddress: profile.shippingAddress,
        }),
      });
      setProfile(data.customer);
      setBuyer(data.buyer);
      setSuccessNote('Account details saved');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await setBuyerToken(null);
    setToken(null);
    setBuyer(null);
    setProfile(null);
    setCart({});
    setOrders([]);
    setSuccessNote('');
    setAccountOpen(false);
    setShowAllOrders(false);
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.brand}>Icecream-inventory-buyer</Text>
          <Text style={styles.muted}>
            Enter the invite code from your manufacturer. Your details are already filled by them —
            confirm and join. After that you can edit your profile and order from their catalog.
          </Text>

          {authMode === 'join' ? (
            <>
              <Text style={styles.label}>Invite code</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={(v) => {
                  setInviteCode(v);
                  setInvitePreview(null);
                }}
                autoCapitalize="characters"
                placeholder="e.g. AB12CD34"
              />
              {!invitePreview ? (
                <Pressable style={styles.btn} onPress={previewInvite} disabled={busy}>
                  <Text style={styles.btnText}>{busy ? 'Checking…' : 'Continue'}</Text>
                </Pressable>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{invitePreview.companyName}</Text>
                  <Text style={styles.muted}>
                    Expires {new Date(invitePreview.expiresAt).toLocaleString()}
                  </Text>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.prefill}>{invitePreview.name}</Text>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.prefill}>{invitePreview.email ?? '—'}</Text>
                  <Text style={styles.label}>Phone</Text>
                  <Text style={styles.prefill}>{invitePreview.phone ?? '—'}</Text>
                  {invitePreview.customer.gstin ? (
                    <>
                      <Text style={styles.label}>GSTIN</Text>
                      <Text style={styles.prefill}>{invitePreview.customer.gstin}</Text>
                    </>
                  ) : null}
                  {invitePreview.customer.billingAddress ? (
                    <>
                      <Text style={styles.label}>Billing address</Text>
                      <Text style={styles.prefill}>{invitePreview.customer.billingAddress}</Text>
                    </>
                  ) : null}
                  <Text style={[styles.muted, { marginTop: 8 }]}>
                    You can edit these after joining under Account.
                  </Text>
                  <Pressable style={styles.btn} onPress={claimInvite} disabled={busy}>
                    <Text style={styles.btnText}>Join & continue</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnSecondary}
                    onPress={() => {
                      setInvitePreview(null);
                      setError('');
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.btnSecondaryText}>Use a different code</Text>
                  </Pressable>
                </View>
              )}
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Pressable
                style={{ marginTop: 20 }}
                onPress={() => {
                  setAuthMode('login');
                  setError('');
                  setInvitePreview(null);
                }}
              >
                <Text style={styles.link}>Already joined? Sign in with email or mobile OTP</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.muted}>For returning buyers after you have joined once.</Text>
              <Text style={styles.label}>Email or mobile</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="default"
                placeholder="you@company.com or 9876543210"
              />
              <Text style={styles.label}>OTP</Text>
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
              />
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Pressable style={styles.btnSecondary} onPress={sendOtp} disabled={busy}>
                <Text style={styles.btnSecondaryText}>Send OTP</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={login} disabled={busy}>
                <Text style={styles.btnText}>Sign in</Text>
              </Pressable>
              <Pressable
                style={{ marginTop: 16 }}
                onPress={() => {
                  setAuthMode('join');
                  setError('');
                }}
              >
                <Text style={styles.link}>Have an invite code? Join here</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const roleLabel =
    profile?.buyerRole === 'DISTRIBUTOR'
      ? 'Distributor'
      : profile?.buyerRole === 'CUSTOMER'
        ? 'Customer'
        : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <Text style={styles.brandSmall}>Icecream-inventory-buyer</Text>
          <Text style={styles.mutedHeader}>{buyer?.companyName ?? 'Catalog'}</Text>
          {roleLabel ? (
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{roleLabel} pricing</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.link}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.pad, cartCount > 0 ? styles.padWithFooter : null]}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {successNote ? <Text style={styles.success}>{successNote}</Text> : null}

        {/* Shop */}
        <Text style={styles.sectionTitle}>Shop</Text>
        <Text style={styles.sectionHint}>Your prices for this account. Tap + / − to set quantity.</Text>
        {catalog.length === 0 ? (
          <Text style={styles.muted}>
            No published items yet. Your manufacturer publishes items from their Materials list.
          </Text>
        ) : (
          catalog.map((item) => {
            const net = Number(item.rate);
            const mrp = item.mrp != null ? Number(item.mrp) : null;
            const disc = item.discountPct != null ? Number(item.discountPct) : 0;
            const qty = cart[item.id] ?? 0;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.muted}>
                      {item.sku ? `${item.sku} · ` : ''}
                      {item.category ? `${item.category} · ` : ''}
                      per {item.unit}
                    </Text>
                    <View style={styles.priceRow}>
                      {mrp != null && mrp > net ? (
                        <Text style={styles.mrpStrike}>MRP ₹{mrp.toFixed(2)}</Text>
                      ) : null}
                      <Text style={styles.price}>₹{net.toFixed(2)}</Text>
                      {disc > 0 ? <Text style={styles.discBadge}>{disc}% off</Text> : null}
                    </View>
                  </View>
                  <QtyStepper
                    qty={qty}
                    onDec={() => setQty(item.id, qty - 1)}
                    onInc={() => setQty(item.id, qty + 1)}
                  />
                </View>
              </View>
            );
          })
        )}

        {/* Cart */}
        <Text style={[styles.sectionTitle, styles.sectionGap]}>Your cart</Text>
        {cartLines.length === 0 ? (
          <Text style={styles.muted}>Cart is empty. Add items from Shop above.</Text>
        ) : (
          <>
            {cartLines.map((l) => (
              <View key={l.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle}>{l.name}</Text>
                    <Text style={styles.muted}>
                      ₹{Number(l.rate).toFixed(2)} × {l.qty} = ₹{(Number(l.rate) * l.qty).toFixed(2)}
                    </Text>
                  </View>
                  <QtyStepper
                    qty={l.qty}
                    onDec={() => setQty(l.id, l.qty - 1)}
                    onInc={() => setQty(l.id, l.qty + 1)}
                  />
                </View>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>
                {cartCount} item{cartCount === 1 ? '' : 's'}
              </Text>
              <Text style={styles.subtotalValue}>₹{cartTotal.toFixed(2)}</Text>
            </View>
            <Pressable style={styles.btn} onPress={placeOrder} disabled={busy}>
              <Text style={styles.btnText}>{busy ? 'Placing…' : 'Place order'}</Text>
            </Pressable>
          </>
        )}

        {/* Recent orders */}
        <Text style={[styles.sectionTitle, styles.sectionGap]}>Recent orders</Text>
        {orders.length === 0 ? (
          <Text style={styles.muted}>No orders yet. Place your first order from the cart.</Text>
        ) : (
          <>
            {visibleOrders.map((item) => {
              const dateLabel = formatOrderDate(item);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>{item.soNumber}</Text>
                    <Text style={styles.statusPill}>{item.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.muted}>
                    {dateLabel ? `${dateLabel} · ` : ''}₹{Number(item.total).toFixed(2)}
                  </Text>
                  {item.trackingRef ? (
                    <Text style={styles.muted}>
                      Ship: {item.carrier ?? '—'} · {item.trackingRef}
                    </Text>
                  ) : null}
                  {item.lines.slice(0, 4).map((l, idx) => (
                    <Text key={idx} style={styles.line}>
                      • {l.itemName} × {String(l.quantity)} {l.unit}
                    </Text>
                  ))}
                  {item.lines.length > 4 ? (
                    <Text style={styles.line}>+{item.lines.length - 4} more lines</Text>
                  ) : null}
                </View>
              );
            })}
            {orders.length > RECENT_LIMIT ? (
              <Pressable
                style={styles.btnSecondary}
                onPress={() => setShowAllOrders((v) => !v)}
              >
                <Text style={styles.btnSecondaryText}>
                  {showAllOrders
                    ? 'Show recent only'
                    : `Show all orders (${orders.length})`}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Account */}
        <Text style={[styles.sectionTitle, styles.sectionGap]}>Account</Text>
        <Pressable
          style={styles.accountToggle}
          onPress={() => setAccountOpen((v) => !v)}
        >
          <Text style={styles.accountToggleText}>
            {accountOpen ? 'Hide account details' : 'Edit account details'}
          </Text>
        </Pressable>
        {accountOpen && profile ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.muted}>
              Details prefilled by your manufacturer. Edit anything that needs updating.
            </Text>
            {(
              [
                ['name', 'Business / party name'],
                ['businessName', 'Trade name'],
                ['gstin', 'GSTIN'],
                ['pan', 'PAN'],
                ['phone', 'Phone'],
                ['email', 'Email'],
                ['billingAddress', 'Billing address'],
                ['shippingAddress', 'Shipping address'],
              ] as Array<[keyof CustomerProfile, string]>
            ).map(([key, label]) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(profile[key] ?? '')}
                  onChangeText={(v) => setProfile((p) => (p ? { ...p, [key]: v } : p))}
                />
              </View>
            ))}
            {profile.buyerRole ? (
              <Text style={[styles.muted, { marginTop: 8 }]}>
                Role: {profile.buyerRole === 'DISTRIBUTOR' ? 'Distributor' : 'Customer'}
                {profile.tradeDiscountPct != null
                  ? ` · trade discount override ${profile.tradeDiscountPct}%`
                  : ''}
              </Text>
            ) : null}
            {profile.paymentTerms ? (
              <Text style={[styles.muted, { marginTop: 8 }]}>
                Payment terms (set by manufacturer): {profile.paymentTerms}
              </Text>
            ) : null}
            <Pressable style={styles.btn} onPress={saveProfile} disabled={busy}>
              <Text style={styles.btnText}>Save profile</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {cartCount > 0 ? (
        <View style={styles.stickyFooter}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.stickyMeta}>
              {cartCount} item{cartCount === 1 ? '' : 's'} · ₹{cartTotal.toFixed(2)}
            </Text>
          </View>
          <Pressable
            style={[styles.stickyBtn, busy ? styles.stickyBtnDisabled : null]}
            onPress={placeOrder}
            disabled={busy}
          >
            <Text style={styles.btnText}>{busy ? '…' : 'Place order'}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  pad: { padding: 16, paddingBottom: 32 },
  padWithFooter: { paddingBottom: 96 },
  brand: { fontSize: 28, fontWeight: '800', color: NAVY, marginBottom: 4 },
  brandSmall: { fontSize: 16, fontWeight: '800', color: NAVY },
  muted: { color: '#64748B', fontSize: 13, marginBottom: 8 },
  mutedHeader: { color: '#64748B', fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 },
  sectionHint: { color: '#64748B', fontSize: 13, marginBottom: 12 },
  sectionGap: { marginTop: 28 },
  label: { fontSize: 12, fontWeight: '700', color: NAVY, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  btn: {
    marginTop: 16,
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSmall: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  btnSecondary: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: NAVY,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSecondaryText: { color: NAVY, fontWeight: '700' },
  err: { color: '#DC2626', marginBottom: 8 },
  success: {
    color: '#047857',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    fontWeight: '600',
    fontSize: 13,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  link: { color: AMBER, fontWeight: '700' },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleChipText: { fontSize: 11, fontWeight: '700', color: NAVY },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: NAVY },
  prefill: { fontSize: 15, color: '#0F172A', marginBottom: 4 },
  line: { fontSize: 12, color: '#334155', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  price: { fontSize: 16, fontWeight: '800', color: NAVY },
  mrpStrike: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  stepQty: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: '800',
    color: NAVY,
    fontSize: 15,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  subtotalLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  subtotalValue: { fontSize: 18, fontWeight: '800', color: NAVY },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    color: NAVY,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  accountToggle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  accountToggleText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  stickyMeta: { fontSize: 14, fontWeight: '700', color: NAVY },
  stickyBtn: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stickyBtnDisabled: { opacity: 0.6 },
});
