import { useState, useEffect, useRef, useCallback } from 'react';
import { api, Video } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import VideoCard from '@/components/VideoCard';
import AuthModal from '@/components/AuthModal';
import UploadModal from '@/components/UploadModal';
import ProfilePage from '@/pages/ProfilePage';
import SearchPage from '@/pages/SearchPage';
import Icon from '@/components/ui/icon';

type Screen = 'feed' | 'search' | 'profile';
type FeedTab = 'foryou' | 'following';

interface VideoViewerProps {
  videos: Video[];
  startIndex?: number;
  onBack?: () => void;
  onAuthRequired: () => void;
  onVideoUpdate: (v: Video) => void;
  onUserClick: (id: number) => void;
  showBackButton?: boolean;
}

function VideoViewer({ videos, startIndex = 0, onBack, onAuthRequired, onVideoUpdate, onUserClick, showBackButton }: VideoViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  useEffect(() => {
    if (containerRef.current && startIndex > 0) {
      containerRef.current.scrollTop = startIndex * containerRef.current.clientHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    setActiveIndex(Math.round(scrollTop / clientHeight));
  }, []);

  return (
    <div className="relative h-full">
      {showBackButton && (
        <button
          onClick={onBack}
          className="absolute top-12 left-4 z-50 bg-black/40 rounded-full p-2 backdrop-blur-sm"
        >
          <Icon name="ArrowLeft" size={22} className="text-white" />
        </button>
      )}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
        onScroll={handleScroll}
      >
        {videos.map((video, idx) => (
          <div key={video.id} className="snap-start h-full w-full flex-shrink-0">
            <VideoCard
              video={video}
              isActive={idx === activeIndex}
              onAuthRequired={onAuthRequired}
              onVideoUpdate={onVideoUpdate}
              onUserClick={onUserClick}
            />
          </div>
        ))}
        {videos.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-8">
            <Icon name="Video" size={48} className="text-zinc-600" />
            <p className="text-white text-xl font-bold text-center">Нет видео</p>
            <p className="text-zinc-400 text-sm text-center">Подпишитесь на авторов, чтобы видеть их видео здесь</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Index() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>('feed');
  const [feedTab, setFeedTab] = useState<FeedTab>('foryou');
  const [authOpen, setAuthOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<Video[] | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  // For You feed
  const [foryouVideos, setForyouVideos] = useState<Video[]>([]);
  const [foryouOffset, setForyouOffset] = useState(0);
  const [foryouHasMore, setForyouHasMore] = useState(true);
  const [foryouLoading, setForyouLoading] = useState(true);

  // Following feed
  const [followingVideos, setFollowingVideos] = useState<Video[]>([]);
  const [followingOffset, setFollowingOffset] = useState(0);
  const [followingLoading, setFollowingLoading] = useState(false);

  const foryouContainerRef = useRef<HTMLDivElement>(null);
  const followingContainerRef = useRef<HTMLDivElement>(null);
  const [foryouActive, setForyouActive] = useState(0);
  const [followingActive, setFollowingActive] = useState(0);

  useEffect(() => {
    loadForyou(true);
  }, []);

  useEffect(() => {
    if (feedTab === 'following' && followingVideos.length === 0 && user) {
      loadFollowing(true);
    }
  }, [feedTab, user]);

  const loadForyou = async (reset = false) => {
    const offset = reset ? 0 : foryouOffset;
    const data = await api.videos.getFeed(offset, 10);
    const newVids = data.videos || [];
    if (reset) {
      setForyouVideos(newVids);
      setForyouOffset(newVids.length);
    } else {
      setForyouVideos(prev => [...prev, ...newVids]);
      setForyouOffset(o => o + newVids.length);
    }
    setForyouHasMore(newVids.length === 10);
    setForyouLoading(false);
  };

  const loadFollowing = async (reset = false) => {
    setFollowingLoading(true);
    const offset = reset ? 0 : followingOffset;
    const data = await api.videos.getFollowingFeed(offset, 10);
    const newVids = data.videos || [];
    if (reset) {
      setFollowingVideos(newVids);
      setFollowingOffset(newVids.length);
    } else {
      setFollowingVideos(prev => [...prev, ...newVids]);
      setFollowingOffset(o => o + newVids.length);
    }
    setFollowingLoading(false);
  };

  const handleForyouScroll = useCallback(() => {
    const el = foryouContainerRef.current;
    if (!el) return;
    const newIdx = Math.round(el.scrollTop / el.clientHeight);
    setForyouActive(newIdx);
    if (newIdx >= foryouVideos.length - 3 && foryouHasMore) loadForyou();
  }, [foryouVideos.length, foryouHasMore]);

  const handleFollowingScroll = useCallback(() => {
    const el = followingContainerRef.current;
    if (!el) return;
    const newIdx = Math.round(el.scrollTop / el.clientHeight);
    setFollowingActive(newIdx);
    if (newIdx >= followingVideos.length - 3) loadFollowing();
  }, [followingVideos.length]);

  const updateForyouVideo = (v: Video) => setForyouVideos(prev => prev.map(x => x.id === v.id ? v : x));
  const updateFollowingVideo = (v: Video) => setFollowingVideos(prev => prev.map(x => x.id === v.id ? v : x));

  const handleUserClick = (userId: number) => {
    setProfileUserId(userId);
    setScreen('profile');
    setSelectedVideos(null);
  };

  const handleVideoSelect = (videos: Video[], index: number) => {
    setSelectedVideos(videos);
    setSelectedVideoIndex(index);
  };

  const handleNavClick = (s: Screen) => {
    if (s === 'profile' && !user) { setAuthOpen(true); return; }
    if (s === 'profile' && user) { setProfileUserId(user.id); }
    setScreen(s);
    setSelectedVideos(null);
  };

  return (
    <div className="bg-black h-screen w-screen flex flex-col overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">

        {/* Selected videos overlay (from search/profile grid) */}
        {selectedVideos && (
          <div className="absolute inset-0 z-40 bg-black">
            <VideoViewer
              videos={selectedVideos}
              startIndex={selectedVideoIndex}
              onBack={() => setSelectedVideos(null)}
              onAuthRequired={() => setAuthOpen(true)}
              onVideoUpdate={(v) => {
                setSelectedVideos(prev => prev ? prev.map(x => x.id === v.id ? v : x) : prev);
              }}
              onUserClick={handleUserClick}
              showBackButton
            />
          </div>
        )}

        {/* Feed screen */}
        {screen === 'feed' && (
          <div className="h-full flex flex-col">
            {/* Top tabs */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-center gap-6 pt-12 pb-2">
              <button
                onClick={() => setFeedTab('following')}
                className={`text-sm font-semibold transition-colors ${feedTab === 'following' ? 'text-white' : 'text-white/50'}`}
              >
                Подписки
              </button>
              <button
                onClick={() => setFeedTab('foryou')}
                className={`text-sm font-semibold transition-colors ${feedTab === 'foryou' ? 'text-white border-b-2 border-white pb-0.5' : 'text-white/50'}`}
              >
                Для тебя
              </button>
            </div>

            {/* For You feed */}
            <div className={`absolute inset-0 ${feedTab === 'foryou' ? 'block' : 'hidden'}`}>
              {foryouLoading && foryouVideos.length === 0 ? (
                <div className="h-full flex items-center justify-center flex-col gap-3">
                  <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-500 text-sm">Загружаю...</p>
                </div>
              ) : foryouVideos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 px-8">
                  <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center">
                    <Icon name="Video" size={36} className="text-zinc-500" />
                  </div>
                  <p className="text-white text-xl font-bold text-center">Пока нет видео</p>
                  <p className="text-zinc-400 text-sm text-center">Стань первым, кто опубликует Reel!</p>
                  <button
                    onClick={() => user ? setUploadOpen(true) : setAuthOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-6 py-3 font-medium"
                  >
                    Создать видео
                  </button>
                </div>
              ) : (
                <div
                  ref={foryouContainerRef}
                  className="h-full overflow-y-scroll snap-y snap-mandatory"
                  style={{ scrollbarWidth: 'none' }}
                  onScroll={handleForyouScroll}
                >
                  {foryouVideos.map((video, idx) => (
                    <div key={video.id} className="snap-start h-full w-full flex-shrink-0">
                      <VideoCard
                        video={video}
                        isActive={idx === foryouActive}
                        onAuthRequired={() => setAuthOpen(true)}
                        onVideoUpdate={updateForyouVideo}
                        onUserClick={handleUserClick}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Following feed */}
            <div className={`absolute inset-0 ${feedTab === 'following' ? 'block' : 'hidden'}`}>
              {!user ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 px-8">
                  <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center">
                    <Icon name="Users" size={36} className="text-zinc-500" />
                  </div>
                  <p className="text-white text-xl font-bold text-center">Подписки</p>
                  <p className="text-zinc-400 text-sm text-center">Войдите, чтобы видеть видео от авторов, на которых вы подписаны</p>
                  <button
                    onClick={() => setAuthOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-6 py-3 font-medium"
                  >
                    Войти
                  </button>
                </div>
              ) : followingLoading && followingVideos.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : followingVideos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-8">
                  <Icon name="UserPlus" size={48} className="text-zinc-600" />
                  <p className="text-white text-xl font-bold">Нет видео</p>
                  <p className="text-zinc-400 text-sm text-center">Подпишитесь на авторов, чтобы видеть их видео здесь</p>
                </div>
              ) : (
                <div
                  ref={followingContainerRef}
                  className="h-full overflow-y-scroll snap-y snap-mandatory"
                  style={{ scrollbarWidth: 'none' }}
                  onScroll={handleFollowingScroll}
                >
                  {followingVideos.map((video, idx) => (
                    <div key={video.id} className="snap-start h-full w-full flex-shrink-0">
                      <VideoCard
                        video={video}
                        isActive={idx === followingActive}
                        onAuthRequired={() => setAuthOpen(true)}
                        onVideoUpdate={updateFollowingVideo}
                        onUserClick={handleUserClick}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search screen */}
        {screen === 'search' && (
          <SearchPage
            onUserClick={handleUserClick}
            onVideoSelect={handleVideoSelect}
          />
        )}

        {/* Profile screen */}
        {screen === 'profile' && profileUserId && (
          <ProfilePage
            userId={profileUserId}
            onBack={() => {
              setScreen('feed');
              setProfileUserId(null);
            }}
            onAuthRequired={() => setAuthOpen(true)}
            onVideoSelect={handleVideoSelect}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <div className="bg-black border-t border-zinc-800/60 flex items-center justify-around px-2 py-2 pb-safe flex-shrink-0" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => { setScreen('feed'); setSelectedVideos(null); }}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 ${screen === 'feed' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Icon name="Home" size={24} />
          <span className="text-xs">Главная</span>
        </button>

        <button
          onClick={() => { setScreen('search'); setSelectedVideos(null); }}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 ${screen === 'search' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Icon name="Search" size={24} />
          <span className="text-xs">Поиск</span>
        </button>

        {/* Upload center button */}
        <button
          onClick={() => user ? setUploadOpen(true) : setAuthOpen(true)}
          className="flex items-center justify-center"
        >
          <div className="w-12 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Icon name="Plus" size={22} className="text-white" />
          </div>
        </button>

        <button
          onClick={() => handleNavClick('profile')}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 ${screen === 'profile' ? 'text-white' : 'text-zinc-500'}`}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
          ) : (
            <Icon name="User" size={24} />
          )}
          <span className="text-xs">Профиль</span>
        </button>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setForyouOffset(0);
          setForyouHasMore(true);
          loadForyou(true);
        }}
      />
    </div>
  );
}
