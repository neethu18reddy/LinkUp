import { Prisma } from '../generated/prisma/client.js';

// Prisma's PostgreSQL adapter can surface COMMIT serialization failures directly,
// before they are wrapped in a PrismaClientKnownRequestError.
export function isTransactionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return ['P2034', 'P2002'].includes(error.code);
  if (
    typeof error !== 'object' ||
    error === null ||
    !('name' in error) ||
    error.name !== 'DriverAdapterError' ||
    !('cause' in error)
  )
    return false;
  const cause = error.cause;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'kind' in cause &&
    cause.kind === 'TransactionWriteConflict'
  );
}
