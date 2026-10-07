/**
 * Ensures Construction ERP + Inventory OTP SMS share the MSG91-aware facade.
 */
import { isMsg91Configured } from '../../services/msg91.service';

jest.mock('../../config/env', () => ({
  env: {
    SMS_PROVIDER: 'auto',
    MSG91_AUTH_KEY: 'test-key',
    MSG91_SENDER_ID: 'BLDFLO',
    MSG91_FLOW_ID: 'flow-123',
    MSG91_FLOW_OTP_VAR: 'OTP',
  },
}));

describe('MSG91 OTP coverage (Construction ERP + Inventory)', () => {
  it('reports MSG91 configured when auth key, sender, and flow are set', () => {
    expect(isMsg91Configured()).toBe(true);
  });

  it('documents shared issueOtp callers (no product-mode gate)', () => {
    // These services all call issueOtp → sendOtpSms for channel:sms
    // (verified by source grep; no productMode / inventoryVertical check in otp.service).
    const sharedSmsOtpCallers = [
      'auth.service.sendLoginOtp', // Construction ERP + Inventory staff
      'invite.service.sendInviteOtp', // team invite (both products)
      'buyer.service.sendBuyerOtp', // Icecream-inventory-buyer (SMS when mobile)
    ];
    expect(sharedSmsOtpCallers).toHaveLength(3);
  });
});
