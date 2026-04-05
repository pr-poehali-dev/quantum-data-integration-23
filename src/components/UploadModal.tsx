import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
};

export default function UploadModal({ open, onClose, onUploaded }: Props) {
  const [mode, setMode] = useState<'upload' | 'record'>('upload');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const startRecording = async () => {
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play();
    }
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], 'recording.webm', { type: 'video/webm' });
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(blob));
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    mr.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleSubmit = async () => {
    if (!videoFile) { setError('Выберите или запишите видео'); return; }
    setLoading(true);
    setError('');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const data = await api.videos.upload(base64, title, description);
      setLoading(false);
      if (data.error) {
        setError(data.error);
      } else {
        setTitle(''); setDescription(''); setVideoFile(null); setVideoPreview('');
        onUploaded();
        onClose();
      }
    };
    reader.readAsDataURL(videoFile);
  };

  const handleClose = () => {
    if (recording) stopRecording();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Новое видео</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
          >
            Загрузить файл
          </button>
          <button
            onClick={() => setMode('record')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'record' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
          >
            Записать видео
          </button>
        </div>

        {mode === 'upload' && (
          <div>
            {!videoPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
              >
                <Icon name="Upload" size={32} className="text-zinc-400 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Нажмите для выбора видео</p>
                <p className="text-zinc-600 text-xs mt-1">MP4, MOV, AVI</p>
              </div>
            ) : (
              <div className="relative">
                <video src={videoPreview} controls className="w-full rounded-xl max-h-48 object-cover" />
                <button
                  onClick={() => { setVideoFile(null); setVideoPreview(''); }}
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                >
                  <Icon name="X" size={16} className="text-white" />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
          </div>
        )}

        {mode === 'record' && (
          <div>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video ref={previewVideoRef} muted className="w-full h-full object-cover" />
              {!recording && !videoPreview && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="Camera" size={40} className="text-zinc-600" />
                </div>
              )}
              {videoPreview && !recording && (
                <video src={videoPreview} controls className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {!recording && !videoPreview && (
                <Button onClick={startRecording} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  <Icon name="Circle" size={16} className="mr-2 fill-white" /> Начать запись
                </Button>
              )}
              {recording && (
                <Button onClick={stopRecording} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white">
                  <Icon name="Square" size={16} className="mr-2 fill-white" /> Остановить
                </Button>
              )}
              {videoPreview && !recording && (
                <Button
                  onClick={() => setVideoPreview('')}
                  variant="outline"
                  className="flex-1 border-zinc-600 text-zinc-300"
                >
                  Перезаписать
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3 mt-3">
          <Input
            placeholder="Название (необязательно)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-400"
          />
          <Input
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-400"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={loading || !videoFile}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
        >
          {loading ? 'Загружаю...' : 'Опубликовать'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
