/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json'}],
  },
  moduleNameMapper: {
    '^@m3/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json'}],
      },
      moduleNameMapper: {
        '^@m3/shared$': '<rootDir>/../../packages/shared/src/index.ts',
      },
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/setup/env.ts'],
      globalSetup: '<rootDir>/test/setup/global-setup.ts',
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json'}],
      },
      moduleNameMapper: {
        '^@m3/shared$': '<rootDir>/../../packages/shared/src/index.ts',
      },
    },
  ],
};
