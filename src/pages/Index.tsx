import { useState, useEffect, useRef, useCallback } from 'react';
import { api, Video } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import VideoCard from '@/components/VideoCard';
import AuthModal from '@/components/AuthModal';
import UploadModal from '@/components/UploadModal';
import Icon from '@/components/ui/icon';

export default function Index() {
  const { user, logout } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  const loadVideos = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    const data = await api.videos.getFeed(offset, 10);
    const newVideos = data.videos || [];
    if (reset) {
      setVideos(newVideos);
      offsetRef.current = newVideos.length;
    } else {
      setVideos(prev => [...prev, ...newVideos]);
      offsetRef.current += newVideos.length;
    }
    setHasMore(newVideos.length === 10);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVideos(true);
  }, [loadVideos]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const newIndex = Math.round(scrollTop / clientHeight);
    setActiveIndex(newIndex);
    if (newIndex >= videos.length - 3 && hasMore) {
      loadVideos();
    }
  }, [videos.length, loadVideos, hasMore]);

  const handleVideoUpdate = (updated: Video) => {
    setVideos(prev => prev.map(v => v.id === updated.id ? updated : v));
  };

  return (
    <div className="bg-black h-screen w-screen flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Icon name="Play" size={16} className="text-white fill-white" />
          </div>
          <span className="text-white font-bold text-lg">Reels</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => user ? setUploadOpen(true) : setAuthOpen(true)}
            className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-3 py-1.5 text-sm font-medium"
          >
            <Icon name="Plus" size={14} />
            <span>Создать</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <button onClick={logout} className="text-zinc-400 hover:text-white">
                <Icon name="LogOut" size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="text-white text-sm bg-zinc-800 px-3 py-1.5 rounded-full hover:bg-zinc-700"
            >
              Войти
            </button>
          )}
        </div>
      </div>

      {loading && videos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Загружаю видео...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4 px-8">
          <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center">
            <Icon name="Video" size={36} className="text-zinc-500" />
          </div>
          <p className="text-white text-xl font-bold text-center">Пока нет видео</p>
          <p className="text-zinc-400 text-sm text-center">Будь первым, кто опубликует Reel!</p>
          <button
            onClick={() => user ? setUploadOpen(true) : setAuthOpen(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-6 py-3 font-medium"
          >
            Создать видео
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
          onScroll={handleScroll}
        >
          {videos.map((video, idx) => (
            <div key={video.id} className="snap-start h-screen w-full flex-shrink-0">
              <VideoCard
                video={video}
                isActive={idx === activeIndex}
                onAuthRequired={() => setAuthOpen(true)}
                onVideoUpdate={handleVideoUpdate}
              />
            </div>
          ))}
          {!hasMore && videos.length > 0 && (
            <div className="h-24 flex items-center justify-center">
              <p className="text-zinc-600 text-sm">Все видео загружены</p>
            </div>
          )}
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          offsetRef.current = 0;
          setHasMore(true);
          loadVideos(true);
        }}
      />
    </div>
  );
}
