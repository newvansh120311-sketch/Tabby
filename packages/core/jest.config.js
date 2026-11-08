module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\.ts$': ['@swc/jest'] },
};
