// Prisma client stub — legacy API routes reference this but we use Supabase now.
// Will be removed once all routes are migrated.
export const prisma: any = new Proxy(
  {},
  {
    get: () =>
      new Proxy(
        {},
        {
          get: () => async () => {
            throw new Error("Prisma is not configured — use Supabase instead");
          },
        }
      ),
  }
);
