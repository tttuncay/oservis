import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStudent } from '@/api/hooks';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { MutatingButton } from '@/components/MutatingButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StudentDialog } from './StudentDialog';
import { StudentAddressesPanel } from './StudentAddressesPanel';
import { StudentGuardiansPanel } from './StudentGuardiansPanel';
import { StudentPhotoPanel } from './StudentPhotoPanel';
import { MedicalNotePanel } from './MedicalNotePanel';
import { t } from '@/i18n';

/**
 * One student — FR-CMP-050, and the surfaces of FR-CMP-100, FR-CMP-120 and FR-KVK-100.
 *
 * A full screen rather than a dialog: the addresses tab carries a map, and a map inside a
 * modal on a 1280×720 viewport leaves no room for the form beside it.
 */
export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const query = useStudent(studentId);
  const [editing, setEditing] = useState(false);

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const student = query.data;
  if (!student) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 gap-1.5">
        <Link to="/admin/students">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('common.back')}
        </Link>
      </Button>

      <PageHeader
        title={student.fullName}
        description={`${student.schoolName}${student.className ? ` · ${student.className}` : ''}`}
        actions={
          <MutatingButton variant="outline" onClick={() => setEditing(true)}>
            {t('common.edit')}
          </MutatingButton>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t('student.tabDetails')}</TabsTrigger>
          <TabsTrigger value="addresses">{t('student.tabAddresses')}</TabsTrigger>
          <TabsTrigger value="guardians">{t('student.tabGuardians')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="grid max-w-4xl grid-cols-2 gap-6">
          <StudentPhotoPanel student={student} />
          {/* FR-KVK-100 — behind an explicit reveal, never rendered by default. */}
          <MedicalNotePanel student={student} />
        </TabsContent>

        <TabsContent value="addresses">
          <StudentAddressesPanel studentId={student.id} />
        </TabsContent>

        <TabsContent value="guardians">
          <StudentGuardiansPanel studentId={student.id} />
        </TabsContent>
      </Tabs>

      {editing ? <StudentDialog student={student} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
