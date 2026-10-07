/**
 * Icecream-inventory-buyer - join via invite code, OTP login, catalog/cart/orders, profile.
 * Catalog = manufacturer item master rows marked b2bPublished.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
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
};

type CatalogItem = {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  rate: string | number;
  category?: string | null;
};

type Order = {
  id: string;
  soNumber: string;
  status: string;
  total: string | number;
  carrier?: string | null;
  trackingRef?: string | null;
  shippedAt?: string | null;
  lines: Array<{ itemName: string; quantity: string | number; unit: string }>;
};

type Tab = 'catalog' | 'cart' | 'orders' | 'profile';
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

export default function BuyerHome() {
  const [token, setToken] = useState<string | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('join');
  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [tab, setTab] = useState<Tab>('catalog');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
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
      // Code only — name/email/phone come from the owner-prefilled invite.
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
    setBusy(true);
    setError('');
    try {
      await buyerFetch('/buyer/orders', {
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
      setTab('orders');
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
                    You can edit these after joining under Profile.
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brandSmall}>Icecream-inventory-buyer</Text>
          <Text style={styles.muted}>{buyer?.companyName ?? 'Catalog'}</Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.link}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['catalog', 'cart', 'orders', 'profile'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'cart' ? `Cart (${cartLines.length})` : t[0]!.toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={[styles.err, styles.pad]}>{error}</Text> : null}

      {tab === 'catalog' ? (
        <FlatList
          data={catalog}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.pad}
          ListEmptyComponent={
            <Text style={styles.muted}>
              No published items yet. Your manufacturer publishes items from their Materials list.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.sku ? `${item.sku} · ` : ''}₹{Number(item.rate).toFixed(2)} / {item.unit}
              </Text>
              <Pressable
                style={styles.btnSmall}
                onPress={() => setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))}
              >
                <Text style={styles.btnText}>Add</Text>
              </Pressable>
            </View>
          )}
        />
      ) : null}

      {tab === 'cart' ? (
        <ScrollView contentContainerStyle={styles.pad}>
          {cartLines.length === 0 ? (
            <Text style={styles.muted}>Cart is empty. Add items from Catalog.</Text>
          ) : (
            <>
              {cartLines.map((l) => (
                <View key={l.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {l.name} × {l.qty}
                  </Text>
                  <Text style={styles.muted}>₹{(Number(l.rate) * l.qty).toFixed(2)}</Text>
                </View>
              ))}
              <Pressable style={styles.btn} onPress={placeOrder} disabled={busy}>
                <Text style={styles.btnText}>Place order</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      ) : null}

      {tab === 'orders' ? (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.pad}
          ListEmptyComponent={<Text style={styles.muted}>No orders yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.soNumber}</Text>
              <Text style={styles.muted}>
                {item.status} · ₹{Number(item.total).toFixed(2)}
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
            </View>
          )}
        />
      ) : null}

      {tab === 'profile' && profile ? (
        <ScrollView contentContainerStyle={styles.pad}>
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
          {profile.paymentTerms ? (
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Payment terms (set by manufacturer): {profile.paymentTerms}
            </Text>
          ) : null}
          <Pressable style={styles.btn} onPress={saveProfile} disabled={busy}>
            <Text style={styles.btnText}>Save profile</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  pad: { padding: 16 },
  brand: { fontSize: 28, fontWeight: '800', color: NAVY, marginBottom: 4 },
  brandSmall: { fontSize: 16, fontWeight: '800', color: NAVY },
  muted: { color: '#64748B', fontSize: 13, marginBottom: 8 },
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
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  err: { color: '#DC2626', marginTop: 8 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { color: AMBER, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: NAVY },
  prefill: { fontSize: 15, color: '#0F172A', marginBottom: 4 },
  line: { fontSize: 12, color: '#334155', marginTop: 2 },
});
