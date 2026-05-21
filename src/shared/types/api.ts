import type { Context, RedditClient, RedisClient } from '@devvit/web/server';

export type RedditContext = {
  reddit: RedditClient;
  redis: RedisClient;
  context: Context;
};

export type CommentPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type Theme = 'dark' | 'light';

export interface PostSettings {
  position: CommentPosition;
  theme: Theme;
  toolbarCollapsed: boolean;
}

export type PreviewComment = {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  snoovatarUrl?: string;
};

export type PreviewPost = {
  id: string;
  title?: string;
  imageUrl?: string;
};

export type PreviewData = {
  postId: string;
  commentId: string;
  comment: PreviewComment;
  post: PreviewPost;
  settings?: PostSettings;
};

export type ApiPreviewResponse =
  | {
      status: 'ok';
      data: PreviewData;
    }
  | {
      status: 'empty';
      message: string;
    };

export type ApiEditResponse = {
  status: 'success' | 'error';
  message: string;
};
