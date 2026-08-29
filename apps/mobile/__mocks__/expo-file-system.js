module.exports = {
  documentDirectory: '/mock/docs/',
  cacheDirectory: '/mock/cache/',
  downloadAsync: jest.fn().mockResolvedValue({ uri: '/mock/download' }),
};
