namespace Oservis.Domain.Enums;

public enum TenantStatus
{
    Trial = 1,
    Active = 2,
    Grace = 3,
    ReadOnly = 4,
    Suspended = 5
}

public enum UserStatus
{
    PendingApproval = 1,
    Active = 2,
    Suspended = 3,
    Rejected = 4
}

public enum RoleType
{
    Parent = 1,
    Driver = 2,
    Host = 3,
    Admin = 4,
    Sysadmin = 5
}

public enum OtpPurpose
{
    PhoneVerification = 1,
    PasswordReset = 2,
    HandshakePhone = 3
}

public enum AddressType
{
    Home = 1,
    Alternative = 2
}

public enum GeoStatus
{
    Pending = 1,
    Resolved = 2,
    Failed = 3,
    Manual = 4
}

public enum Direction
{
    Morning = 1,
    Afternoon = 2
}

public enum TripState
{
    Planned = 1,
    Started = 2,
    SweepPending = 3,
    Finished = 4,
    Cancelled = 5
}

public enum StopState
{
    Pending = 1,
    Arrived = 2,
    Completed = 3,
    Skipped = 4,
    Cancelled = 5
}

public enum AttendanceState
{
    Pending = 1,
    Boarded = 2,
    NoShow = 3,
    AbsentDeclared = 4,
    DroppedOff = 5,
    GuardianNoShow = 6,
    ReturnedToSchool = 7
}

public enum InstalmentStatus
{
    Pending = 1,
    Partial = 2,
    Paid = 3,
    Overdue = 4,
    Waived = 5,
    Cancelled = 6
}
