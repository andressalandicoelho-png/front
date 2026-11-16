import { computed, WritableSignal, signal } from '@angular/core';
import { CreatePublicationUseCase } from '@application/publication/publication.usecases';
import { DEFAULT_DISPLAY_SECONDS, validateNewPublication } from '@domain/publication/publication.entity';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@presentation/core/error-message';
import { ToastService } from '@presentation/core/toast.service';
import { extractZipImageFiles } from '@presentation/core/zip-image-extractor';
import { PublicationEditorForm, ZipImagePreview } from './publication-editor.models';

export class PublicationZipWorkflow {
  readonly zipImages = signal<ZipImagePreview[]>([]);
  readonly zipMode = signal(false);
  readonly zipIndex = signal(0);
  readonly zipProcessing = signal(false);
  readonly zipDisplaySeconds = signal<number | null>(DEFAULT_DISPLAY_SECONDS);
  readonly zipBatchProgress = signal(0);
  readonly zipBatchTotal = signal(0);
  readonly zipBatchError = signal('');
  readonly pendingZipImageCount = computed(() => this.zipImages().filter(image => !image.created).length);
  readonly currentZipImage = computed(() => this.zipImages()[this.zipIndex()] ?? null);

  constructor(
    private readonly createPublication: CreatePublicationUseCase,
    private readonly toast: ToastService,
    private readonly readForm: () => PublicationEditorForm,
    private readonly updateForm: (values: Partial<PublicationEditorForm>) => void,
    private readonly normalizeLinkInput: (value: string) => string,
    private readonly saving: WritableSignal<boolean>,
    private readonly setError: (message: string) => void,
    private readonly close: () => void,
    private readonly refreshList: () => void,
  ) {}

  requestUpload(): void {
    this.zipMode.set(true);
  }

  async read(file: File): Promise<void> {
    this.clear();
    this.setError('');
    this.updateForm({
      type: 'IMAGE',
      file: undefined,
      title: '',
      displaySeconds: DEFAULT_DISPLAY_SECONDS,
    });
    this.zipMode.set(true);
    this.zipDisplaySeconds.set(DEFAULT_DISPLAY_SECONDS);
    this.zipProcessing.set(true);
    try {
      const imageFiles = await extractZipImageFiles(file);
      this.zipImages.set(imageFiles.map(imageFile => ({
        file: imageFile,
        previewUrl: URL.createObjectURL(imageFile),
        title: imageFile.name,
        created: false,
      })));
      this.zipIndex.set(0);
      this.applyImage(0);
    } catch (error) {
      this.clear();
      let message = 'Não foi possível ler o arquivo ZIP.';
      if (error instanceof Error) message = error.message;
      this.setError(message);
    } finally {
      this.zipProcessing.set(false);
    }
  }

  showImage(index: number): void {
    if (index < 0 || index >= this.zipImages().length || index === this.zipIndex()) return;
    this.saveCurrentForm();
    this.zipIndex.set(index);
    this.applyImage(index);
    this.setError('');
  }

  setDisplaySeconds(seconds: number | null): void {
    if (this.zipImages().length) this.zipDisplaySeconds.set(seconds);
  }

  saveCurrent(): void {
    const image = this.currentZipImage();
    if (!image) return;
    this.saveCurrentForm();
    this.zipBatchError.set('');
    const form = this.readForm();
    this.saving.set(true);
    this.createPublication.execute({
      title: form.title,
      content: form.content,
      type: form.type,
      linkUrl: this.normalizeLinkInput(form.linkUrl),
      file: form.file,
      displaySeconds: form.displaySeconds ?? undefined,
      originalDurationSeconds: form.originalDurationSeconds ?? undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.zipImages.update(images => images.map((item, index) => {
          if (index === this.zipIndex()) return { ...item, created: true };
          return item;
        }));
        this.toast.show('Conteúdo criado para esta imagem');
        this.refreshList();
      },
      error: error => {
        this.saving.set(false);
        this.setError(errorMessage(error));
      },
    });
  }

  async saveAll(): Promise<void> {
    this.setError('');
    this.zipBatchError.set('');
    this.saveCurrentForm();
    const pendingImages = this.zipImages().filter(image => !image.created);
    if (!pendingImages.length) return;
    const displaySeconds = this.zipDisplaySeconds();
    if (displaySeconds === null || !Number.isInteger(displaySeconds) || displaySeconds < 1 || displaySeconds > 3600) {
      this.setError('A duração deve ser um número inteiro entre 1 e 3600 segundos.');
      return;
    }

    for (const [index, image] of this.zipImages().entries()) {
      if (image.created) continue;
      const validationError = validateNewPublication({
        title: image.title,
        type: 'IMAGE',
        file: image.file,
        displaySeconds,
      });
      if (validationError) {
        this.zipIndex.set(index);
        this.applyImage(index);
        this.setError(`${image.file.name}: ${validationError}`);
        return;
      }
    }

    this.zipBatchProgress.set(0);
    this.zipBatchTotal.set(pendingImages.length);
    this.saving.set(true);
    try {
      for (const image of pendingImages) {
        await firstValueFrom(this.createPublication.execute({
          title: image.title,
          type: 'IMAGE',
          file: image.file,
          displaySeconds,
        }));
        this.zipImages.update(images => images.map(candidate => {
          if (candidate === image) return { ...candidate, created: true };
          return candidate;
        }));
        this.zipBatchProgress.update(progress => progress + 1);
      }
    } catch (error) {
      this.zipBatchError.set(errorMessage(error));
      this.refreshList();
      return;
    } finally {
      this.saving.set(false);
    }

    this.close();
    this.toast.show(`${pendingImages.length} imagens criadas como conteúdos`);
    this.refreshList();
  }

  clear(): void {
    for (const image of this.zipImages()) URL.revokeObjectURL(image.previewUrl);
    this.zipImages.set([]);
    this.zipMode.set(false);
    this.zipIndex.set(0);
    this.zipDisplaySeconds.set(DEFAULT_DISPLAY_SECONDS);
    this.zipBatchProgress.set(0);
    this.zipBatchTotal.set(0);
    this.zipBatchError.set('');
  }

  private saveCurrentForm(): void {
    const index = this.zipIndex();
    this.zipImages.update(images => images.map((image, imageIndex) => {
      if (imageIndex === index) return { ...image, title: this.readForm().title };
      return image;
    }));
  }

  private applyImage(index: number): void {
    const image = this.zipImages()[index];
    if (!image) return;
    this.updateForm({
      file: image.file,
      title: image.title,
      displaySeconds: this.zipDisplaySeconds(),
      originalDurationSeconds: null,
    });
  }
}
