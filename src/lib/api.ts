import func2url from '../../backend/func2url.json';

const AUTH_URL = func2url.auth;
const VIDEOS_URL = func2url.videos;

function getToken() {
  return localStorage.getItem('reel_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Auth-Token': getToken(),
  };
}

export const api = {
  auth: {
    register: async (username: string, email: string, password: string) => {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username, email, password }),
      });
      return res.json();
    },
    login: async (email: string, password: string) => {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      return res.json();
    },
    me: async () => {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'me' }),
      });
      return res.json();
    },
    logout: async () => {
      await fetch(AUTH_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'logout' }),
      });
      localStorage.removeItem('reel_token');
    },
  },
  videos: {
    getFeed: async (offset = 0, limit = 10) => {
      const res = await fetch(`${VIDEOS_URL}?action=feed&offset=${offset}&limit=${limit}`, {
        headers: { 'X-Auth-Token': getToken() },
      });
      return res.json();
    },
    getComments: async (videoId: number) => {
      const res = await fetch(`${VIDEOS_URL}?action=comments&video_id=${videoId}`, {
        headers: { 'X-Auth-Token': getToken() },
      });
      return res.json();
    },
    upload: async (videoData: string, title: string, description: string) => {
      const res = await fetch(VIDEOS_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'upload', video_data: videoData, title, description }),
      });
      return res.json();
    },
    like: async (videoId: number) => {
      const res = await fetch(VIDEOS_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'like', video_id: videoId }),
      });
      return res.json();
    },
    comment: async (videoId: number, text: string) => {
      const res = await fetch(VIDEOS_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'comment', video_id: videoId, text }),
      });
      return res.json();
    },
    view: async (videoId: number) => {
      await fetch(VIDEOS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view', video_id: videoId }),
      });
    },
  },
};

export type User = {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
};

export type Video = {
  id: number;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url?: string;
  views: number;
  created_at: string;
  user: { id: number; username: string; avatar_url?: string };
  likes_count: number;
  comments_count: number;
  liked: boolean;
};

export type Comment = {
  id: number;
  text: string;
  created_at: string;
  user: { id: number; username: string; avatar_url?: string };
};
