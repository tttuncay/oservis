namespace Oservis.Domain.Common.Exceptions;

public class DomainException : Exception
{
    public string Code { get; }

    public DomainException(string code, string message) : base(message)
    {
        Code = code;
    }

    public DomainException(string code, string message, Exception innerException) : base(message, innerException)
    {
        Code = code;
    }
}
