using Microsoft.AspNetCore.Mvc;
using Oservis.Application.Common.Models;
using Oservis.Application.Common.Interfaces;
using Oservis.Application.Features.Auth;

namespace Oservis.WebApi.Controllers;

public class AuthController : BaseApiController
{
    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResultDto>>> Login([FromBody] LoginCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("register-tenant")]
    public async Task<ActionResult<ApiResponse<AuthResultDto>>> RegisterTenant([FromBody] RegisterTenantCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }
}
