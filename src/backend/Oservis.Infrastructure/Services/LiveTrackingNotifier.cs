using Microsoft.AspNetCore.SignalR;
using Oservis.Application.Common.Interfaces;
using Oservis.Infrastructure.Hubs;

namespace Oservis.Infrastructure.Services;

public class LiveTrackingNotifier : ILiveTrackingNotifier
{
    private readonly IHubContext<LiveTrackingHub> _hubContext;

    public LiveTrackingNotifier(IHubContext<LiveTrackingHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastLocationAsync(
        Guid tripId,
        Guid vehicleId,
        double latitude,
        double longitude,
        decimal? speedKmh,
        decimal? bearing,
        DateTime timestamp,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            tripId,
            vehicleId,
            latitude,
            longitude,
            speedKmh,
            bearing,
            timestamp
        };

        await _hubContext.Clients.Group($"trip_{tripId}").SendAsync("OnLocationUpdate", payload, cancellationToken);
    }
}
