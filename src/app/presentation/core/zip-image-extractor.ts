import { MAX_UPLOAD_BYTES } from '@domain/publication/publication.entity';

export async function extractZipImageFiles(file: File): Promise<File[]> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('O arquivo ZIP passa do limite de 300 MB.');
  }

  const { default: JSZip } = await import('jszip');
  const archive = await JSZip.loadAsync(file);
  const imageEntries = Object.values(archive.files)
    .filter(entry => !entry.dir && /\.(jpe?g|png|webp)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  if (!imageEntries.length) {
    throw new Error('O ZIP não contém imagens JPEG, PNG ou WebP.');
  }

  let totalBytes = 0;
  const imageFiles: File[] = [];
  for (const entry of imageEntries) {
    const blob = await entry.async('blob');
    totalBytes += blob.size;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      throw new Error('As imagens extraídas ultrapassam o limite total de 300 MB.');
    }

    const filename = entry.name.replaceAll('\\', '/').split('/').pop() || 'imagem';
    const extension = filename.split('.').pop()?.toLocaleLowerCase();
    let mimeType = 'image/webp';
    if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
    else if (extension === 'png') mimeType = 'image/png';
    imageFiles.push(new File([blob], filename, { type: mimeType }));
  }
  return imageFiles;
}
