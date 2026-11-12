export function publicationTypeName(type: string): string {
  switch (type) {
    case 'IMAGE':
      return 'Imagem';
    case 'VIDEO':
      return 'Vídeo';
    case 'MESSAGE':
      return 'Mensagem';
    default:
      return 'Link';
  }
}
