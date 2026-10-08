using Microsoft.AspNetCore.SignalR;

namespace Oservis.Infrastructure.Hubs;

public class LiveTrackingHub : Hub
{
    // Join a specific Trip room for live updates
    public async Task JoinTripTracking(string tripId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"trip_{tripId}");
    }

    public async Task LeaveTripTracking(string tripId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"trip_{tripId}");
    }

    // Join tenant fleet room (for company admins to view all vehicles live)
    public async Task JoinFleetTracking(string tenantId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"fleet_{tenantId}");
    }

    public async Task LeaveFleetTracking(string tenantId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"fleet_{tenantId}");
    }
}
