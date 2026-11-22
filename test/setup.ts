// Enough environment for a unit test to import a server module. Unit tests
// never open a connection; real values win if they are already set.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SECRET ??= "test-secret";
