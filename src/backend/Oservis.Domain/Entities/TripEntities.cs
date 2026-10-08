using Oservis.Domain.Common;
using Oservis.Domain.Common.Exceptions;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Enums;

namespace Oservis.Domain.Entities;

public class AbsenceDeclaration : TenantEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public Guid DeclaredBy { get; set; }
    public Direction? Direction { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? Reason { get; set; }
}

public class Trip : TenantEntity
{
    public Guid? TemplateId { get; set; }
    public RouteTemplate? Template { get; set; }
    public Guid SchoolId { get; set; }
    public School School { get; set; } = null!;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public Guid DriverId { get; set; }
    public Staff Driver { get; set; } = null!;
    public Guid? HostId { get; set; }
    public Staff? Host { get; set; }
    public DateOnly ServiceDate { get; set; }
    public Direction Direction { get; set; }
    public TripState State { get; set; } = TripState.Planned;
    public TimeSpan? PlannedStartTime { get; set; }
    public TimeSpan? PlannedEndTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public Guid? StartedBy { get; set; }
    public GeoPoint? StartGeo { get; set; }
    public string? StartOverrideReason { get; set; }
    public DateTime? FinishedAt { get; set; }
    public Guid? FinishedBy { get; set; }
    public DateTime? CancelledAt { get; set; }
    public Guid? CancelledBy { get; set; }
    public string? CancelReason { get; set; }
    public DateTime? SweepPendingAt { get; set; }
    public int? ActualDistanceM { get; set; }

    public ICollection<TripStop> Stops { get; set; } = new List<TripStop>();
    public SweepCheck? SweepCheck { get; set; }
    public ICollection<LocationPing> LocationPings { get; set; } = new List<LocationPing>();

    // Domain Invariant: Trip State Machine Transitions
    public void Start(Guid driverUserId, GeoPoint? currentGeo, string? overrideReason = null)
    {
        if (State != TripState.Planned)
            throw new DomainException("INVALID_STATE", $"Trip cannot be started from state {State}.");

        State = TripState.Started;
        StartedAt = DateTime.UtcNow;
        StartedBy = driverUserId;
        StartGeo = currentGeo;
        StartOverrideReason = overrideReason;
    }

    public void MoveToSweepPending()
    {
        if (State != TripState.Started)
            throw new DomainException("INVALID_STATE", $"Trip must be in STARTED state to move to SWEEP_PENDING.");

        State = TripState.SweepPending;
        SweepPendingAt = DateTime.UtcNow;
    }

    public void Finish(Guid finisherUserId)
    {
        if (State != TripState.SweepPending)
            throw new DomainException("SWEEP_REQUIRED", "Cannot finish trip without reaching SWEEP_PENDING and completing sweep verification.");

        if (SweepCheck == null || !SweepCheck.Confirmed)
            throw new DomainException("SWEEP_NOT_CONFIRMED", "Cannot finish trip without an affirmative sweep check.");

        State = TripState.Finished;
        FinishedAt = DateTime.UtcNow;
        FinishedBy = finisherUserId;
    }
}

public class TripStop : TenantEntity
{
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public int Sequence { get; set; }
    public GeoPoint Geo { get; set; }
    public string? Label { get; set; }
    public string? AnchorKey { get; set; }
    public bool IsSchool { get; set; } = false;
    public bool IsAdhoc { get; set; } = false;
    public StopState State { get; set; } = StopState.Pending;
    public DateTime? Eta { get; set; }
    public int? LegDistanceM { get; set; }
    public int? LegDurationS { get; set; }
    public int DwellS { get; set; } = 0;
    public DateTime? ArrivedAt { get; set; }
    public Guid? ArrivedBy { get; set; }
    public string? ArrivalSource { get; set; }
    public DateTime? DepartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? CompletedBy { get; set; }
    public Guid? SkippedBy { get; set; }
    public string? SkipReason { get; set; }

    public ICollection<TripStopStudent> Students { get; set; } = new List<TripStopStudent>();
}

public class TripStopStudent : TenantEntity
{
    public Guid TripStopId { get; set; }
    public TripStop TripStop { get; set; } = null!;
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public Guid? AddressId { get; set; }
    public Address? Address { get; set; }
    public AttendanceState Status { get; set; } = AttendanceState.Pending;
    public Guid? RecordedBy { get; set; }
    public DateTime? RecordedAt { get; set; }
    public GeoPoint? RecordedGeo { get; set; }
    public bool RecordedOffline { get; set; } = false;
    public string? ClientEventId { get; set; }
    public DateTime? BoardedAt { get; set; }
    public DateTime? DroppedOffAt { get; set; }
    public DateTime? UndeliveredAt { get; set; }
    public DateTime? ReturnedToSchoolAt { get; set; }
}

public class SweepCheck : TenantEntity
{
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public Guid PerformedBy { get; set; }
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
    public GeoPoint? Geo { get; set; }
    public bool Confirmed { get; set; } = true; // Invariant: must be true
    public string Result { get; set; } = "CLEAR";
    public string? PhotoKey { get; set; }
    public bool RecordedOffline { get; set; } = false;
    public string? ClientEventId { get; set; }
}

public class LocationPing : TenantEntity
{
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public GeoPoint Geo { get; set; }
    public decimal? SpeedKmh { get; set; }
    public decimal? Bearing { get; set; }
    public decimal? AccuracyM { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
}
