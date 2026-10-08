using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Oservis.Application.Common.Interfaces;
using Oservis.Application.Common.Models;
using Oservis.Domain.Common.Exceptions;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Entities;
using Oservis.Domain.Enums;

namespace Oservis.Application.Features.Trips;

// 1. Start Trip Command
public record StartTripCommand(
    Guid TripId,
    double? CurrentLatitude,
    double? CurrentLongitude,
    string? StartOverrideReason
) : IRequest<ApiResponse<bool>>;

public class StartTripCommandHandler : IRequestHandler<StartTripCommand, ApiResponse<bool>>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUser _currentUser;

    public StartTripCommandHandler(IAppDbContext context, ICurrentUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<bool>> Handle(StartTripCommand request, CancellationToken cancellationToken)
    {
        var trip = await _context.Trips.FirstOrDefaultAsync(t => t.Id == request.TripId, cancellationToken);
        if (trip == null)
            throw new DomainException("TRIP_NOT_FOUND", "Sefer bulunamadı.");

        var currentGeo = request.CurrentLatitude.HasValue && request.CurrentLongitude.HasValue
            ? new GeoPoint(request.CurrentLatitude.Value, request.CurrentLongitude.Value)
            : (GeoPoint?)null;

        var driverId = _currentUser.UserId ?? Guid.Empty;
        trip.Start(driverId, currentGeo, request.StartOverrideReason);

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<bool>.Ok(true, "Sefer başlatıldı.");
    }
}

// 2. Record Attendance Command (Yoklama)
public record RecordAttendanceCommand(
    Guid TripStopStudentId,
    AttendanceState Status,
    double? RecordedLatitude,
    double? RecordedLongitude
) : IRequest<ApiResponse<bool>>;

public class RecordAttendanceCommandHandler : IRequestHandler<RecordAttendanceCommand, ApiResponse<bool>>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUser _currentUser;

    public RecordAttendanceCommandHandler(IAppDbContext context, ICurrentUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<bool>> Handle(RecordAttendanceCommand request, CancellationToken cancellationToken)
    {
        var attendance = await _context.TripStopStudents
            .Include(a => a.TripStop)
            .FirstOrDefaultAsync(a => a.Id == request.TripStopStudentId, cancellationToken);

        if (attendance == null)
            throw new DomainException("ATTENDANCE_NOT_FOUND", "Yoklama kaydı bulunamadı.");

        attendance.Status = request.Status;
        attendance.RecordedBy = _currentUser.UserId;
        attendance.RecordedAt = DateTime.UtcNow;

        if (request.RecordedLatitude.HasValue && request.RecordedLongitude.HasValue)
        {
            attendance.RecordedGeo = new GeoPoint(request.RecordedLatitude.Value, request.RecordedLongitude.Value);
        }

        if (request.Status == AttendanceState.Boarded)
        {
            attendance.BoardedAt = DateTime.UtcNow;
        }
        else if (request.Status == AttendanceState.DroppedOff)
        {
            attendance.DroppedOffAt = DateTime.UtcNow;
        }
        else if (request.Status == AttendanceState.GuardianNoShow)
        {
            attendance.UndeliveredAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<bool>.Ok(true, "Yoklama durumu güncellendi.");
    }
}

// 3. Submit Sweep Check Command (Araç İçi Tarama / Çocuk Unutma Kontrolü)
public record SubmitSweepCheckCommand(
    Guid TripId,
    double? Latitude,
    double? Longitude,
    string? PhotoKey
) : IRequest<ApiResponse<bool>>;

public class SubmitSweepCheckCommandHandler : IRequestHandler<SubmitSweepCheckCommand, ApiResponse<bool>>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUser _currentUser;

    public SubmitSweepCheckCommandHandler(IAppDbContext context, ICurrentUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<bool>> Handle(SubmitSweepCheckCommand request, CancellationToken cancellationToken)
    {
        var trip = await _context.Trips
            .Include(t => t.SweepCheck)
            .FirstOrDefaultAsync(t => t.Id == request.TripId, cancellationToken);

        if (trip == null)
            throw new DomainException("TRIP_NOT_FOUND", "Sefer bulunamadı.");

        var geo = request.Latitude.HasValue && request.Longitude.HasValue
            ? new GeoPoint(request.Latitude.Value, request.Longitude.Value)
            : (GeoPoint?)null;

        var sweepCheck = new SweepCheck
        {
            TenantId = trip.TenantId,
            TripId = trip.Id,
            PerformedBy = _currentUser.UserId ?? Guid.Empty,
            PerformedAt = DateTime.UtcNow,
            Geo = geo,
            Confirmed = true,
            Result = "CLEAR",
            PhotoKey = request.PhotoKey
        };

        _context.SweepChecks.Add(sweepCheck);
        trip.MoveToSweepPending();

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<bool>.Ok(true, "Araç içi sweep (güvenlik taraması) başarıyla onaylandı.");
    }
}

// 4. Finish Trip Command
public record FinishTripCommand(Guid TripId) : IRequest<ApiResponse<bool>>;

public class FinishTripCommandHandler : IRequestHandler<FinishTripCommand, ApiResponse<bool>>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUser _currentUser;

    public FinishTripCommandHandler(IAppDbContext context, ICurrentUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<bool>> Handle(FinishTripCommand request, CancellationToken cancellationToken)
    {
        var trip = await _context.Trips
            .Include(t => t.SweepCheck)
            .FirstOrDefaultAsync(t => t.Id == request.TripId, cancellationToken);

        if (trip == null)
            throw new DomainException("TRIP_NOT_FOUND", "Sefer bulunamadı.");

        // Assert any student still onboard
        var unBoardedStudent = await _context.TripStopStudents
            .Where(tss => tss.TripStop.TripId == trip.Id && tss.Status == AttendanceState.Boarded)
            .AnyAsync(cancellationToken);

        if (unBoardedStudent)
            throw new DomainException("STUDENT_STILL_ONBOARD", "Araçta henüz inişi yapılmamış öğrenci bulunmaktadır. Sefer tamamlanamaz.");

        trip.Finish(_currentUser.UserId ?? Guid.Empty);
        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<bool>.Ok(true, "Sefer başarıyla tamamlandı.");
    }
}

// 5. Publish Location Ping Command (Live GPS)
public record PublishLocationPingCommand(
    Guid TripId,
    Guid VehicleId,
    double Latitude,
    double Longitude,
    decimal? SpeedKmh,
    decimal? Bearing,
    decimal? AccuracyM
) : IRequest<ApiResponse<bool>>;

public class PublishLocationPingCommandHandler : IRequestHandler<PublishLocationPingCommand, ApiResponse<bool>>
{
    private readonly IAppDbContext _context;
    private readonly ILiveTrackingNotifier _notifier;

    public PublishLocationPingCommandHandler(IAppDbContext context, ILiveTrackingNotifier notifier)
    {
        _context = context;
        _notifier = notifier;
    }

    public async Task<ApiResponse<bool>> Handle(PublishLocationPingCommand request, CancellationToken cancellationToken)
    {
        var ping = new LocationPing
        {
            TripId = request.TripId,
            VehicleId = request.VehicleId,
            Geo = new GeoPoint(request.Latitude, request.Longitude),
            SpeedKmh = request.SpeedKmh,
            Bearing = request.Bearing,
            AccuracyM = request.AccuracyM,
            RecordedAt = DateTime.UtcNow,
            ReceivedAt = DateTime.UtcNow
        };

        _context.LocationPings.Add(ping);
        await _context.SaveChangesAsync(cancellationToken);

        // Broadcast to SignalR via ILiveTrackingNotifier
        await _notifier.BroadcastLocationAsync(
            request.TripId,
            request.VehicleId,
            request.Latitude,
            request.Longitude,
            request.SpeedKmh,
            request.Bearing,
            ping.RecordedAt,
            cancellationToken
        );

        return ApiResponse<bool>.Ok(true);
    }
}
