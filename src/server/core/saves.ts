import type { RedditContext } from '../../shared/types/api';

export function saveMember(commentId: string, userId: string): string {
  return `${commentId}-${userId}`;
}

export function parseSaveMember(
  member: string
): { commentId: string; userId: string } | null {
  const match = member.match(/^(t1_.+)-(t2_.+)$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    commentId: match[1],
    userId: match[2],
  };
}

export async function resolvePostId(
  ctx: RedditContext
): Promise<string | null> {
  if (ctx.context.postId) {
    return ctx.context.postId;
  }

  const current = await ctx.redis.hGet('meta', 'current');
  return current ?? null;
}

type SaveResult =
  | {
      status: 'ok';
      ownerId: string;
      member: string;
      commentId: string;
      postId: string;
    }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

function saveSequenceKey(postId: string): string {
  return `${postId}:seq`;
}

async function getNextSaveScore(
  ctx: RedditContext,
  postId: string
): Promise<number> {
  return ctx.redis.incrBy(saveSequenceKey(postId), 1);
}

export function canEditSave(ctx: RedditContext, ownerId: string): boolean {
  return Boolean(ctx.context.userId && ctx.context.userId === ownerId);
}

export type RecentSaveEntry = {
  ownerId: string;
  member: string;
  commentId: string;
  score: number;
};

type SortedSetEntry = { member: string; score: number };

async function parseSaveEntries(
  ctx: RedditContext,
  postId: string,
  rawEntries: SortedSetEntry[]
): Promise<RecentSaveEntry[]> {
  const saves: RecentSaveEntry[] = [];
  const invalidMembers: string[] = [];

  for (const entry of rawEntries) {
    const parsed = parseSaveMember(entry.member);
    if (!parsed) {
      invalidMembers.push(entry.member);
      continue;
    }

    saves.push({
      ownerId: parsed.userId,
      member: entry.member,
      commentId: parsed.commentId,
      score: entry.score,
    });
  }

  if (invalidMembers.length > 0) {
    await ctx.redis.zRem(postId, invalidMembers);
  }

  return saves;
}

export async function getRecentSaves(
  ctx: RedditContext,
  options: { limit?: number; before?: number } = {}
): Promise<
  | { status: 'ok'; postId: string; saves: RecentSaveEntry[] }
  | { status: 'empty'; message: string }
> {
  const limit = options.limit ?? 10;
  const postId = await resolvePostId(ctx);
  if (!postId) {
    return { status: 'empty', message: 'No active post.' };
  }

  const card = await ctx.redis.zCard(postId);
  if (card === 0) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  let rawEntries: SortedSetEntry[];
  if (options.before !== undefined) {
    if (!Number.isFinite(options.before)) {
      return { status: 'empty', message: 'Invalid cursor.' };
    }

    const older = await ctx.redis.zRange(postId, 0, options.before - 1, {
      by: 'score',
    });
    rawEntries = older.slice(Math.max(0, older.length - limit));
  } else {
    const start = Math.max(0, card - limit);
    rawEntries = await ctx.redis.zRange(postId, start, card - 1, {
      by: 'rank',
    });
  }

  const saves = await parseSaveEntries(ctx, postId, rawEntries);
  if (saves.length === 0) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  saves.reverse();

  return { status: 'ok', postId, saves };
}

export async function hasOlderSaves(
  ctx: RedditContext,
  postId: string,
  beforeScore: number
): Promise<boolean> {
  const older = await ctx.redis.zRange(postId, 0, beforeScore - 1, {
    by: 'score',
  });
  return older.length > 0;
}

export async function getLatestSave(ctx: RedditContext): Promise<SaveResult> {
  const recent = await getRecentSaves(ctx, { limit: 1 });
  if (recent.status !== 'ok') {
    return recent;
  }

  const save = recent.saves[0];
  if (!save) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  return {
    status: 'ok',
    ownerId: save.ownerId,
    member: save.member,
    commentId: save.commentId,
    postId: recent.postId,
  };
}

export async function getSaveByCommentId(
  ctx: RedditContext,
  commentId: string
): Promise<SaveResult> {
  const postId = await resolvePostId(ctx);
  if (!postId) {
    return { status: 'empty', message: 'No active post.' };
  }

  const card = await ctx.redis.zCard(postId);
  if (card === 0) {
    return { status: 'empty', message: 'Save not found.' };
  }

  const entries = await ctx.redis.zRange(postId, 0, card - 1, {
    by: 'rank',
  });
  const invalidMembers: string[] = [];

  for (let rank = entries.length - 1; rank >= 0; rank -= 1) {
    const entry = entries[rank];
    if (!entry) {
      continue;
    }

    const parsed = parseSaveMember(entry.member);
    if (!parsed) {
      invalidMembers.push(entry.member);
      continue;
    }

    if (parsed.commentId !== commentId) {
      continue;
    }

    if (invalidMembers.length > 0) {
      void ctx.redis.zRem(postId, invalidMembers);
    }

    return {
      status: 'ok',
      ownerId: parsed.userId,
      member: entry.member,
      commentId: parsed.commentId,
      postId,
    };
  }

  if (invalidMembers.length > 0) {
    void ctx.redis.zRem(postId, invalidMembers);
  }

  return { status: 'empty', message: 'Save not found.' };
}

export async function getSaveForEdit(
  ctx: RedditContext,
  commentId: string
): Promise<SaveResult> {
  const userId = ctx.context.userId;
  if (!userId) {
    return { status: 'error', message: 'No user found.' };
  }

  const postId = await resolvePostId(ctx);
  if (!postId) {
    return { status: 'empty', message: 'No active post.' };
  }

  const member = saveMember(commentId, userId);
  const score = await ctx.redis.zScore(postId, member);
  if (score === undefined) {
    return { status: 'empty', message: 'Save not found.' };
  }

  return {
    status: 'ok',
    ownerId: userId,
    member,
    commentId,
    postId,
  };
}

export async function isSaveStored(
  ctx: RedditContext,
  userId: string,
  commentId: string
): Promise<boolean> {
  const postId = await resolvePostId(ctx);
  if (!postId) {
    return false;
  }

  const member = saveMember(commentId, userId);
  const score = await ctx.redis.zScore(postId, member);
  return score !== undefined;
}

export async function storeSave(
  ctx: RedditContext,
  userId: string,
  commentId: string
): Promise<string | null> {
  const postId = await resolvePostId(ctx);
  if (!postId) {
    return null;
  }

  const member = saveMember(commentId, userId);
  const score = await getNextSaveScore(ctx, postId);

  await ctx.redis.zAdd(postId, { member, score });

  return member;
}
