using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using NetTopologySuite.Geometries;
using Oservis.Application.Common.Interfaces;
using Oservis.Domain.Common;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Entities;

namespace Oservis.Persistence.Contexts;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ITenantProvider _tenantProvider;
    private readonly ICurrentUser _currentUser;

    public AppDbContext(
        DbContextOptions<AppDbContext> options,
        ITenantProvider tenantProvider,
        ICurrentUser currentUser) : base(options)
    {
        _tenantProvider = tenantProvider;
        _currentUser = currentUser;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserTenantRole> UserTenantRoles => Set<UserTenantRole>();
    public DbSet<SocialIdentity> SocialIdentities => Set<SocialIdentity>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<OtpChallenge> OtpChallenges => Set<OtpChallenge>();

    public DbSet<School> Schools => Set<School>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Staff> StaffMembers => Set<Staff>();
    public DbSet<VehicleAssignment> VehicleAssignments => Set<VehicleAssignment>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<GuardianLink> GuardianLinks => Set<GuardianLink>();
    public DbSet<RouteTemplate> RouteTemplates => Set<RouteTemplate>();
    public DbSet<RouteTemplateStudent> RouteTemplateStudents => Set<RouteTemplateStudent>();

    public DbSet<AbsenceDeclaration> AbsenceDeclarations => Set<AbsenceDeclaration>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<TripStop> TripStops => Set<TripStop>();
    public DbSet<TripStopStudent> TripStopStudents => Set<TripStopStudent>();
    public DbSet<SweepCheck> SweepChecks => Set<SweepCheck>();
    public DbSet<LocationPing> LocationPings => Set<LocationPing>();

    public DbSet<FeePlan> FeePlans => Set<FeePlan>();
    public DbSet<StudentFee> StudentFees => Set<StudentFee>();
    public DbSet<Instalment> Instalments => Set<Instalment>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<NotificationMessage> NotificationMessages => Set<NotificationMessage>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        configurationBuilder.Properties<Money>()
            .HaveConversion<MoneyValueConverter>()
            .HaveColumnType("numeric(12,2)");

        configurationBuilder.Properties<GeoPoint>()
            .HaveConversion<GeoPointValueConverter>()
            .HaveColumnType("geography(Point, 4326)");

        configurationBuilder.Properties<GeoPoint?>()
            .HaveConversion<NullableGeoPointValueConverter>()
            .HaveColumnType("geography(Point, 4326)");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.HasPostgresExtension("citext");

        // Specific Entity table mappings
        modelBuilder.Entity<Tenant>().ToTable("tenants");
        modelBuilder.Entity<SubscriptionPlan>().ToTable("subscription_plans");
        modelBuilder.Entity<User>().ToTable("users");
        modelBuilder.Entity<UserTenantRole>().ToTable("user_tenant_roles");
        modelBuilder.Entity<SocialIdentity>().ToTable("social_identities");
        modelBuilder.Entity<RefreshToken>().ToTable("refresh_tokens");
        modelBuilder.Entity<OtpChallenge>().ToTable("otp_challenges");

        modelBuilder.Entity<School>().ToTable("schools");
        modelBuilder.Entity<Vehicle>().ToTable("vehicles");
        modelBuilder.Entity<Staff>().ToTable("staff");
        modelBuilder.Entity<VehicleAssignment>().ToTable("vehicle_assignments");
        modelBuilder.Entity<Student>().ToTable("students");
        modelBuilder.Entity<Address>().ToTable("addresses");
        modelBuilder.Entity<GuardianLink>().ToTable("guardian_links");
        modelBuilder.Entity<RouteTemplate>().ToTable("route_templates");
        modelBuilder.Entity<RouteTemplateStudent>().ToTable("route_template_students");

        modelBuilder.Entity<AbsenceDeclaration>().ToTable("absence_declarations");
        modelBuilder.Entity<Trip>().ToTable("trips");
        modelBuilder.Entity<TripStop>().ToTable("trip_stops");
        modelBuilder.Entity<TripStopStudent>().ToTable("trip_stop_students");
        modelBuilder.Entity<SweepCheck>().ToTable("sweep_checks");
        modelBuilder.Entity<LocationPing>().ToTable("location_pings");

        modelBuilder.Entity<FeePlan>().ToTable("fee_plans");
        modelBuilder.Entity<StudentFee>().ToTable("student_fees");
        modelBuilder.Entity<Instalment>().ToTable("instalments");
        modelBuilder.Entity<Payment>().ToTable("payments");
        modelBuilder.Entity<Expense>().ToTable("expenses");
        modelBuilder.Entity<Lead>().ToTable("leads");
        modelBuilder.Entity<AuditLog>().ToTable("audit_logs");
        modelBuilder.Entity<DeviceToken>().ToTable("device_tokens");
        modelBuilder.Entity<NotificationMessage>().ToTable("notification_messages");
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<BaseEntity>();
        var currentUserId = _currentUser.UserId;
        var currentTenantId = _tenantProvider.TenantId;

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
                entry.Entity.UpdatedAt = DateTime.UtcNow;
                entry.Entity.CreatedBy = currentUserId;

                if (entry.Entity is TenantEntity tenantEntity && currentTenantId.HasValue && tenantEntity.TenantId == Guid.Empty)
                {
                    tenantEntity.TenantId = currentTenantId.Value;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
                entry.Entity.UpdatedBy = currentUserId;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}

public class MoneyValueConverter : ValueConverter<Money, decimal>
{
    public MoneyValueConverter() : base(
        m => m.Amount,
        d => new Money(d, "TRY"))
    {
    }
}

public class GeoPointValueConverter : ValueConverter<GeoPoint, Point>
{
    public GeoPointValueConverter() : base(
        g => new Point(g.Longitude, g.Latitude) { SRID = 4326 },
        p => new GeoPoint(p.Y, p.X))
    {
    }
}

public class NullableGeoPointValueConverter : ValueConverter<GeoPoint?, Point?>
{
    public NullableGeoPointValueConverter() : base(
        g => g.HasValue ? new Point(g.Value.Longitude, g.Value.Latitude) { SRID = 4326 } : null,
        p => p != null ? new GeoPoint(p.Y, p.X) : (GeoPoint?)null)
    {
    }
}
