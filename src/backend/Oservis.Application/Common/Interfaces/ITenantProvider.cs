namespace Oservis.Application.Common.Interfaces;

public interface ITenantProvider
{
    Guid? TenantId { get; }
    void SetTenantId(Guid tenantId);
}

public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Email { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
    bool IsSysAdmin { get; }
}
