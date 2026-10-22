import { isOtpTestPhone, parseOtpTestPhones } from '../../lib/otp-test-phones';

describe('OTP test phones', () => {
  const list = '+919948648599, 09876543210';

  it('parses comma-separated numbers to last-10 keys', () => {
    expect([...parseOtpTestPhones(list)].sort()).toEqual(['9876543210', '9948648599']);
  });

  it('matches +91, 91, and bare 10-digit forms', () => {
    expect(isOtpTestPhone('+919948648599', list)).toBe(true);
    expect(isOtpTestPhone('919948648599', list)).toBe(true);
    expect(isOtpTestPhone('9948648599', list)).toBe(true);
  });

  it('does not match other numbers', () => {
    expect(isOtpTestPhone('9999999999', list)).toBe(false);
    expect(isOtpTestPhone('', list)).toBe(false);
  });
});
