import {
  isSyntheticPhoneEmail,
  myProfileUpdateSchema,
  profileContactOtpSchema,
} from '../validators/settings';

describe('profile contact helpers', () => {
  it('detects synthetic phone emails', () => {
    expect(isSyntheticPhoneEmail('u.919876543210@phone.buildflow.local')).toBe(true);
    expect(isSyntheticPhoneEmail('owner@frostycups.com')).toBe(false);
    expect(isSyntheticPhoneEmail(null)).toBe(false);
  });

  it('rejects synthetic email in profile update schema', () => {
    const parsed = myProfileUpdateSchema.safeParse({
      email: 'u.91@phone.buildflow.local',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts real email + otp fields', () => {
    const parsed = myProfileUpdateSchema.safeParse({
      email: 'owner@example.com',
      emailOtp: '111111',
      name: 'Owner',
    });
    expect(parsed.success).toBe(true);
  });

  it('validates contact-otp payload', () => {
    expect(
      profileContactOtpSchema.safeParse({
        channel: 'email',
        destination: 'a@b.com',
      }).success,
    ).toBe(true);
    expect(
      profileContactOtpSchema.safeParse({
        channel: 'sms',
        destination: '+919876543210',
      }).success,
    ).toBe(true);
  });
});
