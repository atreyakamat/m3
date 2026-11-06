import * as schema from './schema';

export function getDb(): any {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => [],
        }),
        all: () => [],
      }),
    }),
    insert: () => ({
      values: () => ({
        run: () => {},
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: () => {},
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        run: () => {},
      }),
    }),
  };
}

export { schema };
