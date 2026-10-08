using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oservis.Application.Common.Models;
using Oservis.Application.Features.Trips;

namespace Oservis.WebApi.Controllers;

[Authorize]
public class TripsController : BaseApiController
{
    [HttpPost("start")]
    public async Task<ActionResult<ApiResponse<bool>>> StartTrip([FromBody] StartTripCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("attendance")]
    public async Task<ActionResult<ApiResponse<bool>>> RecordAttendance([FromBody] RecordAttendanceCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("sweep")]
    public async Task<ActionResult<ApiResponse<bool>>> SubmitSweepCheck([FromBody] SubmitSweepCheckCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("finish")]
    public async Task<ActionResult<ApiResponse<bool>>> FinishTrip([FromBody] FinishTripCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("location-ping")]
    public async Task<ActionResult<ApiResponse<bool>>> PublishLocationPing([FromBody] PublishLocationPingCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }
}
