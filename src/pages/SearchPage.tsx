import { useState, useEffect, useRef } from 'react';
import { api, Video, User } from '@/lib/api';
import Icon from '@/components/ui/icon';

type Props = {
  onUserClick: (userId: number) => void;
  onVideoSelect: (videos: Video[], index: number) => void;
};

function Avatar({ username, avatar_url, size = 10 }: { username: string; avatar_url?: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`;
  if (avatar_url) return <img src={avatar_url} className={cls + ' object-cover'} alt={username} />;
  return (
    <div className={cls + ' bg-gradient-to-br from-purple-500 to-pink-500'}>
      <span className="text-white font-bold text-xs">{username.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export default function SearchPage({ onUserClick, onVideoSelect }: Props) {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [trending, setTrending] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api.videos.getTrending().then(d => setTrending(d.videos || []));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearched(false);
      setVideos([]);
      setUsers([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const data = await api.videos.search(query);
      setVideos(data.videos || []);
      setUsers(data.users || []);
      setSearched(true);
      setLoading(false);
    }, 400);
  }, [query]);

  const fmtViews = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}К` : String(n);

  const displayVideos = searched ? videos : trending;

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      {/* Search input */}
      <div className="px-4 pt-12 pb-3 sticky top-0 bg-black z-10">
        <div className="relative">
          <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск видео и пользователей..."
            className="w-full bg-zinc-800 text-white rounded-full pl-10 pr-4 py-3 text-sm outline-none placeholder:text-zinc-500"
            autoFocus={false}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <Icon name="X" size={16} className="text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Users results */}
      {searched && users.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-zinc-400 text-xs font-semibold uppercase mb-2">Пользователи</p>
          <div className="space-y-3">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => onUserClick(u.id)}
                className="flex items-center gap-3 w-full"
              >
                <Avatar username={u.username} avatar_url={u.avatar_url} size={12} />
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">@{u.username}</p>
                  <p className="text-zinc-400 text-xs">{u.followers_count || 0} подписчиков</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section title */}
      <div className="px-4 mb-2">
        <p className="text-zinc-400 text-xs font-semibold uppercase">
          {searched ? 'Видео' : 'Трендовые видео'}
        </p>
      </div>

      {/* Video grid */}
      {!loading && (
        <div className="grid grid-cols-2 gap-0.5 px-0.5">
          {displayVideos.length === 0 && searched ? (
            <div className="col-span-2 flex flex-col items-center py-12 gap-3">
              <Icon name="SearchX" size={40} className="text-zinc-600" />
              <p className="text-zinc-500 text-sm">Ничего не найдено</p>
            </div>
          ) : (
            displayVideos.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => onVideoSelect(displayVideos, idx)}
                className="aspect-[9/16] relative overflow-hidden bg-zinc-900 rounded-sm"
              >
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <video src={v.video_url} className="w-full h-full object-cover" preload="metadata" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <div className="flex items-center gap-1">
                    <Icon name="Eye" size={11} className="text-white/70" />
                    <span className="text-white/90 text-xs font-semibold drop-shadow">
                      {fmtViews(v.views)}
                    </span>
                  </div>
                  {v.title && <p className="text-white text-xs line-clamp-1 mt-0.5">{v.title}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
