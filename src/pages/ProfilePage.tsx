import { useState, useEffect, useRef } from 'react';
import { api, User, Video } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/ui/icon';

type Tab = 'videos' | 'saved';

type Props = {
  userId: number;
  onBack: () => void;
  onAuthRequired: () => void;
  onVideoSelect: (videos: Video[], index: number) => void;
};

function Avatar({ username, avatar_url, size = 20 }: { username: string; avatar_url?: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`;
  if (avatar_url) return <img src={avatar_url} className={cls + ' object-cover'} alt={username} />;
  return (
    <div className={cls + ' bg-gradient-to-br from-purple-500 to-pink-500'}>
      <span className="text-white font-bold text-2xl">{username.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}К` : String(n);
  return (
    <div className="flex flex-col items-center">
      <span className="text-white font-bold text-lg">{typeof value === 'number' ? fmt(value) : value}</span>
      <span className="text-zinc-400 text-xs">{label}</span>
    </div>
  );
}

export default function ProfilePage({ userId, onBack, onAuthRequired, onVideoSelect }: Props) {
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [saved, setSaved] = useState<Video[]>([]);
  const [tab, setTab] = useState<Tab>('videos');
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const data = await api.videos.getProfile(userId);
    if (data.profile) {
      setProfile(data.profile);
      setVideos(data.videos || []);
      setFollowing(data.profile.is_following);
      setFollowersCount(data.profile.followers_count || 0);
      setBio(data.profile.bio || '');
    }
    setLoading(false);
  };

  const loadSaved = async () => {
    if (me && me.id === userId) {
      const data = await api.videos.getSaved();
      setSaved(data.videos || []);
    }
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === 'saved' && saved.length === 0) loadSaved();
  };

  const handleFollow = async () => {
    if (!me) { onAuthRequired(); return; }
    const data = await api.videos.follow(userId);
    setFollowing(data.following);
    setFollowersCount(data.followers_count);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    await api.videos.updateProfile(bio);
    setSaving(false);
    setEditMode(false);
    loadProfile();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setSaving(true);
      await api.videos.updateProfile(bio, base64);
      setSaving(false);
      loadProfile();
    };
    reader.readAsDataURL(file);
  };

  const isMe = me?.id === userId;
  const displayVideos = tab === 'videos' ? videos : saved;

  if (loading) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <p className="text-zinc-400">Пользователь не найден</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-black overflow-y-auto text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button onClick={onBack}>
          <Icon name="ArrowLeft" size={24} className="text-white" />
        </button>
        <span className="font-semibold">@{profile.username}</span>
        {isMe ? (
          <button onClick={() => setEditMode(!editMode)}>
            <Icon name={editMode ? 'X' : 'Settings'} size={22} className="text-white" />
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {/* Avatar + stats */}
      <div className="flex flex-col items-center px-4 pb-4">
        <div className="relative mb-3">
          <Avatar username={profile.username} avatar_url={profile.avatar_url} size={20} />
          {isMe && editMode && (
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-purple-500 rounded-full p-1.5"
            >
              <Icon name="Camera" size={14} className="text-white" />
            </button>
          )}
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

        <h2 className="text-white font-bold text-lg">@{profile.username}</h2>

        {editMode ? (
          <div className="w-full mt-3 space-y-2">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Напишите о себе..."
              className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none resize-none h-20 placeholder:text-zinc-500"
            />
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl py-2 text-sm font-medium"
            >
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </div>
        ) : (
          profile.bio && <p className="text-zinc-300 text-sm text-center mt-1 px-6">{profile.bio}</p>
        )}

        <div className="flex gap-8 mt-4">
          <StatBox label="Видео" value={profile.videos_count || 0} />
          <StatBox label="Подписчики" value={followersCount} />
          <StatBox label="Подписки" value={profile.following_count || 0} />
          <StatBox label="Лайки" value={profile.total_likes || 0} />
        </div>

        {!isMe && (
          <button
            onClick={handleFollow}
            className={`mt-4 px-8 py-2 rounded-full font-semibold text-sm transition-all ${
              following
                ? 'border border-zinc-600 text-white'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
            }`}
          >
            {following ? 'Отписаться' : 'Подписаться'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => handleTabChange('videos')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'videos' ? 'border-white text-white' : 'border-transparent text-zinc-500'
          }`}
        >
          <Icon name="Grid3x3" size={20} className="mx-auto" />
        </button>
        {isMe && (
          <button
            onClick={() => handleTabChange('saved')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'saved' ? 'border-white text-white' : 'border-transparent text-zinc-500'
            }`}
          >
            <Icon name="Bookmark" size={20} className="mx-auto" />
          </button>
        )}
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {displayVideos.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3">
            <Icon name={tab === 'saved' ? 'Bookmark' : 'Video'} size={40} className="text-zinc-600" />
            <p className="text-zinc-500 text-sm">
              {tab === 'saved' ? 'Нет сохранённых видео' : 'Нет видео'}
            </p>
          </div>
        ) : (
          displayVideos.map((v, idx) => (
            <button
              key={v.id}
              className="aspect-[9/16] relative overflow-hidden bg-zinc-900"
              onClick={() => onVideoSelect(displayVideos, idx)}
            >
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <video src={v.video_url} className="w-full h-full object-cover" preload="metadata" />
              )}
              <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                <Icon name="Play" size={10} className="text-white fill-white" />
                <span className="text-white text-xs font-semibold drop-shadow">
                  {v.views >= 1000 ? `${(v.views / 1000).toFixed(1)}К` : v.views}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
