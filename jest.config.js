module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/**/__tests__/**/*.ts'],
      preset: 'ts-jest',
      globals: {
        'ts-jest': {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
          },
        },
      },
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/client/**/__tests__/**/*.tsx', '<rootDir>/src/client/**/__tests__/**/*.ts'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
      preset: 'ts-jest',
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.client.json',
        },
      },
    },
  ],
};
