import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVehicleSchema, type CreateVehicleDto } from '@servisapp/shared';
import { ApiError } from '@/api/client';
import { Form, TextField } from './FormKit';
import { ReadOnlyProvider } from './ReadOnlyProvider';
import { MutatingButton } from './MutatingButton';
import { t } from '@/i18n';

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth(),
}));

let tenantStatus: 'ACTIVE' | 'READ_ONLY' | 'SUSPENDED' = 'ACTIVE';

function mockAuth() {
  return { membership: { tenantStatus, tenantName: 'Test A.Ş.', role: 'ADMIN' } };
}

function renderVehicleForm(onSubmit: (values: CreateVehicleDto) => void, submitError?: unknown) {
  return render(
    <ReadOnlyProvider>
      <Form
        schema={createVehicleSchema}
        defaultValues={{ plate: '', capacity: 16 } as CreateVehicleDto}
        submitError={submitError}
        onSubmit={(values) => onSubmit(values as CreateVehicleDto)}
      >
        <TextField<CreateVehicleDto> name="plate" label="Plaka" />
        <TextField<CreateVehicleDto> name="capacity" label="Kapasite" type="number" />
      </Form>
    </ReadOnlyProvider>,
  );
}

/**
 * FormKit's contract: React Hook Form validated by the **shared** Zod schema, so client
 * and server apply the same rules (SDD §15.2).
 *
 * The tests below use `createVehicleSchema` rather than a schema invented for the test.
 * That is the point being verified — that a real server DTO's rules reach the browser —
 * and a stand-in schema would test only that React Hook Form works.
 */
describe('FormKit', () => {
  beforeEachResetTenant();

  it('applies the shared schema’s rules, not a second copy of them', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderVehicleForm(onSubmit);

    // `plateSchema` is a Turkish civil plate. This is not one.
    await user.type(screen.getByLabelText('Plaka'), 'NOT-A-PLATE');
    await user.click(screen.getByRole('button', { name: t('common.save') }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/1 hata/)).toBeInTheDocument();
  });

  it('normalises the way the server does and submits the canonical value', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderVehicleForm(onSubmit);

    // The shared schema upper-cases and strips spaces before validating, so what the
    // Admin typed and what the unique index sees are the same string.
    await user.type(screen.getByLabelText('Plaka'), '34 abc 123');
    await user.click(screen.getByRole('button', { name: t('common.save') }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ plate: '34ABC123', capacity: 16 });
  });

  it('sends a numeric field as a number, not as the string an input produces', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderVehicleForm(onSubmit);

    await user.type(screen.getByLabelText('Plaka'), '34ABC123');
    await user.clear(screen.getByLabelText('Kapasite'));
    await user.type(screen.getByLabelText('Kapasite'), '22');
    await user.click(screen.getByRole('button', { name: t('common.save') }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0]?.capacity).toBe(22);
  });

  /** NFR-USA-060 — the server's Turkish sentence reaches the user; the code does not. */
  it('renders the server’s message on a rejected submit, never its code', () => {
    renderVehicleForm(vi.fn(), new ApiError(
      'VEHICLE_PLATE_DUPLICATE',
      'Bu plaka başka bir araca kayıtlı. Plakayı kontrol edin.',
      409,
      null,
    ));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Bu plaka başka bir araca kayıtlı. Plakayı kontrol edin.',
    );
    expect(screen.queryByText(/VEHICLE_PLATE_DUPLICATE/)).toBeNull();
  });

  /**
   * FR-SYS-060 — *"every mutating control is disabled and the reason is displayed"*.
   *
   * The fieldset is what makes this hold for controls a screen forgot to wrap
   * individually, which is the failure mode a per-button rule has.
   */
  describe('read-only mode (FR-SYS-060)', () => {
    it('disables every control and states why', async () => {
      tenantStatus = 'READ_ONLY';
      renderVehicleForm(vi.fn());

      expect(screen.getByLabelText('Plaka')).toBeDisabled();
      expect(screen.getByLabelText('Kapasite')).toBeDisabled();

      const submit = screen.getByRole('button', { name: t('common.save') });
      expect(submit).toBeDisabled();
      // Not merely greyed out: hovering says why, so the panel does not read as broken.
      expect(submit).toHaveAttribute('title', t('readOnly.controlDisabled'));
    });

    it('shows the reason once at the top of the console', () => {
      tenantStatus = 'READ_ONLY';
      renderVehicleForm(vi.fn());

      expect(screen.getByRole('status')).toHaveTextContent(t('readOnly.title'));
    });

    it('distinguishes a suspended account from a read-only one', () => {
      tenantStatus = 'SUSPENDED';
      renderVehicleForm(vi.fn());

      expect(screen.getByRole('status')).toHaveTextContent(t('readOnly.suspendedBody'));
    });

    it('leaves controls enabled for an ordinary tenant', () => {
      tenantStatus = 'ACTIVE';
      renderVehicleForm(vi.fn());

      expect(screen.getByLabelText('Plaka')).toBeEnabled();
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  describe('MutatingButton', () => {
    it('is disabled by read-only mode wherever it appears', () => {
      tenantStatus = 'READ_ONLY';

      render(
        <ReadOnlyProvider>
          <MutatingButton>Sil</MutatingButton>
        </ReadOnlyProvider>,
      );

      expect(screen.getByRole('button', { name: 'Sil' })).toBeDisabled();
    });
  });
});

/** Each test starts from a writable tenant; the read-only cases opt in. */
function beforeEachResetTenant() {
  beforeEach(() => {
    tenantStatus = 'ACTIVE';
  });
}
