import { shouldAllowMasterOtp } from '../../services/otp.service';

describe('master OTP destination gate', () => {
  const demoList = '+919900000001,+919876543210';

  it('allows any destination in NODE_ENV=test (integration suites)', () => {
    expect(
      shouldAllowMasterOtp({
        destination: '+918886207123',
        nodeEnv: 'test',
        masterEnabled: true,
        masterCode: '111111',
        testPhones: demoList,
      }),
    ).toBe(true);
  });

  it('allows only OTP_TEST_PHONES outside test', () => {
    expect(
      shouldAllowMasterOtp({
        destination: '+919900000001',
        nodeEnv: 'development',
        masterEnabled: true,
        masterCode: '111111',
        testPhones: demoList,
      }),
    ).toBe(true);
    expect(
      shouldAllowMasterOtp({
        destination: '9876543210',
        nodeEnv: 'production',
        masterEnabled: true,
        masterCode: '111111',
        testPhones: demoList,
      }),
    ).toBe(true);
  });

  it('rejects real shop numbers outside test (e.g. Creamy Kulfi login)', () => {
    expect(
      shouldAllowMasterOtp({
        destination: '+918886207123',
        nodeEnv: 'development',
        masterEnabled: true,
        masterCode: '111111',
        testPhones: demoList,
      }),
    ).toBe(false);
    expect(
      shouldAllowMasterOtp({
        destination: '8886207123',
        nodeEnv: 'production',
        masterEnabled: true,
        masterCode: '111111',
        testPhones: demoList,
      }),
    ).toBe(false);
  });

  it('rejects everyone when master OTP is disabled', () => {
    expect(
      shouldAllowMasterOtp({
        destination: '+919900000001',
        nodeEnv: 'development',
        masterEnabled: false,
        masterCode: '111111',
        testPhones: demoList,
      }),
    ).toBe(false);
  });
});
