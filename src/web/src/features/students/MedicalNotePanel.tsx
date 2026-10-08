import { useState } from 'react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import type { Student } from '@servisapp/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';

/**
 * FR-KVK-100 — the medical note, behind an explicit reveal.
 *
 * ## The reveal is a courtesy; the omission is the control
 *
 * `medicalNote` is an **optional property, absent** from the payload when the caller
 * fails the server's policy — not null, not empty, absent. `null` would itself be a
 * disclosure ("this child has no medical note" is something a driver who should not be
 * asking has now learned); an absent key says nothing either way. So a client that
 * ignored this component still could not leak the note: it was never sent.
 *
 * What the reveal adds is that an Admin working with a parent leaning over the desk does
 * not have a child's medical history on screen by default. That is a shoulder-surfing
 * measure, not an access control, and it is worth having for exactly that.
 *
 * The distinction matters in the payload: `undefined` means "not permitted to see",
 * `null` means "permitted, and there is none". They render differently.
 */
export function MedicalNotePanel({ student }: { student: Student }) {
  const [revealed, setRevealed] = useState(false);

  // The key is absent for a caller the policy refused. An Admin always passes it, so
  // reaching this branch on the admin console means the server declined — say nothing
  // rather than guess.
  const permitted = 'medicalNote' in student;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('student.medicalNote')}</CardTitle>
        {permitted && student.medicalNote ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setRevealed((open) => !open)}
          >
            {revealed ? (
              <>
                <EyeOff aria-hidden className="h-4 w-4" />
                {t('student.hideMedicalNote')}
              </>
            ) : (
              <>
                <Eye aria-hidden className="h-4 w-4" />
                {t('student.revealMedicalNote')}
              </>
            )}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {!permitted ? (
          <p className="text-sm text-muted-foreground">
            {t('error.STUDENT_SENSITIVE_DATA_FORBIDDEN')}
          </p>
        ) : !student.medicalNote ? (
          <p className="text-sm text-muted-foreground">{t('student.noMedicalNote')}</p>
        ) : revealed ? (
          <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
            {student.medicalNote}
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5">
            <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{t('student.medicalNoteWarning')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
