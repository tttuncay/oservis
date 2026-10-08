using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Oservis.Application.Common.Interfaces;
using Oservis.Application.Common.Models;
using Oservis.Domain.Common.Exceptions;
using Oservis.Domain.Entities;
using Oservis.Domain.Enums;

namespace Oservis.Application.Features.Auth;

// 1. Login Command
public record LoginCommand(string EmailOrPhone, string Password) : IRequest<ApiResponse<AuthResultDto>>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.EmailOrPhone).NotEmpty().WithMessage("E-posta veya telefon numarası gereklidir.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Şifre gereklidir.");
    }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, ApiResponse<AuthResultDto>>
{
    private readonly IAppDbContext _context;
    private readonly IAuthService _authService;

    public LoginCommandHandler(IAppDbContext context, IAuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    public async Task<ApiResponse<AuthResultDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var identifier = request.EmailOrPhone.Trim().ToLowerInvariant();

        var user = await _context.Users
            .Include(u => u.Memberships)
            .FirstOrDefaultAsync(u => u.Email == identifier || u.PhoneE164 == identifier, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
            throw new DomainException("INVALID_CREDENTIALS", "Geçersiz e-posta/telefon veya şifre.");

        if (!_authService.VerifyPassword(request.Password, user.PasswordHash))
        {
            user.FailedAttempts++;
            if (user.FailedAttempts >= 5)
            {
                user.LockedUntil = DateTime.UtcNow.AddMinutes(15);
            }
            await _context.SaveChangesAsync(cancellationToken);
            throw new DomainException("INVALID_CREDENTIALS", "Geçersiz e-posta/telefon veya şifre.");
        }

        user.FailedAttempts = 0;
        user.LockedUntil = null;

        // Resolve primary tenant and role
        var activeMembership = user.Memberships.FirstOrDefault(m => m.Status == UserStatus.Active)
            ?? user.Memberships.FirstOrDefault();

        var tenantId = activeMembership?.TenantId ?? Guid.Empty;
        var role = user.PlatformRole?.ToString() ?? activeMembership?.Role.ToString() ?? "PARENT";

        var token = _authService.GenerateJwtToken(user, tenantId, role);

        // Generate Refresh Token
        var refreshToken = Guid.NewGuid().ToString("N");
        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refreshToken,
            FamilyId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        });

        await _context.SaveChangesAsync(cancellationToken);

        var result = new AuthResultDto(
            AccessToken: token,
            RefreshToken: refreshToken,
            UserId: user.Id,
            FullName: user.FullName,
            Email: user.Email ?? string.Empty,
            TenantId: tenantId,
            Role: role
        );

        return ApiResponse<AuthResultDto>.Ok(result, "Giriş başarılı.");
    }
}

// 2. Register Tenant & Admin Command
public record RegisterTenantCommand(
    string CompanyLegalName,
    string AdminFullName,
    string AdminEmail,
    string AdminPhone,
    string Password
) : IRequest<ApiResponse<AuthResultDto>>;

public class RegisterTenantCommandValidator : AbstractValidator<RegisterTenantCommand>
{
    public RegisterTenantCommandValidator()
    {
        RuleFor(x => x.CompanyLegalName).NotEmpty().WithMessage("Firma adı gereklidir.");
        RuleFor(x => x.AdminFullName).NotEmpty().WithMessage("Yönetici adı gereklidir.");
        RuleFor(x => x.AdminEmail).NotEmpty().EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.");
        RuleFor(x => x.AdminPhone).NotEmpty().WithMessage("Telefon numarası gereklidir.");
        RuleFor(x => x.Password).MinimumLength(6).WithMessage("Şifre en az 6 karakter olmalıdır.");
    }
}

public class RegisterTenantCommandHandler : IRequestHandler<RegisterTenantCommand, ApiResponse<AuthResultDto>>
{
    private readonly IAppDbContext _context;
    private readonly IAuthService _authService;

    public RegisterTenantCommandHandler(IAppDbContext context, IAuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    public async Task<ApiResponse<AuthResultDto>> Handle(RegisterTenantCommand request, CancellationToken cancellationToken)
    {
        var email = request.AdminEmail.Trim().ToLowerInvariant();
        var existingUser = await _context.Users.AnyAsync(u => u.Email == email, cancellationToken);
        if (existingUser)
            throw new DomainException("EMAIL_ALREADY_EXISTS", "Bu e-posta adresiyle kayıtlı bir hesap zaten var.");

        // 1. Create Tenant
        var tenant = new Tenant
        {
            LegalName = request.CompanyLegalName.Trim(),
            Status = TenantStatus.Trial,
            TrialEndsAt = DateTime.UtcNow.AddDays(30)
        };
        _context.Tenants.Add(tenant);

        // 2. Create Admin User
        var user = new User
        {
            FullName = request.AdminFullName.Trim(),
            Email = email,
            PhoneE164 = request.AdminPhone.Trim(),
            PasswordHash = _authService.HashPassword(request.Password),
            PhoneVerified = true,
            Status = UserStatus.Active
        };
        _context.Users.Add(user);

        // 3. Bind Role
        var membership = new UserTenantRole
        {
            UserId = user.Id,
            TenantId = tenant.Id,
            Role = RoleType.Admin,
            Status = UserStatus.Active,
            ApprovedAt = DateTime.UtcNow
        };
        _context.UserTenantRoles.Add(membership);

        await _context.SaveChangesAsync(cancellationToken);

        var token = _authService.GenerateJwtToken(user, tenant.Id, "ADMIN");
        var refreshToken = Guid.NewGuid().ToString("N");

        var result = new AuthResultDto(
            AccessToken: token,
            RefreshToken: refreshToken,
            UserId: user.Id,
            FullName: user.FullName,
            Email: user.Email,
            TenantId: tenant.Id,
            Role: "ADMIN"
        );

        return ApiResponse<AuthResultDto>.Ok(result, "Şirket ve yönetici hesabı başarıyla oluşturuldu.");
    }
}
