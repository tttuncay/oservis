using Oservis.Domain.Common;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Enums;

namespace Oservis.Domain.Entities;

public class School : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public GeoPoint? Geo { get; set; }
    public string? AddressText { get; set; }
    public TimeSpan? MorningStartTime { get; set; }
    public TimeSpan? AfternoonDismissalTime { get; set; }

    public ICollection<Student> Students { get; set; } = new List<Student>();
    public ICollection<RouteTemplate> RouteTemplates { get; set; } = new List<RouteTemplate>();
}

public class Vehicle : TenantEntity
{
    public string Plate { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string? MakeModel { get; set; }
    public DateOnly? InspectionDue { get; set; }
    public DateOnly? InsuranceDue { get; set; }
    public string Status { get; set; } = "ACTIVE";

    public ICollection<VehicleAssignment> Assignments { get; set; } = new List<VehicleAssignment>();
    public ICollection<RouteTemplate> RouteTemplates { get; set; } = new List<RouteTemplate>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}

public class Staff : TenantEntity
{
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public RoleType Kind { get; set; } // Driver or Host
    public string FullName { get; set; } = string.Empty;
    public string? PhoneE164 { get; set; }
    public string? LicenceNo { get; set; }
    public DateOnly? LicenceExpiry { get; set; }
    public DateOnly? RecordCertDate { get; set; }
    public string Status { get; set; } = "ACTIVE";
}

public class VehicleAssignment : TenantEntity
{
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public Guid DriverId { get; set; }
    public Staff Driver { get; set; } = null!;
    public Guid? HostId { get; set; }
    public Staff? Host { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly? ValidTo { get; set; }
}

public class Student : TenantEntity
{
    public string FullName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public Guid SchoolId { get; set; }
    public School School { get; set; } = null!;
    public string? ClassName { get; set; }
    public string? PhotoKey { get; set; }
    public string? MedicalNote { get; set; }
    public string? ExternalRef { get; set; }
    public string? ImportDedupeKey { get; set; }
    public Guid? ImportBatchId { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public Guid? LeadId { get; set; }

    public ICollection<Address> Addresses { get; set; } = new List<Address>();
    public ICollection<GuardianLink> GuardianLinks { get; set; } = new List<GuardianLink>();
    public ICollection<RouteTemplateStudent> RouteTemplateLinks { get; set; } = new List<RouteTemplateStudent>();
    public ICollection<StudentFee> Fees { get; set; } = new List<StudentFee>();
    public ICollection<AbsenceDeclaration> Absences { get; set; } = new List<AbsenceDeclaration>();
}

public class Address : TenantEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public AddressType Type { get; set; } = AddressType.Home;
    public string? Label { get; set; }
    public string AddressText { get; set; } = string.Empty;
    public GeoPoint? Geo { get; set; }
    public GeoStatus GeoStatus { get; set; } = GeoStatus.Pending;
}

public class GuardianLink : TenantEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Relationship { get; set; } = string.Empty;
    public bool IsPrimary { get; set; } = false;
    public bool IsEmergencyContact { get; set; } = true;
    public bool IsAuthorisedReceiver { get; set; } = true;
    public bool CanViewLocation { get; set; } = true;
    public bool ReceivesNotifications { get; set; } = true;
}

public class RouteTemplate : TenantEntity
{
    public Guid SchoolId { get; set; }
    public School School { get; set; } = null!;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public Guid? DriverId { get; set; }
    public Staff? Driver { get; set; }
    public Guid? HostId { get; set; }
    public Staff? Host { get; set; }
    public string Name { get; set; } = string.Empty;
    public Direction Direction { get; set; }
    public TimeSpan? PlannedStartTime { get; set; }
    public TimeSpan? PlannedEndTime { get; set; }
    public bool Active { get; set; } = true;
    public bool OrderLocked { get; set; } = false;
    public string? ManualStopOrderJson { get; set; }

    public ICollection<RouteTemplateStudent> Students { get; set; } = new List<RouteTemplateStudent>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}

public class RouteTemplateStudent : TenantEntity
{
    public Guid RouteTemplateId { get; set; }
    public RouteTemplate RouteTemplate { get; set; } = null!;
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public Guid AddressId { get; set; }
    public Address Address { get; set; } = null!;
    public int StopOrder { get; set; }
    public TimeSpan? EstimatedPickupTime { get; set; }
}
