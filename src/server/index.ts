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
import type {
  ApiEditResponse,
  ApiPreviewResponse,
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

type RecentPostResult =
  | {
      status: 'ok';
      userId: string;
      slug: string;
      postId: string;
      commentId: string;
    }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

async function getRecentPostSlug(
  ctx: RedditContext
): Promise<RecentPostResult> {
  const userId = ctx.context.userId;
  if (!userId) {
    return { status: 'error', message: 'No user found.' };
  }

  const recentPostsJson = await ctx.redis.hGet(userId, 'posts');
  if (!recentPostsJson) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  const recentPosts = JSON.parse(recentPostsJson) as string[];
  if (recentPosts.length === 0) {
    return { status: 'empty', message: 'No saved posts yet.' };
  }

  const recentPostSlug = recentPosts[0] ?? '';
  const [postId, commentId] = recentPostSlug.split('-');
  if (!postId || !commentId) {
    recentPosts.splice(0, 1);
    await ctx.redis.hSet(userId, {
      posts: JSON.stringify(recentPosts),
    });
    return { status: 'empty', message: 'Invalid post data.' };
  }

  return {
    status: 'ok',
    userId,
    slug: recentPostSlug,
    postId,
    commentId,
  };
}

async function buildPreviewData(
  ctx: RedditContext,
  includeSettings: boolean
): Promise<ApiPreviewResponse> {
  const recent = await getRecentPostSlug(ctx);
  if (recent.status !== 'ok') {
    return {
      status: 'empty',
      message: recent.message,
    };
  }

  const [comment, post] = await Promise.all([
    ctx.reddit.getCommentById(recent.commentId as `t1_${string}`),
    ctx.reddit.getPostById(recent.postId as `t3_${string}`),
  ]);

  const author = await ctx.reddit.getUserById(
    comment.authorId as `t2_${string}`
  );
  const snoovatarUrl = await author?.getSnoovatarUrl();
  const thumbnail = await post.getEnrichedThumbnail();

  let settings: PostSettings | undefined;
  if (includeSettings) {
    const settingsJson = await ctx.redis.hGet(recent.slug, 'data');
    settings = settingsJson
      ? (JSON.parse(settingsJson) as PostSettings)
      : undefined;
  }

  const payload: PreviewData = {
    postId: recent.postId,
    commentId: recent.commentId,
    comment: {
      id: recent.commentId,
      body: comment.body,
      authorName: comment.authorName,
      authorId: comment.authorId as `t2_${string}`,
      snoovatarUrl,
    },
    post: {
      id: recent.postId,
      title: post.title,
      imageUrl: thumbnail?.image?.url ?? undefined,
    },
    settings,
  };

  return {
    status: 'ok',
    data: payload,
  };
}

app.get('/api/view', async (c) => {
  const response = await buildPreviewData(redditCtx, true);
  return c.json(response);
});

app.get('/api/home', async (c) => {
  const response = await buildPreviewData(redditCtx, true);
  return c.json(response);
});

app.get('/api/edit', async (c) => {
  const response = await buildPreviewData(redditCtx, true);
  return c.json(response);
});

app.post('/api/edit', async (c) => {
  const recent = await getRecentPostSlug(redditCtx);
  if (recent.status !== 'ok') {
    const response: ApiEditResponse = {
      status: 'error',
      message: recent.message,
    };
    return c.json(response, recent.status === 'error' ? 401 : 404);
  }

  const body = (await c.req.json()) as PostSettings;
  await redditCtx.redis.hSet(recent.slug, {
    data: JSON.stringify(body),
  });

  const response: ApiEditResponse = {
    status: 'success',
    message: 'Settings updated.',
  };
  return c.json(response);
});

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
    const slug = `${postId}-${commentId}`;

    const userPostsJson = await redis.hGet(userId, 'posts');
    const posts = JSON.parse(userPostsJson ?? '[]') as string[];

    if (posts.includes(slug)) {
      return c.json(
        {
          status: 'error',
          message: 'Post already saved',
        },
        409
      );
    }

    posts.unshift(slug);
    await redis.hSet(userId, {
      posts: JSON.stringify(posts),
    });

    await redis.hSet(slug, {
      data: '{}',
      owner: userId,
    });

    const allPostsJson = await redis.get('posts');
    const allPosts = JSON.parse(allPostsJson ?? '[]') as string[];
    allPosts.unshift(slug);
    await redis.set('posts', JSON.stringify(allPosts));

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

    const comment = await reddit.getCommentById(targetId);
    const postId = comment.postId;
    const slug = `${postId}-${targetId}`;

    const userPostsJson = await redis.hGet(userId, 'posts');
    const posts = JSON.parse(userPostsJson ?? '[]') as string[];

    if (posts.includes(slug)) {
      return c.json({
        showToast: 'Comment already saved.',
      });
    }

    posts.unshift(slug);
    await redis.hSet(userId, {
      posts: JSON.stringify(posts),
    });

    await redis.hSet(slug, {
      data: '{}',
      owner: userId,
    });

    const allPostsJson = await redis.get('posts');
    const allPosts = JSON.parse(allPostsJson ?? '[]') as string[];
    allPosts.unshift(slug);
    await redis.set('posts', JSON.stringify(allPosts));

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
