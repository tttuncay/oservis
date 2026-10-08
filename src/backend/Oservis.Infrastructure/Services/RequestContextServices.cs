using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Oservis.Application.Common.Interfaces;

namespace Oservis.Infrastructure.Services;

public class TenantProvider : ITenantProvider
{
    private Guid? _tenantId;

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext == null) return;

        // 1. Read from Header (X-Tenant-Id or tenant_id)
        if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader) &&
            Guid.TryParse(tenantHeader.ToString(), out var parsedHeaderId))
        {
            _tenantId = parsedHeaderId;
            return;
        }

        // 2. Read from JWT Claims (tenant_id or app_metadata -> tenant_id)
        var user = httpContext.User;
        if (user.Identity?.IsAuthenticated == true)
        {
            var tenantClaim = user.FindFirst("tenant_id")?.Value
                ?? user.FindFirst("app_metadata.tenant_id")?.Value;

            if (!string.IsNullOrEmpty(tenantClaim) && Guid.TryParse(tenantClaim, out var parsedClaimId))
            {
                _tenantId = parsedClaimId;
            }
        }
    }

    public Guid? TenantId => _tenantId;

    public void SetTenantId(Guid tenantId)
    {
        _tenantId = tenantId;
    }
}

public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User?.FindFirst("sub")?.Value;

            return Guid.TryParse(idClaim, out var guid) ? guid : null;
        }
    }

    public string? Email => User?.FindFirst(ClaimTypes.Email)?.Value ?? User?.FindFirst("email")?.Value;

    public string? Role => User?.FindFirst(ClaimTypes.Role)?.Value ?? User?.FindFirst("role")?.Value;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public bool IsSysAdmin => Role?.Equals("SYSADMIN", StringComparison.OrdinalIgnoreCase) ?? false;
}
