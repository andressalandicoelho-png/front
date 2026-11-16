export interface VideoPreview {
  thumbnailUrl: string;
  durationSeconds: number;
}

export function generateVideoPreview(blob: Blob): Promise<VideoPreview> {
  const sourceUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;

  return new Promise<VideoPreview>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('A leitura do vídeo demorou demais.'));
    }, 10_000);
    const onError = () => {
      cleanup();
      reject(new Error('Não foi possível gerar a miniatura deste vídeo.'));
    };
    const onLoaded = () => {
      try {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) throw new Error('O vídeo não possui um quadro disponível para a miniatura.');
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          throw new Error('Não foi possível ler a duração original do vídeo.');
        }
        const scale = Math.min(1, 480 / width, 270 / height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a miniatura do vídeo.');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve({
          thumbnailUrl: canvas.toDataURL('image/jpeg', 0.82),
          durationSeconds: Math.ceil(video.duration),
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = sourceUrl;
    video.load();
  }).finally(() => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(sourceUrl);
  });
}

export function generateVideoThumbnail(blob: Blob): Promise<string> {
  return generateVideoPreview(blob).then(preview => preview.thumbnailUrl);
}
