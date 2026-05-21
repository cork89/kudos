import type {
  Comment,
  Context,
  EnrichedThumbnail,
  Post,
  User,
} from '@devvit/web/server';

const context: Context = {
  userId: 't2_test',
  subredditName: 'ssr_test2_dev',
} as unknown as Context;

type DbValue = Record<string, string> | string | Post | Comment | User;

const db: Record<string, DbValue> = {
  t2_test: {
    posts: '["t3_abc123-t1_commentId"]',
  },
  't3_abc123-t1_commentId': {
    data: '{}',
    owner: 't2_test',
  },
};

const reddit = {
  submitCustomPost: async ({ title }: { title: string }) => ({
    id: 'abc123',
    title,
  }),
  getCommentById: async (commentId: `t1_${string}`): Promise<Comment> =>
    ({
      id: commentId,
      postId: 't3_abc123',
      body: 'cassowary has entered the chat',
      authorId: 't2_author',
      authorName: 'test',
    }) as unknown as Comment,
  getPostById: async (postId: `t3_${string}`): Promise<Post> =>
    ({
      id: postId,
      title: 'Test post',
      getEnrichedThumbnail: async (): Promise<EnrichedThumbnail | undefined> =>
        ({ image: { url: 'bird.webp' } }) as EnrichedThumbnail,
    }) as Post,
  getUserById: async (authorId: `t2_${string}`): Promise<User | undefined> =>
    ({
      id: authorId,
      getSnoovatarUrl: async () => 'avatar_default.webp',
    }) as User,
};

async function hSet(key: string, obj: Record<string, string>): Promise<number> {
  const existing = db[key];
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    db[key] = { ...obj };
  } else {
    Object.assign(existing as Record<string, string>, obj);
  }
  return 1;
}

async function hGet(key: string, subkey: string): Promise<string | undefined> {
  const existing = db[key];
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return undefined;
  }
  return (existing as Record<string, string>)[subkey];
}

async function get(key: string): Promise<string | undefined> {
  const existing = db[key];
  return typeof existing === 'string' ? existing : undefined;
}

async function set(key: string, value: string): Promise<boolean> {
  db[key] = value;
  return true;
}

const redis = {
  hSet,
  hGet,
  get,
  set,
  hGetAll: async (key: string) => {
    const existing = db[key];
    return existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, string>)
      : {};
  },
  zRange: async () => [],
  zIncrBy: async () => undefined,
  zScore: async () => -1,
  zRem: async () => undefined,
  incrBy: async () => undefined,
};

const createServer = (_handler: unknown) => ({
  on: () => undefined,
  listen: () => undefined,
});

function getServerPort() {
  return 3000;
}

console.log('using devvit mocks');

export { createServer, context, getServerPort, reddit, redis };
