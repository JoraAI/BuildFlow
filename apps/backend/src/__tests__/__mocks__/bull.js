/**
 * Mock for Bull queue - prevents Redis connections during tests.
 * Mapped via jest.config.js moduleNameMapper.
 * NOTE: Don't use jest.fn() - clearMocks:true resets them between tests.
 */
function createMockQueue() {
  return {
    add: () => Promise.resolve({ id: 'test-job' }),
    addBulk: () => Promise.resolve([]),
    process: () => {},
    on: () => {},
    close: () => Promise.resolve(undefined),
    getJobs: () => Promise.resolve([]),
    count: () => Promise.resolve(0),
    empty: () => Promise.resolve(undefined),
    pause: () => Promise.resolve(undefined),
    resume: () => Promise.resolve(undefined),
  };
}

module.exports = function BullMock() {
  return createMockQueue();
};