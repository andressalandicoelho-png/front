export interface ProgramPreviewItem {
  title: string;
  type: string;
  content?: string | null;
  mediaId: number | null;
  linkUrl?: string | null;
  seconds: number;
  schedule?: string;
}