namespace Oservis.Application.Common.Interfaces;

public interface ILiveTrackingNotifier
{
    Task BroadcastLocationAsync(
        Guid tripId,
        Guid vehicleId,
        double latitude,
        double longitude,
        decimal? speedKmh,
        decimal? bearing,
        DateTime timestamp,
        CancellationToken cancellationToken = default
    );
}
