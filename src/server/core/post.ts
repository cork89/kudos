import { reddit, redis } from '@devvit/web/server';

export const createPost = async () => {
  const post = await reddit.submitCustomPost({
    title: 'Kudos',
  });

  await redis.hSet('meta', {
    current: post.id,
  });

  return post;
};
