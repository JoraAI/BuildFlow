/**
 * BuildFlow - Unit tests for Powerplay Parity field operations & helpers.
 */
import { t, translations, SUPPORTED_LANGUAGES } from '@/constants/i18n';
import {
  generateWhatsAppPettyCashShare,
  generateWhatsAppLaborWageShare,
  generateWhatsAppDailyReportShare,
  generateWhatsAppQuoteShare,
} from '@/utils/whatsapp-share';
import { subscribeSyncProgress } from '@/services/offline-sync.service';
import { Linking, Platform } from 'react-native';
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
} from '@buildflow/shared';

describe('Powerplay Parity - Vernacular Localization (Module 3)', () => {
  it('supports 10+ Indian regional languages in registry', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('hi'); // Hindi
    expect(codes).toContain('ta'); // Tamil
    expect(codes).toContain('te'); // Telugu
    expect(codes).toContain('kn'); // Kannada
    expect(codes).toContain('mr'); // Marathi
    expect(codes).toContain('bn'); // Bengali
    expect(codes).toContain('gu'); // Gujarati
    expect(codes).toContain('ml'); // Malayalam
    expect(codes).toContain('pa'); // Punjabi
  });

  it('translates navigation keys and labels into Hindi and Tamil', () => {
    expect(t('Dashboard', 'hi')).toBe('डैशबोर्ड');
    expect(t('Projects', 'hi')).toBe('परियोजनाएं');
    expect(t('Procurement', 'ta')).toBe('கொள்முதல்');
    expect(t('Overview', 'ta')).toBe('மேலோட்டம்');
  });

  it('falls back to English when translation key is missing in target language', () => {
    expect(t('common.create', 'en')).toBe('Create');
  });
});

describe('Powerplay Parity - WhatsApp Studio Utility (Module 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true as never));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates rich formatted WhatsApp message for petty cash', () => {
    generateWhatsAppPettyCashShare({
      entryNumber: 'PC-2026-001',
      amount: 1500,
      category: 'Fuel/DG',
      description: '20L Diesel for Generator',
      paidTo: 'Indian Oil Corp',
      status: 'APPROVED',
      projectName: 'Skyline Heights Tower A',
    });

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(calledUrl)).toContain('BUILDFLOW SITE EXPENSE VOUCHER');
    expect(decodeURIComponent(calledUrl)).toContain('PC-2026-001');
    expect(decodeURIComponent(calledUrl)).toContain('20L Diesel for Generator');
  });

  it('generates formatted weekly wage slip for WhatsApp', () => {
    generateWhatsAppLaborWageShare({
      projectName: 'Metro Rail Station',
      workerName: 'Ramesh Kumar Gang',
      trade: 'Masons',
      daysWorked: 6,
      dailyRate: 950,
      otHours: 4,
      netPay: 6180,
      weekEnding: 'Saturday 29 Aug',
    });

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0];
    expect(decodeURIComponent(calledUrl)).toContain('BUILDFLOW WEEKLY WAGE SLIP');
    expect(decodeURIComponent(calledUrl)).toContain('Ramesh Kumar Gang (Masons)');
  });

  it('generates formatted daily progress report for WhatsApp', () => {
    generateWhatsAppDailyReportShare({
      projectName: 'Skyline Heights',
      reportDate: '29 Aug 2026',
      workDoneSummary: 'Poured 40 cum M25 concrete for 3rd floor slab.',
      laborCount: 45,
      weather: 'Sunny (32°C)',
    });

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0];
    expect(decodeURIComponent(calledUrl)).toContain('DAILY PROGRESS REPORT (DPR)');
    expect(decodeURIComponent(calledUrl)).toContain('45 workers');
  });

  it('generates rich event quotation for WhatsApp', () => {
    generateWhatsAppQuoteShare({
      quoteNumber: 'QT-2026-004',
      customerName: 'Grand Hyatt Events',
      eventName: 'Annual Gala Stage Lighting',
      quoteDate: '2026-08-30',
      validUntil: '2026-09-15',
      items: [
        { name: 'Warm White LED Bulb 9W', qty: 50, unit: 'nos', rate: 110, amount: 5500 },
        { name: 'Vintage Edison Filament Bulb', qty: 20, unit: 'nos', rate: 280, amount: 5600 },
      ],
      total: 13098,
    });

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0];
    expect(decodeURIComponent(calledUrl)).toContain('EVENT ESTIMATE & QUOTATION');
    expect(decodeURIComponent(calledUrl)).toContain('QT-2026-004');
    expect(decodeURIComponent(calledUrl)).toContain('Grand Hyatt Events');
    expect(decodeURIComponent(calledUrl)).toContain('Annual Gala Stage Lighting');
    expect(decodeURIComponent(calledUrl)).toContain('13,098');
  });
});

describe('Inventory Quotes Localization & Translations', () => {
  it('translates quotes tab into multiple regional languages', () => {
    expect(t('inventory.tab.quotes', 'hi')).toBe('कोट्स');
    expect(t('inventory.tab.quotes', 'te')).toBe('కోట్స్');
    expect(t('inventory.tab.quotes', 'ta')).toBe('மேற்கோள்கள்');
    expect(t('inventory.tab.quotes', 'mr')).toBe('कोटेशन');
  });
});

describe('Powerplay Parity - Labor Muster & DPR Sync (Module 6)', () => {
  it('persists and retrieves daily labor muster for DPR linking', async () => {
    const { useLaborMusterStore } = require('../stores/labor-muster.store');
    const store = useLaborMusterStore.getState();

    await store.setMuster({
      projectId: 'proj-123',
      date: '2026-08-29',
      totalHeadcount: 45,
      totalOtHours: 14.5,
      totalEstimatedWage: 38200,
      trades: [
        { id: 't1', trade: 'Masons', headcount: 12, otHours: 4, dailyRate: 950 },
        { id: 't2', trade: 'Carpenters', headcount: 8, otHours: 4, dailyRate: 900 },
        { id: 't3', trade: 'Helpers', headcount: 22, otHours: 6.5, dailyRate: 600 },
        { id: 't4', trade: 'Electricians', headcount: 3, otHours: 0, dailyRate: 1000 },
      ],
      updatedAt: '2026-08-29T08:30:00.000Z',
    });

    const muster = useLaborMusterStore.getState().getMuster('proj-123', '2026-08-29');
    expect(muster).toBeDefined();
    expect(muster?.totalHeadcount).toBe(45);
    expect(muster?.totalOtHours).toBe(14.5);
    expect(muster?.trades.length).toBe(4);
  });
});

describe('Powerplay Parity - Universal Offline Sync (Module 2)', () => {
  it('allows subscribing to sync progress updates', () => {
    let capturedProgress = null;
    const unsub = subscribeSyncProgress((p) => {
      capturedProgress = p;
    });

    expect(capturedProgress).not.toBeNull();
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

describe('Powerplay Parity - Permissions Tagging & Role-Based Access Control', () => {
  it('includes all newly added permissions in the canonical catalog', () => {
    expect(PERMISSIONS['petty_cash.view']).toBeDefined();
    expect(PERMISSIONS['petty_cash.create']).toBeDefined();
    expect(PERMISSIONS['petty_cash.approve']).toBeDefined();

    expect(PERMISSIONS['drawing.view']).toBeDefined();
    expect(PERMISSIONS['drawing.upload']).toBeDefined();
    expect(PERMISSIONS['drawing.manage']).toBeDefined();

    expect(PERMISSIONS['snag.view']).toBeDefined();
    expect(PERMISSIONS['snag.create']).toBeDefined();
    expect(PERMISSIONS['snag.rectify']).toBeDefined();

    expect(PERMISSIONS['labor.view']).toBeDefined();
    expect(PERMISSIONS['labor.muster_edit']).toBeDefined();
    expect(PERMISSIONS['labor.wage_settle']).toBeDefined();
  });

  it('includes new modules in PERMISSION_GROUPS for UI rendering', () => {
    const groupLabels = PERMISSION_GROUPS.map((g) => g.label);
    expect(groupLabels).toContain('Site Petty Cash');
    expect(groupLabels).toContain('Drawings & Blueprints');
    expect(groupLabels).toContain('Snag List & Quality NCRs');
    expect(groupLabels).toContain('Labor Muster & Wages');

    const pettyGroup = PERMISSION_GROUPS.find((g) => g.label === 'Site Petty Cash');
    expect(pettyGroup?.permissions).toEqual([
      'petty_cash.view',
      'petty_cash.create',
      'petty_cash.approve',
    ]);
  });

  it('assigns correct default permissions to roles', () => {
    // OWNER has full access to all permissions
    expect(DEFAULT_ROLE_PERMISSIONS.OWNER).toContain('petty_cash.approve');
    expect(DEFAULT_ROLE_PERMISSIONS.OWNER).toContain('drawing.manage');
    expect(DEFAULT_ROLE_PERMISSIONS.OWNER).toContain('snag.rectify');
    expect(DEFAULT_ROLE_PERMISSIONS.OWNER).toContain('labor.wage_settle');

    // PM has management & approval rights
    expect(DEFAULT_ROLE_PERMISSIONS.PM).toContain('petty_cash.approve');
    expect(DEFAULT_ROLE_PERMISSIONS.PM).toContain('drawing.upload');
    expect(DEFAULT_ROLE_PERMISSIONS.PM).toContain('snag.rectify');
    expect(DEFAULT_ROLE_PERMISSIONS.PM).toContain('labor.wage_settle');

    // Site Supervisor can create snags and log petty cash/muster but cannot settle payroll or manage blueprints
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).toContain('petty_cash.create');
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).toContain('drawing.view');
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).toContain('snag.create');
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).toContain('labor.muster_edit');
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).not.toContain('petty_cash.approve');
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).not.toContain('labor.wage_settle');
    expect(DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR).not.toContain('drawing.manage');

    // Accountant has petty cash & wage settlement rights
    expect(DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT).toContain('petty_cash.approve');
    expect(DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT).toContain('labor.wage_settle');
    expect(DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT).not.toContain('drawing.upload');
    expect(DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT).not.toContain('snag.create');
  });
});

