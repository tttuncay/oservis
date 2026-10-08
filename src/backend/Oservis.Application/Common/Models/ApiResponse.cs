namespace Oservis.Application.Common.Models;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
    public string? RequestId { get; set; }

    public static ApiResponse<T> Ok(T data, string? message = null, string? requestId = null) =>
        new() { Success = true, Data = data, Message = message, RequestId = requestId };

    public static ApiResponse<T> Fail(string message, string? requestId = null) =>
        new() { Success = false, Message = message, RequestId = requestId };
}

public class ErrorResponse
{
    public string Code { get; set; } = "INTERNAL_ERROR";
    public string Message { get; set; } = "Beklenmeyen bir hata oluştu.";
    public object? Details { get; set; }
    public string? RequestId { get; set; }
}
