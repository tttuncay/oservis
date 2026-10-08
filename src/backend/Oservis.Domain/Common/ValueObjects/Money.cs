namespace Oservis.Domain.Common.ValueObjects;

public readonly record struct Money
{
    public decimal Amount { get; init; }
    public string Currency { get; init; }

    public Money(decimal amount, string currency = "TRY")
    {
        Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        Currency = string.IsNullOrWhiteSpace(currency) ? "TRY" : currency.ToUpperInvariant();
    }

    public static Money Zero(string currency = "TRY") => new(0m, currency);

    public static Money operator +(Money a, Money b)
    {
        AssertSameCurrency(a, b);
        return new Money(a.Amount + b.Amount, a.Currency);
    }

    public static Money operator -(Money a, Money b)
    {
        AssertSameCurrency(a, b);
        return new Money(a.Amount - b.Amount, a.Currency);
    }

    private static void AssertSameCurrency(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidOperationException($"Cannot operate on different currencies: {a.Currency} vs {b.Currency}");
    }

    public override string ToString() => $"{Amount:N2} {Currency}";
}
