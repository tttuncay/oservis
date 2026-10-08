using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Oservis.Application.Common.Interfaces;
using Oservis.Application.Common.Models;
using Oservis.Domain.Common.Exceptions;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Entities;
using Oservis.Domain.Enums;

namespace Oservis.Application.Features.Company;

// 1. Create School Command
public record CreateSchoolCommand(
    string Name,
    string? AddressText,
    double? Latitude,
    double? Longitude,
    TimeSpan? MorningStartTime,
    TimeSpan? AfternoonDismissalTime
) : IRequest<ApiResponse<Guid>>;

public class CreateSchoolCommandHandler : IRequestHandler<CreateSchoolCommand, ApiResponse<Guid>>
{
    private readonly IAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CreateSchoolCommandHandler(IAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<ApiResponse<Guid>> Handle(CreateSchoolCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantProvider.TenantId.HasValue)
            throw new DomainException("TENANT_REQUIRED", "Kiracı kimliği bulunamadı.");

        var school = new School
        {
            TenantId = _tenantProvider.TenantId.Value,
            Name = request.Name.Trim(),
            AddressText = request.AddressText?.Trim(),
            MorningStartTime = request.MorningStartTime,
            AfternoonDismissalTime = request.AfternoonDismissalTime,
            Geo = request.Latitude.HasValue && request.Longitude.HasValue 
                ? new GeoPoint(request.Latitude.Value, request.Longitude.Value) 
                : null
        };

        _context.Schools.Add(school);
        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<Guid>.Ok(school.Id, "Okul başarıyla eklendi.");
    }
}

// 2. Create Vehicle Command
public record CreateVehicleCommand(
    string Plate,
    int Capacity,
    string? MakeModel,
    DateOnly? InspectionDue,
    DateOnly? InsuranceDue
) : IRequest<ApiResponse<Guid>>;

public class CreateVehicleCommandHandler : IRequestHandler<CreateVehicleCommand, ApiResponse<Guid>>
{
    private readonly IAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CreateVehicleCommandHandler(IAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<ApiResponse<Guid>> Handle(CreateVehicleCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantProvider.TenantId.HasValue)
            throw new DomainException("TENANT_REQUIRED", "Kiracı kimliği bulunamadı.");

        var normalizedPlate = request.Plate.Replace(" ", "").ToUpperInvariant();

        var exists = await _context.Vehicles.AnyAsync(v => 
            v.TenantId == _tenantProvider.TenantId.Value && v.Plate == normalizedPlate, cancellationToken);
        if (exists)
            throw new DomainException("PLATE_ALREADY_EXISTS", "Bu plakaya sahip araç zaten kayıtlı.");

        var vehicle = new Vehicle
        {
            TenantId = _tenantProvider.TenantId.Value,
            Plate = normalizedPlate,
            Capacity = request.Capacity,
            MakeModel = request.MakeModel?.Trim(),
            InspectionDue = request.InspectionDue,
            InsuranceDue = request.InsuranceDue,
            Status = "ACTIVE"
        };

        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<Guid>.Ok(vehicle.Id, "Araç başarıyla eklendi.");
    }
}

// 3. Create Student Command with Address and Guardian Link
public record CreateStudentCommand(
    string FullName,
    Guid SchoolId,
    string? ClassName,
    DateOnly? DateOfBirth,
    string? MedicalNote,
    string HomeAddressText,
    double? HomeLatitude,
    double? HomeLongitude,
    string GuardianFullName,
    string GuardianPhone,
    string GuardianRelationship
) : IRequest<ApiResponse<Guid>>;

public class CreateStudentCommandHandler : IRequestHandler<CreateStudentCommand, ApiResponse<Guid>>
{
    private readonly IAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CreateStudentCommandHandler(IAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<ApiResponse<Guid>> Handle(CreateStudentCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantProvider.TenantId.HasValue)
            throw new DomainException("TENANT_REQUIRED", "Kiracı kimliği bulunamadı.");

        var tenantId = _tenantProvider.TenantId.Value;

        // 1. Create Student
        var student = new Student
        {
            TenantId = tenantId,
            FullName = request.FullName.Trim(),
            SchoolId = request.SchoolId,
            ClassName = request.ClassName?.Trim(),
            DateOfBirth = request.DateOfBirth,
            MedicalNote = request.MedicalNote?.Trim(),
            Status = "ACTIVE"
        };
        _context.Students.Add(student);

        // 2. Create Address
        var address = new Address
        {
            TenantId = tenantId,
            StudentId = student.Id,
            Type = AddressType.Home,
            Label = "Ev Adresi",
            AddressText = request.HomeAddressText.Trim(),
            Geo = request.HomeLatitude.HasValue && request.HomeLongitude.HasValue
                ? new GeoPoint(request.HomeLatitude.Value, request.HomeLongitude.Value)
                : null,
            GeoStatus = request.HomeLatitude.HasValue ? GeoStatus.Resolved : GeoStatus.Pending
        };
        _context.Addresses.Add(address);

        // 3. Find or Create Guardian User
        var phone = request.GuardianPhone.Trim();
        var guardianUser = await _context.Users.FirstOrDefaultAsync(u => u.PhoneE164 == phone, cancellationToken);
        if (guardianUser == null)
        {
            guardianUser = new User
            {
                FullName = request.GuardianFullName.Trim(),
                PhoneE164 = phone,
                Status = UserStatus.Active,
                PhoneVerified = true
            };
            _context.Users.Add(guardianUser);

            var membership = new UserTenantRole
            {
                UserId = guardianUser.Id,
                TenantId = tenantId,
                Role = RoleType.Parent,
                Status = UserStatus.Active,
                ApprovedAt = DateTime.UtcNow
            };
            _context.UserTenantRoles.Add(membership);
        }

        // 4. Create Guardian Link
        var guardianLink = new GuardianLink
        {
            TenantId = tenantId,
            StudentId = student.Id,
            UserId = guardianUser.Id,
            Relationship = request.GuardianRelationship.Trim(),
            IsPrimary = true
        };
        _context.GuardianLinks.Add(guardianLink);

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<Guid>.Ok(student.Id, "Öğrenci, ev adresi ve veli bağlantısı başarıyla oluşturuldu.");
    }
}
