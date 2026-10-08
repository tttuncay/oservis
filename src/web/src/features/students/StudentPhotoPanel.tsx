import { useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { Student } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useStudentPhotoUrl } from '@/api/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MutatingButton } from '@/components/MutatingButton';
import { ErrorState } from '@/components/ErrorState';
import { t } from '@/i18n';

/**
 * The student's photograph — FR-CMP-050, FR-KVK-100, NFR-SEC-080.
 *
 * ## The URL is minted per view and expires
 *
 * The image is never a public URL on the student payload. `GET /students/:id/photo-url`
 * returns a signed URL valid for fifteen minutes (NFR-SEC-080), fetched only when this
 * panel is on screen and only for a student who has one. That is why `hasPhoto` is a
 * boolean on the student and the URL is a separate call: a list of two hundred children
 * must not mint two hundred signed URLs, and a URL sitting in a list payload is one that
 * can be copied out and shared.
 *
 * The upload's type is decided by the file's leading bytes on the server, not by what
 * the browser declared, so a renamed executable is rejected there rather than here.
 */
export function StudentPhotoPanel({ student }: { student: Student }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);

  const photo = useStudentPhotoUrl(student.id, student.hasPhoto);

  const upload = useResourceMutation(
    (file: File) => api.students.setPhoto(student.id, file),
    [keys.students],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('student.photo')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-40 w-32 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {student.hasPhoto && photo.data ? (
            <img
              src={photo.data.url}
              alt={student.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageOff aria-hidden className="h-6 w-6" />
              <span className="text-xs">{t('student.noPhoto')}</span>
            </div>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploadError(null);
            upload.mutateAsync(file).catch(setUploadError);
            // Cleared so choosing the same file twice fires a change event again.
            event.target.value = '';
          }}
        />

        <MutatingButton
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => fileInput.current?.click()}
        >
          {student.hasPhoto ? t('student.photoReplace') : t('student.photoUpload')}
        </MutatingButton>

        <p className="text-xs text-muted-foreground">{t('student.photoHint')}</p>

        {uploadError ? <ErrorState error={uploadError} /> : null}
      </CardContent>
    </Card>
  );
}
