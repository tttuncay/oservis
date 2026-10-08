using Oservis.Domain.Common;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Enums;

namespace Oservis.Domain.Entities;

public class FeePlan : TenantEntity
{
    public Guid? SchoolId { get; set; }
    public School? School { get; set; }
    public string Name { get; set; } = string.Empty;
    public Money BaseAmount { get; set; }
    public int InstalmentCount { get; set; } = 1;
    public decimal SiblingDiscountPercent { get; set; } = 0.00m;
    public decimal OneWayDiscountPercent { get; set; } = 0.00m;
    public bool Active { get; set; } = true;

    public ICollection<StudentFee> StudentFees { get; set; } = new List<StudentFee>();
}

public class StudentFee : TenantEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public Guid? FeePlanId { get; set; }
    public FeePlan? FeePlan { get; set; }
    public Money AgreedAmount { get; set; }
    public string AcademicYear { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public ICollection<Instalment> Instalments { get; set; } = new List<Instalment>();
}

public class Instalment : TenantEntity
{
    public Guid StudentFeeId { get; set; }
    public StudentFee StudentFee { get; set; } = null!;
    public int Sequence { get; set; }
    public DateOnly DueDate { get; set; }
    public Money Amount { get; set; }
    public Money PaidAmount { get; set; } = Money.Zero();
    public InstalmentStatus Status { get; set; } = InstalmentStatus.Pending;

    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}

public class Payment : TenantEntity
{
    public Guid? InstalmentId { get; set; }
    public Instalment? Instalment { get; set; }
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public Money Amount { get; set; }
    public string PaymentMethod { get; set; } = "CASH";
    public string? ReferenceNo { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public string? ReceiptNo { get; set; }
    public bool IsReversal { get; set; } = false;
    public Guid? ReversalOfId { get; set; }
    public string? ReversalReason { get; set; }
    public string? Notes { get; set; }
}

public class Expense : TenantEntity
{
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    public string Category { get; set; } = "FUEL";
    public Money Amount { get; set; }
    public DateOnly ExpenseDate { get; set; }
    public string? InvoiceNo { get; set; }
    public string? Description { get; set; }
    public bool IsReversal { get; set; } = false;
    public Guid? ReversalOfId { get; set; }
    public string? ReversalReason { get; set; }
}

public class Lead : TenantEntity
{
    public string ParentName { get; set; } = string.Empty;
    public string PhoneE164 { get; set; } = string.Empty;
    public string? StudentName { get; set; }
    public string? SchoolName { get; set; }
    public string? AddressText { get; set; }
    public string Status { get; set; } = "NEW";
    public string Source { get; set; } = "WEB_FORM";
}

public class AuditLog : BaseEntity
{
    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string ChangesJson { get; set; } = "{}";
}

public class DeviceToken : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid? TenantId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = "ANDROID"; // ANDROID, IOS, WEB
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}

public class NotificationMessage : BaseEntity
{
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }
    public string Channel { get; set; } = "PUSH"; // PUSH, SMS, EMAIL
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "SENT";
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public string? ErrorMessage { get; set; }
}
