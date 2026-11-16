import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreatePublicationUseCase, UpdatePublicationUseCase } from '@application/publication/publication.usecases';
import {
  DEFAULT_DISPLAY_SECONDS, MAX_MESSAGE_CONTENT_LENGTH, Publication, PublicationChanges, PublicationType,
} from '@domain/publication/publication.entity';
import { errorMessage } from '@presentation/core/error-message';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { generateVideoPreview } from './video-thumbnail';
import { PublicationEditorForm } from './publication-editor.models';
import { PublicationZipWorkflow } from './publication-zip-workflow';
export type { PublicationEditorForm, ZipImagePreview } from './publication-editor.models';

@Component({
  selector: 'app-publication-editor',
  imports: [FormsModule, IconComponent, ModalComponent],
  templateUrl: './publication-editor.component.html',
})
export class PublicationEditorComponent implements OnDestroy {
  private readonly createUC = inject(CreatePublicationUseCase);
  private readonly updateUC = inject(UpdatePublicationUseCase);
  private readonly toast = inject(ToastService);

  editingPublication = input<Publication | null>(null);
  form = input.required<PublicationEditorForm>();
  maxTitleLength = input.required<number>();
  maxMessageContentLength = input.required<number>();
  durationOptions = input.required<number[]>();
  saving = signal(false);
  error = input('');
  mediaPreviewUrl = signal<string | null>(null);
  previewLoading = signal(false);
  previewError = signal('');
  videoDurationDetected = signal(false);

  get dialogTitle(): string {
    if (this.editingPublication()) return 'Editar publicação';
    return 'Nova publicação';
  }

  get dialogSubtitle(): string {
    if (this.editingPublication()) return '';
    return 'Defina o conteúdo e o tempo de exibição.';
  }

  get fileAccept(): string {
    if (this.form().type === 'IMAGE') return '.zip,application/zip,image/jpeg,image/png,image/webp';
    return 'video/mp4';
  }

  get durationPlaceholder(): string {
    if (this.form().type === 'VIDEO') return '—';
    return '20';
  }

  formChange = output<PublicationEditorForm>();
  closed = output<void>();
  listRefreshRequested = output<void>();
  errorChanged = output<string>();

  private previewGeneration = 0;
  private readonly zipWorkflow = new PublicationZipWorkflow(
    this.createUC,
    this.toast,
    () => this.form(),
    values => this.updateFormValues(values),
    value => this.normalizeLinkInput(value),
    this.saving,
    message => this.setError(message),
    () => this.requestClose(),
    () => this.listRefreshRequested.emit(),
  );
  readonly zipImages = this.zipWorkflow.zipImages;
  readonly zipMode = this.zipWorkflow.zipMode;
  readonly zipIndex = this.zipWorkflow.zipIndex;
  readonly zipProcessing = this.zipWorkflow.zipProcessing;
  readonly zipDisplaySeconds = this.zipWorkflow.zipDisplaySeconds;
  readonly zipBatchProgress = this.zipWorkflow.zipBatchProgress;
  readonly zipBatchTotal = this.zipWorkflow.zipBatchTotal;
  readonly zipBatchError = this.zipWorkflow.zipBatchError;
  readonly pendingZipImageCount = this.zipWorkflow.pendingZipImageCount;
  readonly currentZipImage = this.zipWorkflow.currentZipImage;

  ngOnDestroy(): void {
    this.zipWorkflow.clear();
    this.clearMediaPreview();
  }

  updateForm<K extends keyof PublicationEditorForm>(field: K, value: PublicationEditorForm[K]): void {
    this.updateFormValues({ [field]: value });
  }

  private updateFormValues(values: Partial<PublicationEditorForm>): void {
    this.formChange.emit({ ...this.form(), ...values });
  }

  requestZipUpload(input: HTMLInputElement): void {
    this.zipWorkflow.requestUpload();
    input.click();
  }

  allowDrop(event: DragEvent): void { event.preventDefault(); }

  private setError(message: string): void { this.errorChanged.emit(message); }

  requestClose(): void {
    if (this.saving() || this.zipProcessing()) return;
    this.closed.emit();
  }

  changeType(type: PublicationType): void {
    this.zipWorkflow.clear();
    this.updateFormValues({
      type,
      file: undefined,
      content: '',
      displaySeconds: this.displaySecondsForType(type),
      originalDurationSeconds: null,
    });
    this.clearMediaPreview();
  }

  private displaySecondsForType(type: PublicationType): number | null {
    if (type === 'VIDEO') return null;
    return DEFAULT_DISPLAY_SECONDS;
  }

  handleFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.selectFile(file);
  }

  handleFileDropped(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) void this.selectFile(file);
  }

  private async selectFile(file: File): Promise<void> {
    if (file.name.toLocaleLowerCase().endsWith('.zip')) {
      this.clearMediaPreview();
      await this.zipWorkflow.read(file);
      return;
    }
    this.selectMediaFile(file);
  }

  private selectMediaFile(file: File): void {
    this.zipWorkflow.clear();
    this.clearMediaPreview();
    this.updateFormValues({ file, title: file.name, originalDurationSeconds: null });
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '') ||
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (this.form().type === 'IMAGE' && isImage) {
      this.mediaPreviewUrl.set(URL.createObjectURL(file));
    } else if (this.form().type === 'VIDEO' && (extension === 'mp4' || file.type === 'video/mp4')) {
      void this.createVideoThumbnail(file);
    }
  }

  showZipImage(index: number): void {
    this.zipWorkflow.showImage(index);
  }

  setDisplaySeconds(seconds: number | null): void {
    this.updateFormValues({ displaySeconds: seconds });
    this.zipWorkflow.setDisplaySeconds(seconds);
  }

  adjustDuration(change: number): void {
    const current = this.form().displaySeconds ?? DEFAULT_DISPLAY_SECONDS;
    this.setDisplaySeconds(Math.min(3600, Math.max(1, current + change)));
  }

  private clearMediaPreview(): void {
    this.previewGeneration++;
    this.videoDurationDetected.set(false);
    const currentUrl = this.mediaPreviewUrl();
    if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
    this.mediaPreviewUrl.set(null);
    this.previewLoading.set(false);
    this.previewError.set('');
  }

  private async createVideoThumbnail(file: File): Promise<void> {
    const generation = this.previewGeneration;
    this.previewLoading.set(true);
    try {
      const preview = await generateVideoPreview(file);
      if (generation === this.previewGeneration) {
        this.mediaPreviewUrl.set(preview.thumbnailUrl);
        this.updateFormValues({ originalDurationSeconds: preview.durationSeconds });
        this.videoDurationDetected.set(true);
      }
    } catch (error) {
      if (generation === this.previewGeneration) {
        let message = 'Não foi possível ler a duração original. Informe-a manualmente para enviar.';
        if (error instanceof Error) message = `${error.message} Informe manualmente a duração original para enviar.`;
        this.previewError.set(message);
      }
    } finally {
      if (generation === this.previewGeneration) this.previewLoading.set(false);
    }
  }

  save(): void {
    this.setError('');
    this.zipBatchError.set('');
    if (this.form().type === 'MESSAGE' && this.form().content.length > this.maxMessageContentLength()) {
      this.setError(`A mensagem pode ter até ${this.maxMessageContentLength()} caracteres (cerca de 1 minuto de leitura).`);
      return;
    }
    if (this.currentZipImage()) {
      this.zipWorkflow.saveCurrent();
      return;
    }
    this.saving.set(true);
    const current = this.editingPublication();
    const linkUrl = this.normalizeLinkInput(this.form().linkUrl);
    const handlers = {
      next: () => {
        this.saving.set(false);
        this.requestClose();
        let message = 'Publicação enviada';
        if (current) message = 'Publicação atualizada';
        this.toast.show(message);
        this.listRefreshRequested.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.setError(errorMessage(error));
      },
    };

    if (current) {
      const changes: PublicationChanges = { title: this.form().title.trim() };
      if (this.form().type === 'MESSAGE') changes.content = this.form().content;
      if (this.form().type === 'VIDEO' || this.form().displaySeconds) {
        changes.displaySeconds = this.form().displaySeconds;
      }
      this.updateUC.execute(current.id, changes).subscribe(handlers);
      return;
    }

    this.createUC.execute({
      title: this.form().title, content: this.form().content, type: this.form().type, linkUrl, file: this.form().file,
      displaySeconds: this.form().displaySeconds ?? undefined,
      originalDurationSeconds: this.form().originalDurationSeconds ?? undefined,
    }).subscribe(handlers);
  }

  saveAllZipImages(): Promise<void> { return this.zipWorkflow.saveAll(); }

  private normalizeLinkInput(value: string): string {
    const input = value.trim();
    if (!input.startsWith('<')) return input;
    const document = new DOMParser().parseFromString(input, 'text/html');
    return document.querySelector('iframe')?.getAttribute('src')?.trim() ?? input;
  }
}
