const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.profiles.findMany({
    where: { role: 'admin', deleted_at: null, is_demo: false },
    orderBy: { id: 'asc' },
    take: 5,
    select: { id: true, email: true, role: true },
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
