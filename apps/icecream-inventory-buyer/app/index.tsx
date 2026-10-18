/**
 * Jora Trade (buyer app) - join via invite code, OTP login,
 * then a single-scroll home: Shop → Cart → Recent orders → Account.
 * Catalog = supplier item master rows marked b2bPublished (any vertical).
 * Visual design aligned with Play Store listing screenshots.
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
  Linking,
  StatusBar,
} from 'react-native';
import { buyerFetch, getBuyerToken, setBuyerToken } from '../lib/api';

const PRIVACY_URL = 'https://build-flow-frontend-jet.vercel.app/privacy';
const TERMS_URL = 'https://build-flow-frontend-jet.vercel.app/terms';
const SMS_OPT_IN_URL = 'https://build-flow-frontend-jet.vercel.app/sms-opt-in';

function looksLikeMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && !value.includes('@');
}

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
const BG = '#F1F5F9';
const RECENT_LIMIT = 10;

function formatOrderDate(order: Order): string {
  const raw = order.orderDate ?? order.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusTone(status: string): 'confirmed' | 'pending' | 'neutral' {
  const s = status.toUpperCase();
  if (s.includes('CONFIRM') || s.includes('FULFILL') || s === 'COMPLETED' || s === 'SHIPPED') {
    return 'confirmed';
  }
  if (s.includes('PEND') || s.includes('DRAFT') || s.includes('NEW') || s === 'OPEN') {
    return 'pending';
  }
  return 'neutral';
}

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Text style={[styles.brandMarkJ, { fontSize: size * 0.55 }]}>J</Text>
    </View>
  );
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
      <Pressable style={styles.btnAdd} onPress={onInc}>
        <Text style={styles.btnAddText}>Add</Text>
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
  const [orderQuery, setOrderQuery] = useState('');
  const [successNote, setSuccessNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [otpHint, setOtpHint] = useState('');

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

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.soNumber.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q) ||
        o.lines.some((l) => l.itemName.toLowerCase().includes(q)),
    );
  }, [orders, orderQuery]);

  const visibleOrders = showAllOrders ? filteredOrders : filteredOrders.slice(0, RECENT_LIMIT);

  const setQty = (id: string, next: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const previewInvite = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await buyerFetch<InvitePreview>('/buyer/auth/preview-invite', {
        method: 'POST',
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      setInvitePreview(data);
    } catch (e) {
      setError((e as Error).message);
      setInvitePreview(null);
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    const dest = email.trim();
    if (looksLikeMobile(dest) && !smsConsent) {
      setError('Please agree to receive SMS OTPs before requesting a code.');
      return;
    }
    setBusy(true);
    setError('');
    setOtpHint('');
    try {
      const data = await buyerFetch<{
        sent: boolean;
        expiresInSec: number;
        destinationMasked?: string;
        devCode?: string;
      }>('/buyer/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: dest }),
      });
      const masked = data.destinationMasked ? ` to ${data.destinationMasked}` : '';
      setOtpHint(
        data.devCode
          ? `Code sent${masked}. Dev code: ${data.devCode}`
          : `Code sent${masked}. Valid for ${Math.round((data.expiresInSec ?? 600) / 60)} minutes.`,
      );
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
      setOtpHint('');
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
          })),
        }),
      });
      setCart({});
      setSuccessNote(`Order ${created.soNumber} placed`);
      await loadOrders();
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
      await buyerFetch('/buyer/profile', {
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
      setSuccessNote('Profile saved');
      await loadProfile();
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
    setCatalog([]);
    setCart({});
    setOrders([]);
    setSuccessNote('');
    setAccountOpen(false);
    setShowAllOrders(false);
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.authHero}>
          <View style={styles.authHeroRow}>
            <BrandMark size={44} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.authHeroTitle}>Jora Trade</Text>
              <Text style={styles.authHeroTag}>B2B Trade. Built for Buyers.</Text>
            </View>
          </View>
          <View style={styles.authHeroCurve} />
        </View>

        <ScrollView contentContainerStyle={styles.authPad} keyboardShouldPersistTaps="handled">
          <Text style={styles.authHeading}>{authMode === 'join' ? 'LOGIN' : 'SIGN IN'}</Text>
          <Text style={styles.authSub}>
            {authMode === 'join'
              ? 'Access is invite-only. Enter the code from your ice cream manufacturer (or supplier) to join and order from their catalog.'
              : 'Already joined with an invite code? Sign in with the email or mobile they registered for you.'}
          </Text>

          {authMode === 'join' ? (
            <>
              <Text style={styles.label}>Invite code</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.inputFlex}
                  value={inviteCode}
                  onChangeText={(v) => {
                    setInviteCode(v);
                    setInvitePreview(null);
                  }}
                  autoCapitalize="characters"
                  placeholder="Enter invite code"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {!invitePreview ? (
                <Pressable style={styles.btnPrimary} onPress={previewInvite} disabled={busy}>
                  <Text style={styles.btnPrimaryText}>{busy ? 'Checking…' : 'Confirm/Join'}</Text>
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
                  <Pressable style={styles.btnPrimary} onPress={claimInvite} disabled={busy}>
                    <Text style={styles.btnPrimaryText}>Join & continue</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnGhost}
                    onPress={() => {
                      setInvitePreview(null);
                      setError('');
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.btnGhostText}>Use a different code</Text>
                  </Pressable>
                </View>
              )}
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <View style={styles.authSwitch}>
                <Text style={styles.mutedCenter}>Already joined?</Text>
                <Pressable
                  onPress={() => {
                    setAuthMode('login');
                    setError('');
                    setInvitePreview(null);
                  }}
                >
                  <Text style={styles.linkUnderline}>
                    Sign in with email or mobile OTP
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Email or mobile</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  style={styles.inputFlex}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="default"
                  placeholder="you@company.com or 9876543210"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Text style={styles.label}>OTP</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>#</Text>
                <TextInput
                  style={styles.inputFlex}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: smsConsent }}
                onPress={() => setSmsConsent((v) => !v)}
                style={styles.consentBox}
              >
                <View style={[styles.checkbox, smsConsent && styles.checkboxOn]}>
                  {smsConsent ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.consentText}>
                    I agree to receive transactional SMS one-time passcodes from StaffingPros /
                    Jora AI (BuildFlow) for buyer login. Msg frequency varies. Msg & data rates may
                    apply. Reply STOP to opt out; HELP for help.
                  </Text>
                  <Text style={[styles.muted, { marginBottom: 0, marginTop: 6 }]}>
                    See{' '}
                    <Text style={styles.linkInline} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                      Privacy
                    </Text>
                    {' · '}
                    <Text style={styles.linkInline} onPress={() => void Linking.openURL(TERMS_URL)}>
                      Terms
                    </Text>
                    {' · '}
                    <Text
                      style={styles.linkInline}
                      onPress={() => void Linking.openURL(SMS_OPT_IN_URL)}
                    >
                      SMS opt-in
                    </Text>
                    .
                  </Text>
                </View>
              </Pressable>
              {otpHint ? <Text style={styles.success}>{otpHint}</Text> : null}
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Pressable style={styles.btnGhost} onPress={sendOtp} disabled={busy}>
                <Text style={styles.btnGhostText}>Send OTP</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={login} disabled={busy}>
                <Text style={styles.btnPrimaryText}>Sign in</Text>
              </Pressable>
              <View style={styles.authSwitch}>
                <Pressable
                  onPress={() => {
                    setAuthMode('join');
                    setError('');
                    setOtpHint('');
                  }}
                >
                  <Text style={styles.linkUnderline}>Have an invite code? Join here</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.secureNote}>
            <Text style={styles.secureNoteIcon}>✓</Text>
            <Text style={styles.secureNoteText}>
              Invite-only access. Codes are issued by your manufacturer and used only for verification.
            </Text>
          </View>
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
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.topBar}>
        <Text style={styles.topBarBrand}>
          Jora <Text style={styles.topBarBrandAccent}>Trade</Text>
        </Text>
        <View style={styles.topBarRight}>
          {cartCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          ) : null}
          <Pressable onPress={logout} hitSlop={8}>
            <Text style={styles.topBarLogout}>Logout</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.topBarCurve} />

      <View style={styles.partyRow}>
        <View style={styles.partyIcon}>
          <Text style={styles.partyIconText}>🛍</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.partyName} numberOfLines={1}>
            {buyer?.companyName ?? 'Supplier catalog'}
          </Text>
          <Text style={styles.partySub} numberOfLines={1}>
            {buyer?.customerName ?? 'Buyer'}
            {roleLabel ? ` · ${roleLabel} pricing` : ''}
          </Text>
        </View>
        {roleLabel ? (
          <View style={styles.roleChip}>
            <Text style={styles.roleChipText}>{roleLabel} pricing</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.pad, cartCount > 0 ? styles.padWithFooter : null]}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {successNote ? <Text style={styles.success}>{successNote}</Text> : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>SHOP Catalog</Text>
        </View>
        <Text style={styles.sectionHint}>Your prices for this account. Tap + / − to set quantity.</Text>
        {catalog.length === 0 ? (
          <Text style={styles.muted}>
            No published items yet. Your supplier publishes items from their Materials list.
          </Text>
        ) : (
          catalog.map((item) => {
            const net = Number(item.rate);
            const mrp = item.mrp != null ? Number(item.mrp) : null;
            const disc = item.discountPct != null ? Number(item.discountPct) : 0;
            const qty = cart[item.id] ?? 0;
            const initial = (item.name || '?').trim().charAt(0).toUpperCase();
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.thumb}>
                    <Text style={styles.thumbText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.muted}>
                      {item.sku ? `${item.sku} · ` : ''}
                      {item.category ? `${item.category} · ` : ''}
                      {item.unit}
                    </Text>
                    <View style={styles.priceRow}>
                      {mrp != null && mrp > net ? (
                        <Text style={styles.mrpStrike}>MRP {formatInr(mrp)}</Text>
                      ) : null}
                      <Text style={styles.price}>
                        {formatInr(net)}
                        <Text style={styles.priceUnit}> / {item.unit}</Text>
                      </Text>
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
                      {formatInr(Number(l.rate))} × {l.qty} = {formatInr(Number(l.rate) * l.qty)}
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
              <Text style={styles.subtotalValue}>{formatInr(cartTotal)}</Text>
            </View>
          </>
        )}

        <View style={styles.searchWrap}>
          <Text style={styles.inputIcon}>🔍</Text>
          <TextInput
            style={styles.inputFlex}
            value={orderQuery}
            onChangeText={setOrderQuery}
            placeholder="Search orders"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <Text style={[styles.sectionTitle, styles.sectionGapTight]}>Recent orders</Text>
        {filteredOrders.length === 0 ? (
          <Text style={styles.muted}>
            {orders.length === 0
              ? 'No orders yet. Place your first order from the cart.'
              : 'No orders match your search.'}
          </Text>
        ) : (
          <>
            {visibleOrders.map((item) => {
              const dateLabel = formatOrderDate(item);
              const tone = statusTone(item.status);
              const lineCount = item.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
              return (
                <View key={item.id} style={styles.orderCard}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>{item.soNumber}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        tone === 'confirmed' && styles.statusConfirmed,
                        tone === 'pending' && styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          tone === 'confirmed' && styles.statusConfirmedText,
                          tone === 'pending' && styles.statusPendingText,
                        ]}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                  {dateLabel ? <Text style={styles.orderDate}>{dateLabel}</Text> : null}
                  <View style={styles.orderDivider} />
                  <View style={styles.cardRow}>
                    <Text style={styles.muted}>
                      {lineCount || item.lines.length} item
                      {(lineCount || item.lines.length) === 1 ? '' : 's'}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.orderTotal}>{formatInr(Number(item.total))}</Text>
                      <Text style={styles.orderTotalLabel}>Total</Text>
                    </View>
                  </View>
                  {item.trackingRef ? (
                    <Text style={styles.muted}>
                      Ship: {item.carrier ?? '—'} · {item.trackingRef}
                    </Text>
                  ) : null}
                  {item.lines.slice(0, 3).map((l, idx) => (
                    <Text key={idx} style={styles.line}>
                      • {l.itemName} × {String(l.quantity)} {l.unit}
                    </Text>
                  ))}
                  {item.lines.length > 3 ? (
                    <Text style={styles.line}>+{item.lines.length - 3} more lines</Text>
                  ) : null}
                </View>
              );
            })}
            {filteredOrders.length > RECENT_LIMIT ? (
              <Pressable style={styles.btnGhost} onPress={() => setShowAllOrders((v) => !v)}>
                <Text style={styles.btnGhostText}>
                  {showAllOrders
                    ? 'Show recent only'
                    : `Show all orders (${filteredOrders.length})`}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        <Pressable style={styles.accountCard} onPress={() => setAccountOpen((v) => !v)}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.muted}>Manage your account details and preferences.</Text>
          </View>
          <Text style={styles.chevron}>{accountOpen ? '▴' : '▾'}</Text>
        </Pressable>
        {accountOpen && profile ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.muted}>
              Details prefilled by your supplier. Edit anything that needs updating.
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
                Payment terms (set by supplier): {profile.paymentTerms}
              </Text>
            ) : null}
            <Pressable style={styles.btnPrimary} onPress={saveProfile} disabled={busy}>
              <Text style={styles.btnPrimaryText}>Save profile</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {cartCount > 0 ? (
        <Pressable style={styles.stickyFooter} onPress={placeOrder} disabled={busy}>
          <Text style={styles.stickyLeft}>
            Cart · {cartCount} item{cartCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.stickyMid}>{formatInr(cartTotal)}</Text>
          <Text style={styles.stickyRight}>{busy ? '…' : 'Place order ›'}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  padWithFooter: { paddingBottom: 100 },

  brandMark: {
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FBBF24',
  },
  brandMarkJ: { color: NAVY, fontWeight: '900' },

  authHero: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  authHeroRow: { flexDirection: 'row', alignItems: 'center' },
  authHeroTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  authHeroTag: { color: '#CBD5E1', fontSize: 13, marginTop: 2 },
  authHeroCurve: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 18,
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  authPad: { padding: 20, paddingBottom: 40 },
  authHeading: {
    fontSize: 28,
    fontWeight: '900',
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 8,
  },
  authSub: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  authSwitch: { marginTop: 20, alignItems: 'center', gap: 4 },
  mutedCenter: { color: '#64748B', fontSize: 13, textAlign: 'center' },
  linkUnderline: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  secureNote: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secureNoteIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    color: '#64748B',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    lineHeight: 18,
  },
  secureNoteText: { color: '#94A3B8', fontSize: 12, flexShrink: 1 },

  topBar: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarBrand: { color: '#fff', fontSize: 20, fontWeight: '800' },
  topBarBrandAccent: { color: AMBER },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topBarLogout: { color: '#E2E8F0', fontWeight: '700', fontSize: 13 },
  cartBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartBadgeText: { color: NAVY, fontWeight: '800', fontSize: 12 },
  topBarCurve: {
    height: 14,
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -1,
  },

  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  partyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyIconText: { fontSize: 16 },
  partyName: { fontSize: 15, fontWeight: '800', color: NAVY },
  partySub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  roleChip: {
    borderWidth: 1.5,
    borderColor: AMBER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFBEB',
  },
  roleChipText: { fontSize: 11, fontWeight: '700', color: AMBER },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 },
  sectionHint: { color: '#64748B', fontSize: 13, marginBottom: 12 },
  sectionGap: { marginTop: 28 },
  sectionGapTight: { marginTop: 16 },

  label: { fontSize: 12, fontWeight: '700', color: NAVY, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    marginTop: 28,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputIcon: { fontSize: 14, marginRight: 8, color: '#94A3B8' },
  inputFlex: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },

  btnPrimary: {
    marginTop: 16,
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: NAVY, fontWeight: '800', fontSize: 16 },
  btnAdd: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  btnAddText: { color: NAVY, fontWeight: '800' },
  btnGhost: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  btnGhostText: { color: NAVY, fontWeight: '700' },

  err: { color: '#DC2626', marginBottom: 8, marginTop: 8 },
  success: {
    color: '#047857',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    marginTop: 8,
    fontWeight: '600',
    fontSize: 13,
  },
  consentBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: NAVY, borderColor: NAVY },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  consentText: { fontSize: 12, color: '#0F172A', lineHeight: 17 },
  linkInline: { color: AMBER, fontWeight: '700' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: NAVY },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  thumbText: { fontSize: 20, fontWeight: '800', color: NAVY },
  prefill: { fontSize: 15, color: '#0F172A', marginBottom: 4 },
  line: { fontSize: 12, color: '#334155', marginTop: 2 },
  muted: { color: '#64748B', fontSize: 13, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  price: { fontSize: 16, fontWeight: '800', color: AMBER },
  priceUnit: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
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
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: AMBER, fontSize: 20, fontWeight: '800', lineHeight: 22 },
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
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
  },
  statusPillText: { fontSize: 11, fontWeight: '700', color: NAVY, textTransform: 'capitalize' },
  statusConfirmed: { backgroundColor: AMBER },
  statusConfirmedText: { color: '#fff' },
  statusPending: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#FDE68A' },
  statusPendingText: { color: AMBER },
  orderDate: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  orderDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  orderTotal: { fontSize: 15, fontWeight: '800', color: NAVY },
  orderTotalLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'right' },

  accountCard: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: { fontSize: 16 },
  chevron: { color: NAVY, fontSize: 18, fontWeight: '700' },

  stickyFooter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  stickyLeft: { flex: 1.2, fontSize: 13, fontWeight: '800', color: NAVY },
  stickyMid: { flex: 1, fontSize: 15, fontWeight: '900', color: NAVY, textAlign: 'center' },
  stickyRight: { flex: 1.1, fontSize: 13, fontWeight: '800', color: NAVY, textAlign: 'right' },
});
