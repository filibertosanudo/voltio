/**
 * Creates the first owner account of a real shop (the seed is for demos).
 *
 *   npm run owner:create -- "Mariana Robles" mariana@example.com
 *
 * Prints a temporary password once. Only its hash is stored.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createStaff } from "@/lib/team/team-service";

async function main(): Promise<void> {
  const [name, email] = process.argv.slice(2);
  if (!name || !email || !email.includes("@")) {
    console.error('Usage: npm run owner:create -- "Full Name" email@example.com');
    process.exitCode = 1;
    return;
  }
  const password = await createStaff({ name, email, role: "OWNER" });
  console.log(`Owner account created for ${email}`);
  console.log(`Temporary password (shown once): ${password}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
