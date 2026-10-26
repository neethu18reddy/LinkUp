import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Generation and schema validation work offline. Migration commands still need a live database.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://linkup:linkup_local_only@localhost:5432/linkup',
  },
});
