import { Hono } from 'hono';
import {
  context,
  createServer,
  getServerPort,
  redis,
  reddit,
} from '@devvit/web/server';
import { IncomingMessage, ServerResponse } from 'node:http';

import { createPost } from './core/post';
import {
  canEditSave,
  getRecentSaves,
  getSaveByCommentId,
  getSaveForEdit,
  hasOlderSaves,
  isSaveStored,
  storeSave,
} from './core/saves';
import type {
  ApiEditResponse,
  ApiPreviewItemResponse,
  ApiPreviewResponse,
  ApiSettingsResponse,
  PostSettings,
  PreviewData,
  RedditContext,
} from '../shared/types/api';

const app = new Hono();

const redditCtx: RedditContext = {
  reddit,
  redis,
  context,
};

async function toPreviewComment(
  ctx: RedditContext,
  commentId: string,
  comment: Awaited<ReturnType<typeof ctx.reddit.getCommentById>>
): Promise<PreviewData['comment']> {
  const author = await ctx.reddit.getUserById(
    comment.authorId as `t2_${string}`
  );
  const snoovatarUrl = await author?.getSnoovatarUrl();

  return {
    id: commentId,
    body: comment.body,
    authorName: comment.authorName,
    authorId: comment.authorId as `t2_${string}`,
    snoovatarUrl,
  };
}

async function buildPreviewItem(
  ctx: RedditContext,
  save: { commentId: string; ownerId: string }
): Promise<PreviewData | null> {
  try {
    const comment = await ctx.reddit.getCommentById(
      save.commentId as `t1_${string}`
    );
    const postId = comment.postId;
    const parentCommentId =
      comment.parentId?.startsWith('t1_') === true
        ? (comment.parentId as `t1_${string}`)
        : undefined;

    const [post, childPreview, parentPreview] = await Promise.all([
      ctx.reddit.getPostById(postId as `t3_${string}`),
      toPreviewComment(ctx, save.commentId, comment),
      parentCommentId
        ? ctx.reddit
            .getCommentById(parentCommentId)
            .then((parentComment) =>
              toPreviewComment(ctx, parentCommentId, parentComment)
            )
            .catch((error) => {
              console.error('Failed to fetch parent comment:', error);
              return undefined;
            })
        : Promise.resolve(undefined),
    ]);

    const thumbnail = await post.getEnrichedThumbnail();

    return {
      postId,
      commentId: save.commentId,
      comment: childPreview,
      parentComment: parentPreview,
      post: {
        id: postId,
        title: post.title,
        imageUrl: thumbnail?.image?.url ?? undefined,
      },
      canEdit: canEditSave(ctx, save.ownerId),
    };
  } catch (error) {
    console.error('Failed to build preview item:', error);
    return null;
  }
}

async function buildPreviewList(
  ctx: RedditContext,
  options: { limit?: number; before?: number } = {}
): Promise<ApiPreviewResponse> {
  const limit = options.limit ?? 10;
  let before: number | undefined = options.before;
  const collected: { item: PreviewData; score: number }[] = [];
  let postId: string | null = null;

  while (collected.length < limit) {
    const recentOptions: { limit: number; before?: number } = { limit };
    if (before !== undefined) {
      recentOptions.before = before;
    }

    const recent = await getRecentSaves(ctx, recentOptions);
    if (recent.status !== 'ok') {
      if (collected.length === 0) {
        return {
          status: 'empty',
          message: recent.message,
        };
      }
      break;
    }

    postId = recent.postId;

    const oldestInBatch = recent.saves[recent.saves.length - 1];
    if (!oldestInBatch) {
      break;
    }

    const previewResults = await Promise.all(
      recent.saves.map(async (save) => {
        const item = await buildPreviewItem(ctx, save);
        return item ? { item, score: save.score } : null;
      })
    );

    for (const result of previewResults) {
      if (result) {
        collected.push(result);
      }
    }

    const hasOlder = await hasOlderSaves(
      ctx,
      recent.postId,
      oldestInBatch.score
    );

    if (!hasOlder || collected.length >= limit) {
      break;
    }

    before = oldestInBatch.score;
  }

  if (collected.length === 0) {
    return {
      status: 'empty',
      message: 'No saved posts yet.',
    };
  }

  const page = collected.slice(0, limit);
  const oldestOnPage = page[page.length - 1];
  let cursor: number | null = null;

  if (oldestOnPage && postId) {
    const hasOlder = await hasOlderSaves(ctx, postId, oldestOnPage.score);
    cursor = hasOlder ? oldestOnPage.score : null;
  }

  return {
    status: 'ok',
    data: {
      items: page.map((entry) => entry.item),
      cursor,
    },
  };
}

async function buildPreviewItemResponse(
  ctx: RedditContext,
  commentId: string
): Promise<ApiPreviewItemResponse> {
  const save = await getSaveByCommentId(ctx, commentId);
  if (save.status !== 'ok') {
    return {
      status: 'empty',
      message: save.message,
    };
  }

  const item = await buildPreviewItem(ctx, save);
  if (!item) {
    return {
      status: 'empty',
      message: 'Preview unavailable.',
    };
  }

  return {
    status: 'ok',
    data: item,
  };
}

const defaultSettings: PostSettings = {
  position: 'center',
  theme: 'dark',
  toolbarCollapsed: false,
};

async function buildSettingsResponse(
  ctx: RedditContext,
  commentId: string
): Promise<ApiSettingsResponse> {
  const save = await getSaveByCommentId(ctx, commentId);
  if (save.status !== 'ok') {
    return {
      status: 'empty',
      message: save.message,
    };
  }

  const settingsJson = await ctx.redis.hGet(save.member, 'data');
  const settings = settingsJson
    ? { ...defaultSettings, ...(JSON.parse(settingsJson) as PostSettings) }
    : defaultSettings;

  return {
    status: 'ok',
    data: settings,
  };
}

app.get('/api/preview', async (c) => {
  const beforeParam = c.req.query('before');
  const before =
    beforeParam !== undefined ? Number.parseInt(beforeParam, 10) : undefined;
  const limitParam = c.req.query('limit');
  const limit =
    limitParam !== undefined ? Number.parseInt(limitParam, 10) : undefined;

  const options: { limit?: number; before?: number } = {};
  if (limit !== undefined && Number.isFinite(limit)) {
    options.limit = limit;
  }
  if (before !== undefined && Number.isFinite(before)) {
    options.before = before;
  }

  const response = await buildPreviewList(redditCtx, options);
  return c.json(response);
});

app.get('/api/preview/:commentId', async (c) => {
  const commentId = c.req.param('commentId');
  if (!commentId) {
    return c.json(
      {
        status: 'empty',
        message: 'Invalid commentId.',
      },
      400
    );
  }

  const response = await buildPreviewItemResponse(redditCtx, commentId);
  return c.json(response);
});

app.get('/api/settings/:commentId', async (c) => {
  const commentId = c.req.param('commentId');
  if (!commentId) {
    return c.json(
      {
        status: 'empty',
        message: 'Invalid commentId.',
      },
      400
    );
  }

  const response = await buildSettingsResponse(redditCtx, commentId);
  return c.json(response);
});

app.post('/api/settings/:commentId/edit', async (c) => {
  const userId = context.userId;
  if (!userId) {
    const response: ApiEditResponse = {
      status: 'error',
      message: 'No user found.',
    };
    return c.json(response, 401);
  }

  const commentId = c.req.param('commentId');
  if (!commentId) {
    const response: ApiEditResponse = {
      status: 'error',
      message: 'Invalid commentId.',
    };
    return c.json(response, 400);
  }

  const save = await getSaveForEdit(redditCtx, commentId);
  if (save.status !== 'ok') {
    const response: ApiEditResponse = {
      status: 'error',
      message: save.message,
    };
    return c.json(response, save.status === 'error' ? 401 : 404);
  }

  if (!canEditSave(redditCtx, save.ownerId)) {
    const response: ApiEditResponse = {
      status: 'error',
      message: 'You cannot edit this save.',
    };
    return c.json(response, 403);
  }

  const settings = (await c.req.json()) as PostSettings;
  await redditCtx.redis.hSet(save.member, {
    data: JSON.stringify(settings),
  });

  const response: ApiEditResponse = {
    status: 'success',
    message: 'Settings updated.',
  };
  return c.json(response);
});

// DEPRECATED: unused — saves go through /internal/menu/add-to-commenteer.
app.post('/api/create', async (c) => {
  const userId = context.userId;
  if (!userId) {
    return c.json(
      {
        status: 'error',
        message: 'No user found',
      },
      401
    );
  }

  try {
    const body = await c.req.parseBody();
    const postId = body.postId;
    const commentId = body.commentId;
    if (typeof postId !== 'string' || typeof commentId !== 'string') {
      return c.json(
        {
          status: 'error',
          message: 'Invalid postId or commentId',
        },
        400
      );
    }
    if (await isSaveStored(redditCtx, userId, commentId)) {
      return c.json(
        {
          status: 'error',
          message: 'Post already saved',
        },
        409
      );
    }

    const member = await storeSave(redditCtx, userId, commentId);
    if (!member) {
      return c.json(
        {
          status: 'error',
          message: 'No active post.',
        },
        404
      );
    }

    const redirectUrl = await redis.hGet('meta', 'current');
    return c.json(
      {
        status: 'success',
        message: 'Post created',
        redirect: redirectUrl,
      },
      201
    );
  } catch (error) {
    console.error(error);
    return c.json(
      {
        status: 'failure',
        message: 'Post not created',
      },
      500
    );
  }
});

app.post('/internal/menu/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      500
    );
  }
});

app.post('/internal/menu/set-current', async (c) => {
  try {
    const postId = context.postId;
    if (!postId) {
      throw new Error('PostId missing.');
    }

    await redis.hSet('meta', {
      current: postId,
    });

    return c.json({
      showToast: 'Updated current commenteer post.',
    });
  } catch (error) {
    console.error('/internal/menu/set-current:', error);
    return c.json({
      showToast: 'Failed to set current.',
    });
  }
});

app.post('/internal/menu/add-to-commenteer', async (c) => {
  const userId = context.userId;
  if (!userId) {
    return c.json({
      showToast: 'User not found.',
    });
  }

  try {
    const { targetId, location } = await c.req.json();
    if (location !== 'comment') {
      return c.json({
        showToast: 'Something went wrong.',
      });
    }

    await reddit.getCommentById(targetId);

    if (await isSaveStored(redditCtx, userId, targetId)) {
      return c.json({
        showToast: 'Comment already saved.',
      });
    }

    const member = await storeSave(redditCtx, userId, targetId);
    if (!member) {
      return c.json({
        showToast:
          'There is no active commenteer post, please contact the mods.',
      });
    }

    const redirectUrl = (await redis.hGet('meta', 'current')) as
      | `t3_${string}`
      | null;
    if (!redirectUrl) {
      return c.json({
        showToast:
          'There is no active commenteer post, please contact the mods.',
      });
    }

    const post = await reddit.getPostById(redirectUrl);
    if (!post) {
      return c.json({
        showToast:
          'There is no active commenteer post, please contact the mods.',
      });
    }

    return c.json({
      navigateTo: post,
    });
  } catch (error) {
    console.error(error);
    return c.json({
      showToast: 'Failed to add to commenteer :(',
    });
  }
});

export default app;

const port = getServerPort();

const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise<string>((resolve) => {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => resolve(data));
      });
    }

    const request = new Request(url.toString(), {
      method: req.method || 'GET',
      headers: req.headers as Record<string, string>,
      body: body || null,
    });

    const response = await app.fetch(request);
    res.statusCode = response.status;

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const text = await response.text();
      res.end(text);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Request handler error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};

// Vite dev loads this module via ssrLoadModule (import.meta.hot is set); skip standalone server.
if (!import.meta.hot) {
  const server = createServer(requestHandler);
  server.on('error', (err: any) => console.error(`server error; ${err.stack}`));
  server.listen(port);
  console.log(`started server on port ${port}`);
}
