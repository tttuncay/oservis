using Oservis.Domain.Entities;
using Oservis.Domain.Enums;

namespace Oservis.Application.Common.Interfaces;

public record AuthResultDto(
    string AccessToken,
    string RefreshToken,
    Guid UserId,
    string FullName,
    string Email,
    Guid TenantId,
    string Role
);

public interface IAuthService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    string GenerateJwtToken(User user, Guid? tenantId, string role);
}
