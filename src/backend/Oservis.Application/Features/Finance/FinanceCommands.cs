using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Oservis.Application.Common.Interfaces;
using Oservis.Application.Common.Models;
using Oservis.Domain.Common.Exceptions;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Entities;
using Oservis.Domain.Enums;

namespace Oservis.Application.Features.Finance;

// 1. Create Student Fee & Auto Generate Instalments Command
public record CreateStudentFeeCommand(
    Guid StudentId,
    decimal AgreedAmount,
    int InstalmentCount,
    DateOnly FirstInstalmentDueDate,
    string AcademicYear,
    string? Notes
) : IRequest<ApiResponse<Guid>>;

public class CreateStudentFeeCommandHandler : IRequestHandler<CreateStudentFeeCommand, ApiResponse<Guid>>
{
    private readonly IAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CreateStudentFeeCommandHandler(IAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<ApiResponse<Guid>> Handle(CreateStudentFeeCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantProvider.TenantId.HasValue)
            throw new DomainException("TENANT_REQUIRED", "Kiracı kimliği bulunamadı.");

        var count = Math.Max(1, request.InstalmentCount);
        var totalAmount = request.AgreedAmount;
        var instalmentAmount = decimal.Round(totalAmount / count, 2, MidpointRounding.AwayFromZero);

        var studentFee = new StudentFee
        {
            TenantId = _tenantProvider.TenantId.Value,
            StudentId = request.StudentId,
            AgreedAmount = new Money(totalAmount),
            AcademicYear = request.AcademicYear,
            Notes = request.Notes
        };
        _context.StudentFees.Add(studentFee);

        // Generate Instalments
        decimal runningTotal = 0m;
        for (int i = 1; i <= count; i++)
        {
            // The last instalment absorbs the rounding remainder
            var currentInstalmentAmount = (i == count) 
                ? (totalAmount - runningTotal) 
                : instalmentAmount;

            runningTotal += currentInstalmentAmount;

            var instalment = new Instalment
            {
                TenantId = _tenantProvider.TenantId.Value,
                StudentFeeId = studentFee.Id,
                Sequence = i,
                DueDate = request.FirstInstalmentDueDate.AddMonths(i - 1),
                Amount = new Money(currentInstalmentAmount),
                PaidAmount = Money.Zero(),
                Status = InstalmentStatus.Pending
            };
            _context.Instalments.Add(instalment);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<Guid>.Ok(studentFee.Id, $"{count} taksitli ücret planı başarıyla oluşturuldu.");
    }
}

// 2. Record Payment Command (Append-Only Tahsilat)
public record RecordPaymentCommand(
    Guid InstalmentId,
    decimal Amount,
    string PaymentMethod,
    string? ReferenceNo,
    string? Notes
) : IRequest<ApiResponse<Guid>>;

public class RecordPaymentCommandHandler : IRequestHandler<RecordPaymentCommand, ApiResponse<Guid>>
{
    private readonly IAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public RecordPaymentCommandHandler(IAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<ApiResponse<Guid>> Handle(RecordPaymentCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantProvider.TenantId.HasValue)
            throw new DomainException("TENANT_REQUIRED", "Kiracı kimliği bulunamadı.");

        if (request.Amount <= 0)
            throw new DomainException("INVALID_AMOUNT", "Ödeme tutarı sıfırdan büyük olmalıdır.");

        var instalment = await _context.Instalments
            .Include(i => i.StudentFee)
            .FirstOrDefaultAsync(i => i.Id == request.InstalmentId, cancellationToken);

        if (instalment == null)
            throw new DomainException("INSTALMENT_NOT_FOUND", "Taksit bulunamadı.");

        var paymentMoney = new Money(request.Amount);

        // Append-only Payment Record
        var payment = new Payment
        {
            TenantId = _tenantProvider.TenantId.Value,
            InstalmentId = instalment.Id,
            StudentId = instalment.StudentFee.StudentId,
            Amount = paymentMoney,
            PaymentMethod = request.PaymentMethod,
            ReferenceNo = request.ReferenceNo,
            PaidAt = DateTime.UtcNow,
            ReceiptNo = $"RCP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            Notes = request.Notes
        };
        _context.Payments.Add(payment);

        // Update Instalment Balance
        var newPaidAmount = instalment.PaidAmount + paymentMoney;
        instalment.PaidAmount = newPaidAmount;

        if (newPaidAmount.Amount >= instalment.Amount.Amount)
        {
            instalment.Status = InstalmentStatus.Paid;
        }
        else
        {
            instalment.Status = InstalmentStatus.Partial;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<Guid>.Ok(payment.Id, "Ödeme başarıyla tahsil edildi ve makbuz üretildi.");
    }
}
