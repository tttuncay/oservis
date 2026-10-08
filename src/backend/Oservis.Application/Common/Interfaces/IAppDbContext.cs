using Microsoft.EntityFrameworkCore;
using Oservis.Domain.Entities;

namespace Oservis.Application.Common.Interfaces;

public interface IAppDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<SubscriptionPlan> SubscriptionPlans { get; }
    DbSet<User> Users { get; }
    DbSet<UserTenantRole> UserTenantRoles { get; }
    DbSet<SocialIdentity> SocialIdentities { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<OtpChallenge> OtpChallenges { get; }

    DbSet<School> Schools { get; }
    DbSet<Vehicle> Vehicles { get; }
    DbSet<Staff> StaffMembers { get; }
    DbSet<VehicleAssignment> VehicleAssignments { get; }
    DbSet<Student> Students { get; }
    DbSet<Address> Addresses { get; }
    DbSet<GuardianLink> GuardianLinks { get; }
    DbSet<RouteTemplate> RouteTemplates { get; }
    DbSet<RouteTemplateStudent> RouteTemplateStudents { get; }

    DbSet<AbsenceDeclaration> AbsenceDeclarations { get; }
    DbSet<Trip> Trips { get; }
    DbSet<TripStop> TripStops { get; }
    DbSet<TripStopStudent> TripStopStudents { get; }
    DbSet<SweepCheck> SweepChecks { get; }
    DbSet<LocationPing> LocationPings { get; }

    DbSet<FeePlan> FeePlans { get; }
    DbSet<StudentFee> StudentFees { get; }
    DbSet<Instalment> Instalments { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Expense> Expenses { get; }
    DbSet<Lead> Leads { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<DeviceToken> DeviceTokens { get; }
    DbSet<NotificationMessage> NotificationMessages { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
