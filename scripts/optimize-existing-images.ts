/**
 * Dry-run script for existing image optimization backlog.
 * Usage:
 *   npx tsx scripts/optimize-existing-images.ts
 *   npx tsx scripts/optimize-existing-images.ts --apply
 */
import { db } from "../lib/prisma";

const apply = process.argv.includes("--apply");

async function main() {
  const products = await db.product.findMany({
    where: {
      imageUrl: { not: null },
    },
    select: {
      id: true,
      imageUrl: true,
      companyId: true,
    },
    take: 500,
  });

  const companies = await db.company.findMany({
    where: {
      logoUrl: { not: null },
    },
    select: {
      id: true,
      logoUrl: true,
    },
    take: 200,
  });

  const candidates = [
    ...products.map((item) => ({
      type: "product",
      id: item.id,
      companyId: item.companyId,
      url: item.imageUrl,
    })),
    ...companies.map((item) => ({
      type: "company-logo",
      id: item.id,
      companyId: item.id,
      url: item.logoUrl,
    })),
  ].filter((item) => item.url && !item.url.endsWith(".webp"));

  console.log(`Candidates: ${candidates.length}`);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);

  if (!apply) {
    console.log("Re-run with --apply after DB/storage backup.");
    return;
  }

  console.log("Apply mode is not automated yet. Use new uploads for WebP optimization.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
