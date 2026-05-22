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

export async function getLatestSave(ctx: RedditContext): Promise<SaveResult> {
  const postId = await resolvePostId(ctx);
  if (!postId) {
    return { status: 'empty', message: 'No active post.' };
  }

  const card = await ctx.redis.zCard(postId);
  if (card === 0) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  const recent = await ctx.redis.zRange(postId, card - 1, card - 1, {
    by: 'rank',
  });
  const entry = recent[0];
  if (!entry) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  const parsed = parseSaveMember(entry.member);
  if (!parsed) {
    await ctx.redis.zRem(postId, [entry.member]);
    return { status: 'empty', message: 'Invalid post data.' };
  }

  return {
    status: 'ok',
    ownerId: parsed.userId,
    member: entry.member,
    commentId: parsed.commentId,
    postId,
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

  for (let rank = card - 1; rank >= 0; rank -= 1) {
    const recent = await ctx.redis.zRange(postId, rank, rank, {
      by: 'rank',
    });
    const entry = recent[0];
    if (!entry) {
      continue;
    }

    const parsed = parseSaveMember(entry.member);
    if (!parsed) {
      await ctx.redis.zRem(postId, [entry.member]);
      continue;
    }

    if (parsed.commentId !== commentId) {
      continue;
    }

    return {
      status: 'ok',
      ownerId: parsed.userId,
      member: entry.member,
      commentId: parsed.commentId,
      postId,
    };
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
  await ctx.redis.hSet(member, {
    data: '{}',
    owner: userId,
  });

  return member;
}
