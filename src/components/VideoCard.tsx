import { useRef, useState, useEffect } from 'react';
import { api, Video, Comment } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/ui/icon';

type Props = {
  video: Video;
  isActive: boolean;
  onAuthRequired: () => void;
  onVideoUpdate: (v: Video) => void;
};

export default function VideoCard({ video, isActive, onAuthRequired, onVideoUpdate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const [liked, setLiked] = useState(video.liked);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsCount, setCommentsCount] = useState(video.comments_count);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const viewedRef = useRef(false);

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

  const handleLike = async () => {
    if (!user) { onAuthRequired(); return; }
    const data = await api.videos.like(video.id);
    setLiked(data.liked);
    setLikesCount(data.likes_count);
    onVideoUpdate({ ...video, liked: data.liked, likes_count: data.likes_count });
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
      setCommentsCount(prev => prev + 1);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (paused) {
        videoRef.current.play();
        setPaused(false);
      } else {
        videoRef.current.pause();
        setPaused(true);
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={video.video_url}
        loop
        muted={muted}
        playsInline
        className="h-full w-full object-cover"
        onClick={togglePlay}
      />

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-4">
            <Icon name="Play" size={40} className="text-white" />
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-4">
            <p className="text-white font-semibold text-sm">@{video.user.username}</p>
            {video.title && <p className="text-white font-bold mt-1">{video.title}</p>}
            {video.description && (
              <p className="text-white/80 text-sm mt-1 line-clamp-2">{video.description}</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-5">
            <button onClick={handleLike} className="flex flex-col items-center gap-1">
              <Icon
                name="Heart"
                size={28}
                className={liked ? 'text-red-500 fill-red-500' : 'text-white'}
              />
              <span className="text-white text-xs">{likesCount}</span>
            </button>

            <button onClick={handleComments} className="flex flex-col items-center gap-1">
              <Icon name="MessageCircle" size={28} className="text-white" />
              <span className="text-white text-xs">{commentsCount}</span>
            </button>

            <button className="flex flex-col items-center gap-1">
              <Icon name="Eye" size={28} className="text-white" />
              <span className="text-white text-xs">{video.views}</span>
            </button>

            <button onClick={() => setMuted(!muted)} className="flex flex-col items-center gap-1">
              <Icon name={muted ? 'VolumeX' : 'Volume2'} size={28} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 rounded-t-3xl max-h-[60%] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
            <span className="text-white font-semibold">Комментарии</span>
            <button onClick={() => setShowComments(false)}>
              <Icon name="X" size={20} className="text-zinc-400" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-2 space-y-3">
            {comments.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">Пока нет комментариев</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {c.user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-white text-xs font-semibold">@{c.user.username}</span>
                  <p className="text-zinc-300 text-sm">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleComment} className="flex gap-2 p-3 border-t border-zinc-700">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Написать комментарий..."
              className="flex-1 bg-zinc-800 text-white rounded-full px-4 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-4 py-2 text-sm"
            >
              <Icon name="Send" size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
