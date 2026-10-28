export interface PublicationParticipation {
  id: number;
  publicationId: number;
  title: string;
  type: string;
  status: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  participationStatus: 'Ativa' | 'Encerrada';
}

export interface PublicationReportFilter {
  from: string;
  to: string;
  query?: string;
  authorId?: number;
  status?: string;
}
