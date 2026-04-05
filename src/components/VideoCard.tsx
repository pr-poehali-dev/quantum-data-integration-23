import { useRef, useState, useEffect, useCallback } from 'react';
import { api, Video, Comment } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/ui/icon';

type Props = {
  video: Video;
  isActive: boolean;
  onAuthRequired: () => void;
  onVideoUpdate: (v: Video) => void;
  onUserClick: (userId: number) => void;
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

export default function VideoCard({ video, isActive, onAuthRequired, onVideoUpdate, onUserClick }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const [liked, setLiked] = useState(video.liked);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [saved, setSaved] = useState(video.saved);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsCount, setCommentsCount] = useState(video.comments_count);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const viewedRef = useRef(false);

  useEffect(() => {
    setLiked(video.liked);
    setLikesCount(video.likes_count);
    setSaved(video.saved);
    setCommentsCount(video.comments_count);
  }, [video]);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPaused(false);
      if (!viewedRef.current) {
        viewedRef.current = true;
        api.videos.view(video.id);
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
      setPaused(true);
    }
  }, [isActive, video.id]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
  }, []);

  const handleLike = async () => {
    if (!user) { onAuthRequired(); return; }
    const prev = liked;
    setLiked(!liked);
    setLikesCount(c => liked ? c - 1 : c + 1);
    const data = await api.videos.like(video.id);
    if (data.error) { setLiked(prev); setLikesCount(video.likes_count); return; }
    setLiked(data.liked);
    setLikesCount(data.likes_count);
    onVideoUpdate({ ...video, liked: data.liked, likes_count: data.likes_count });
  };

  const handleSave = async () => {
    if (!user) { onAuthRequired(); return; }
    const data = await api.videos.save(video.id);
    setSaved(data.saved);
    onVideoUpdate({ ...video, saved: data.saved });
  };

  const handleComments = async () => {
    if (!showComments) {
      const data = await api.videos.getComments(video.id);
      setComments(data.comments || []);
    }
    setShowComments(!showComments);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onAuthRequired(); return; }
    if (!commentText.trim()) return;
    const data = await api.videos.comment(video.id, commentText);
    if (!data.error) {
      setComments(prev => [...prev, data]);
      setCommentText('');
      setCommentsCount(c => c + 1);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (paused) { videoRef.current.play(); setPaused(false); }
      else { videoRef.current.pause(); setPaused(true); }
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: video.title || 'Reel', url });
    } else {
      await navigator.clipboard.writeText(url);
      setShowShare(true);
      setTimeout(() => setShowShare(false), 2000);
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const fmtCount = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}К` : String(n);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center select-none">
      <video
        ref={videoRef}
        src={video.video_url}
        loop
        muted={muted}
        playsInline
        className="h-full w-full object-cover"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
      />

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/30 rounded-full p-5 backdrop-blur-sm">
            <Icon name="Play" size={44} className="text-white fill-white" />
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 cursor-pointer" onClick={seekTo}>
        <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-2 left-0 right-16 px-4 pb-3">
        <button
          className="flex items-center gap-2 mb-2 group"
          onClick={() => onUserClick(video.user.id)}
        >
          <Avatar username={video.user.username} avatar_url={video.user.avatar_url} size={9} />
          <span className="text-white font-semibold text-sm drop-shadow">@{video.user.username}</span>
        </button>
        {video.title && (
          <p className="text-white font-bold text-sm drop-shadow line-clamp-1 mb-0.5">{video.title}</p>
        )}
        {video.description && (
          <p className="text-white/80 text-xs drop-shadow line-clamp-2">{video.description}</p>
        )}
        {video.sound_name && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Icon name="Music" size={12} className="text-white/70 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-white/70 text-xs">{video.sound_name}</span>
          </div>
        )}
      </div>

      {/* Right action buttons */}
      <div className="absolute right-3 bottom-10 flex flex-col items-center gap-4">
        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
          <div className={`p-2 rounded-full transition-all ${liked ? 'scale-110' : ''}`}>
            <Icon name="Heart" size={30} className={liked ? 'text-red-500 fill-red-500' : 'text-white drop-shadow'} />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{fmtCount(likesCount)}</span>
        </button>

        {/* Comment */}
        <button onClick={handleComments} className="flex flex-col items-center gap-0.5">
          <div className="p-2 rounded-full">
            <Icon name="MessageCircle" size={30} className="text-white drop-shadow" />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{fmtCount(commentsCount)}</span>
        </button>

        {/* Save */}
        <button onClick={handleSave} className="flex flex-col items-center gap-0.5">
          <div className="p-2 rounded-full">
            <Icon name="Bookmark" size={28} className={saved ? 'text-yellow-400 fill-yellow-400' : 'text-white drop-shadow'} />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{saved ? 'Сохр.' : 'Сохр.'}</span>
        </button>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center gap-0.5 relative">
          <div className="p-2 rounded-full">
            <Icon name="Share2" size={28} className="text-white drop-shadow" />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">Поделиться</span>
          {showShare && (
            <div className="absolute -top-8 right-0 bg-zinc-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Скопировано!
            </div>
          )}
        </button>

        {/* Mute */}
        <button onClick={() => setMuted(!muted)} className="flex flex-col items-center gap-0.5">
          <div className="p-2 rounded-full">
            <Icon name={muted ? 'VolumeX' : 'Volume2'} size={26} className="text-white drop-shadow" />
          </div>
        </button>

        {/* Views */}
        <div className="flex flex-col items-center gap-0.5">
          <Icon name="Eye" size={22} className="text-white/70" />
          <span className="text-white/70 text-xs">{fmtCount(video.views)}</span>
        </div>
      </div>

      {/* Comments drawer */}
      {showComments && (
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/97 rounded-t-3xl max-h-[65%] flex flex-col z-10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60">
            <span className="text-white font-semibold">{fmtCount(commentsCount)} комментариев</span>
            <button onClick={() => setShowComments(false)}>
              <Icon name="X" size={20} className="text-zinc-400" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-2 space-y-3">
            {comments.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-6">Нет комментариев. Будь первым!</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar username={c.user.username} avatar_url={c.user.avatar_url} size={8} />
                <div className="flex-1">
                  <span className="text-white text-xs font-semibold">@{c.user.username}</span>
                  <p className="text-zinc-200 text-sm mt-0.5">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleComment} className="flex gap-2 p-3 border-t border-zinc-700/60">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? 'Написать комментарий...' : 'Войдите, чтобы комментировать'}
              className="flex-1 bg-zinc-800 text-white rounded-full px-4 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0"
            >
              <Icon name="Send" size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
