-- Login / forgot-password brute-force koruması (DB-backed, process/instance bağımsız)
CREATE TABLE "AuthRateLimit" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthRateLimit_scope_key_key" ON "AuthRateLimit"("scope", "key");

CREATE INDEX "AuthRateLimit_scope_lockedUntil_idx" ON "AuthRateLimit"("scope", "lockedUntil");
