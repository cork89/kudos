import type {
  Comment,
  Context,
  EnrichedThumbnail,
  Post,
  User,
} from '@devvit/web/server';

const context: Context = {
  userId: 't2_test',
  postId: 't3_commenteer',
  subredditName: 'ssr_test2_dev',
} as unknown as Context;

type DbValue = Record<string, string> | string | Post | Comment | User;
type SortedSetEntry = { member: string; score: number };

const db: Record<string, DbValue> = {
  meta: {
    current: 't3_commenteer',
  },
  't3_commenteer:seq': '1',
  't1_commentId-t2_test': {
    data: '{}',
    owner: 't2_test',
  },
};

const sortedSets: Record<string, SortedSetEntry[]> = {
  t3_commenteer: [{ member: 't1_commentId-t2_test', score: 1 }],
};

function getSortedSet(key: string): SortedSetEntry[] {
  if (!sortedSets[key]) {
    sortedSets[key] = [];
  }
  return sortedSets[key];
}

function sortByRank(entries: SortedSetEntry[]): SortedSetEntry[] {
  return [...entries].sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.member.localeCompare(b.member);
  });
}

const reddit = {
  submitCustomPost: async ({ title }: { title: string }) => ({
    id: 'abc123',
    title,
  }),
  getCommentById: async (commentId: `t1_${string}`): Promise<Comment> => {
    if (commentId === 't1_parent123') {
      return {
        id: commentId,
        postId: 't3_abc123',
        parentId: 't3_abc123',
        body: 'Anyone else think cassowaries are underrated?',
        authorId: 't2_parent',
        authorName: 'parent_user',
      } as unknown as Comment;
    }

    return {
      id: commentId,
      postId: 't3_abc123',
      parentId: 't1_parent123',
      body: 'cassowary has entered the chat',
      authorId: 't2_author',
      authorName: 'test',
    } as unknown as Comment;
  },
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
      getSnoovatarUrl: async () =>
        authorId === 't2_parent' ? 'avatar_parent.webp' : 'avatar_default.webp',
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

async function zAdd(
  key: string,
  ...entries: SortedSetEntry[]
): Promise<number> {
  const set = getSortedSet(key);
  let added = 0;

  for (const entry of entries) {
    const existing = set.find((item) => item.member === entry.member);
    if (existing) {
      existing.score = entry.score;
    } else {
      set.push({ ...entry });
      added += 1;
    }
  }

  return added;
}

async function zCard(key: string): Promise<number> {
  return getSortedSet(key).length;
}

async function zRange(
  key: string,
  start: number,
  stop: number,
  options?: { by?: 'rank' | 'score' | 'lex' }
): Promise<SortedSetEntry[]> {
  const by = options?.by ?? 'rank';
  const set = getSortedSet(key);

  if (by === 'rank') {
    const sorted = sortByRank(set);
    const normalizedStart =
      start < 0 ? Math.max(sorted.length + start, 0) : start;
    const normalizedStop = stop < 0 ? Math.max(sorted.length + stop, 0) : stop;
    return sorted.slice(normalizedStart, normalizedStop + 1);
  }

  if (by === 'score') {
    const sorted = sortByRank(set);
    return sorted.filter(
      (entry) => entry.score >= start && entry.score <= stop
    );
  }

  return sortByRank(set);
}

async function zScore(
  key: string,
  member: string
): Promise<number | undefined> {
  const entry = getSortedSet(key).find((item) => item.member === member);
  return entry?.score;
}

async function zRem(key: string, members: string[]): Promise<number> {
  const set = getSortedSet(key);
  const before = set.length;
  sortedSets[key] = set.filter((entry) => !members.includes(entry.member));
  return before - sortedSets[key].length;
}

async function incrBy(key: string, increment: number): Promise<number> {
  const existing = db[key];
  const current =
    typeof existing === 'string' ? Number.parseInt(existing, 10) || 0 : 0;
  const next = current + increment;
  db[key] = String(next);
  return next;
}

const redis = {
  hSet,
  hGet,
  get,
  set,
  zAdd,
  zCard,
  zRange,
  zScore,
  zRem,
  hGetAll: async (key: string) => {
    const existing = db[key];
    return existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, string>)
      : {};
  },
  zIncrBy: async () => undefined,
  incrBy,
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
