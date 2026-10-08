using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oservis.Application.Common.Models;
using Oservis.Application.Features.Finance;

namespace Oservis.WebApi.Controllers;

[Authorize]
public class FinanceController : BaseApiController
{
    [HttpPost("student-fees")]
    public async Task<ActionResult<ApiResponse<Guid>>> CreateStudentFee([FromBody] CreateStudentFeeCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }

    [HttpPost("payments")]
    public async Task<ActionResult<ApiResponse<Guid>>> RecordPayment([FromBody] RecordPaymentCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return Ok(result);
    }
}
