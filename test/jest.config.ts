import type { Config } from 'jest';

const config: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '..',
    testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.test.ts'],
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['<rootDir>/src/**/*.(t|j)s'],
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/', '<rootDir>/test/'],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1'
    },
};

export default config;
