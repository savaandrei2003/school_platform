module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  // RootDir setat la rădăcina proiectului, nu doar la /src
  rootDir: '.', 
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  // Această linie este crucială pentru a vedea folderul /test
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
};