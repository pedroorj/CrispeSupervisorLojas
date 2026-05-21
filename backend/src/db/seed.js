'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const prisma = require('./prismaClient');

async function main() {
  console.log('Seeding database...');

  // Default system config
  const configs = [
    { key: 'freeOnlyMode', value: 'true' },
    { key: 'allowTemplates', value: 'false' },
    { key: 'allowMarketing', value: 'false' },
    { key: 'allowOutboundWithoutCustomerMessage', value: 'false' },
    { key: 'allowMessagesAfter24h', value: 'false' },
    { key: 'allowBulkSend', value: 'false' },
    { key: 'allowAutomationOutbound', value: 'false' },
    { key: 'alertNewMessage', value: 'true' },
    { key: 'alertUnansweredAfterMinutes', value: '10' },
    { key: 'alertKeywords', value: JSON.stringify(['reclamação','problema','gerente','cancelar','devolver','troca','urgente']) },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }

  // Default owner user
  const hash = await bcrypt.hash('Admin@1234', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@example.com',
      passwordHash: hash,
      role: 'owner',
    },
  });

  console.log(`Owner user: ${owner.email} (change password immediately!)`);
  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
