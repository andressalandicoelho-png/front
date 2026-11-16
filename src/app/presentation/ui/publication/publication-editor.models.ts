import { PublicationType } from '@domain/publication/publication.entity';

export interface PublicationEditorForm {
  title: string;
  content: string;
  type: PublicationType;
  linkUrl: string;
  file: File | undefined;
  displaySeconds: number | null;
  originalDurationSeconds: number | null;
}

export interface ZipImagePreview {
  file: File;
  previewUrl: string;
  title: string;
  created: boolean;
}
