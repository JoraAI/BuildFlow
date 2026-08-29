module.exports = {
  Platform: {
    OS: 'web',
    select: (obj) => obj.web || obj.default,
  },
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
  },
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 1024, height: 768 })),
  },
  Alert: {
    alert: jest.fn(),
  },
};
