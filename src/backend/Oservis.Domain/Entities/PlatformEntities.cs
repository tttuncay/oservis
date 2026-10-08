using Oservis.Domain.Common;
using Oservis.Domain.Enums;

namespace Oservis.Domain.Entities;

public class SubscriptionPlan : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string TiersJson { get; set; } = "[]";
    public string Currency { get; set; } = "TRY";
    public DateTime? ArchivedAt { get; set; }

    public ICollection<Tenant> Tenants { get; set; } = new List<Tenant>();
}

public class Tenant : BaseEntity
{
    public string LegalName { get; set; } = string.Empty;
    public string? TaxNo { get; set; }
    public TenantStatus Status { get; set; } = TenantStatus.Trial;
    public string Timezone { get; set; } = "Europe/Istanbul";
    public DateTime? TrialEndsAt { get; set; }
    public DateTime? GraceEndsAt { get; set; }
    public Guid? PlanId { get; set; }
    public SubscriptionPlan? Plan { get; set; }
    public DateTime? ReadOnlySince { get; set; }
    public DateTime? SuspendedAt { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public string? PublicSlug { get; set; }

    public ICollection<UserTenantRole> Memberships { get; set; } = new List<UserTenantRole>();
    public ICollection<School> Schools { get; set; } = new List<School>();
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<Staff> StaffMembers { get; set; } = new List<Staff>();
    public ICollection<Student> Students { get; set; } = new List<Student>();
    public ICollection<RouteTemplate> RouteTemplates { get; set; } = new List<RouteTemplate>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}

public class User : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string? PhoneE164 { get; set; }
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public bool PhoneVerified { get; set; } = false;
    public UserStatus Status { get; set; } = UserStatus.PendingApproval;
    public string Locale { get; set; } = "tr";
    public RoleType? PlatformRole { get; set; }
    public int FailedAttempts { get; set; } = 0;
    public DateTime? LockedUntil { get; set; }

    public ICollection<UserTenantRole> Memberships { get; set; } = new List<UserTenantRole>();
    public ICollection<SocialIdentity> SocialIdentities { get; set; } = new List<SocialIdentity>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<GuardianLink> GuardianLinks { get; set; } = new List<GuardianLink>();
    public ICollection<Staff> StaffRecords { get; set; } = new List<Staff>();
}

public class UserTenantRole : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public RoleType Role { get; set; }
    public UserStatus Status { get; set; } = UserStatus.PendingApproval;
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectedReason { get; set; }
    public DateTime? RejectedAt { get; set; }
    public DateTime? InvitedAt { get; set; }
    public int InviteCount { get; set; } = 0;
}

public class SocialIdentity : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Provider { get; set; } = string.Empty; // GOOGLE, APPLE
    public string ProviderSubject { get; set; } = string.Empty;
    public string? EmailAtSignup { get; set; }
}

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public bool IsRevoked { get; set; } = false;
    public DateTime ExpiresAt { get; set; }
    public string? CreatedByIp { get; set; }
    public string? UserAgent { get; set; }
}

public class OtpChallenge : BaseEntity
{
    public Guid? UserId { get; set; }
    public string PhoneE164 { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public OtpPurpose Purpose { get; set; }
    public int Attempts { get; set; } = 0;
    public bool IsRedeemed { get; set; } = false;
    public DateTime ExpiresAt { get; set; }
}
