using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oservis.Application.Common.Models;
using Oservis.Application.Features.Company;

namespace Oservis.WebApi.Controllers;

[Authorize]
public class CompanyController : BaseApiController
{
    [HttpPost("schools")]
    public async Task<ActionResult<ApiResponse<Guid>>> CreateSchool([FromBody] CreateSchoolCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("vehicles")]
    public async Task<ActionResult<ApiResponse<Guid>>> CreateVehicle([FromBody] CreateVehicleCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("students")]
    public async Task<ActionResult<ApiResponse<Guid>>> CreateStudent([FromBody] CreateStudentCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }
}
