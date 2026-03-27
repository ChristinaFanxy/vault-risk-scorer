import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // stub out recharts so Jest doesn't choke on ESM
    '^recharts$': '<rootDir>/__mocks__/recharts.ts',
  },
  setupFiles: ['<rootDir>/jest.env.ts'],
}

export default config
