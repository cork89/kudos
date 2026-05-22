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
  snoovatarUrl?: string | undefined;
};

export type PreviewPost = {
  id: string;
  title?: string | undefined;
  imageUrl?: string | undefined;
};

export type PreviewData = {
  postId: string;
  commentId: string;
  comment: PreviewComment;
  parentComment?: PreviewComment | undefined;
  post: PreviewPost;
  canEdit: boolean;
};

export type PreviewListData = {
  items: PreviewData[];
  cursor: number | null;
};

export type ApiPreviewResponse =
  | {
      status: 'ok';
      data: PreviewListData;
    }
  | {
      status: 'empty';
      message: string;
    };

export type ApiSettingsResponse =
  | {
      status: 'ok';
      data: PostSettings;
    }
  | {
      status: 'empty';
      message: string;
    };

export type ApiEditResponse = {
  status: 'success' | 'error';
  message: string;
};
