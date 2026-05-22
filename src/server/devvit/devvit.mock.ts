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

const PREVIEW_COUNT = 12;

function commentIdForIndex(index: number): `t1_${string}` {
  return `t1_comment${String(index).padStart(2, '0')}` as `t1_${string}`;
}

function postIdForIndex(index: number): `t3_${string}` {
  return `t3_post${String(index).padStart(2, '0')}` as `t3_${string}`;
}

function picsumUrl(seed: number): string {
  return `https://picsum.photos/seed/kudos-${seed}/1200/800`;
}

const mockSaveMembers = Array.from({ length: PREVIEW_COUNT }, (_, index) => {
  const saveIndex = index + 1;
  return {
    member: `${commentIdForIndex(saveIndex)}-t2_test`,
    score: saveIndex,
  };
});

const db: Record<string, DbValue> = {
  meta: {
    current: 't3_commenteer',
  },
  't3_commenteer:seq': String(PREVIEW_COUNT),
  ...Object.fromEntries(
    mockSaveMembers.map(({ member }) => [
      member,
      {
        data: '{}',
        owner: 't2_test',
      },
    ])
  ),
};

const sortedSets: Record<string, SortedSetEntry[]> = {
  t3_commenteer: mockSaveMembers,
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

function parseCommentIndex(commentId: string): number {
  const match = commentId.match(/^t1_comment(\d+)$/);
  return match?.[1] ? Number.parseInt(match[1], 10) : 1;
}

function parsePostIndex(postId: string): number {
  const match = postId.match(/^t3_post(\d+)$/);
  return match?.[1] ? Number.parseInt(match[1], 10) : 1;
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
        postId: postIdForIndex(1),
        parentId: postIdForIndex(1),
        body: 'Anyone else think cassowaries are underrated?',
        authorId: 't2_parent',
        authorName: 'parent_user',
      } as unknown as Comment;
    }

    const index = parseCommentIndex(commentId);

    return {
      id: commentId,
      postId: postIdForIndex(index),
      parentId: index % 2 === 0 ? 't1_parent123' : postIdForIndex(index),
      body: `Save #${index}: cassowary has entered the chat`,
      authorId: 't2_author',
      authorName: `test_user_${index}`,
    } as unknown as Comment;
  },
  getPostById: async (postId: `t3_${string}`): Promise<Post> => {
    const index = parsePostIndex(postId);

    return {
      id: postId,
      title: `Test post ${index}`,
      getEnrichedThumbnail: async (): Promise<EnrichedThumbnail | undefined> =>
        ({
          image: { url: picsumUrl(100 + index) },
        }) as EnrichedThumbnail,
    } as Post;
  },
  getUserById: async (authorId: `t2_${string}`): Promise<User | undefined> =>
    ({
      id: authorId,
      getSnoovatarUrl: async () => {
        const suffix = Number.parseInt(authorId.replace(/\D/g, ''), 10) || 0;
        return picsumUrl(9100 + (suffix % 100));
      },
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
