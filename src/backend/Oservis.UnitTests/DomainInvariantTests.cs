using Oservis.Domain.Common.Exceptions;
using Oservis.Domain.Common.ValueObjects;
using Oservis.Domain.Entities;
using Oservis.Domain.Enums;
using Xunit;

namespace Oservis.UnitTests;

public class DomainInvariantTests
{
    [Fact]
    public void Money_Addition_Calculates_Correctly()
    {
        var m1 = new Money(1500.50m, "TRY");
        var m2 = new Money(499.50m, "TRY");

        var total = m1 + m2;

        Assert.Equal(2000.00m, total.Amount);
        Assert.Equal("TRY", total.Currency);
    }

    [Fact]
    public void Money_Different_Currencies_Throws_InvalidOperationException()
    {
        var tryMoney = new Money(100m, "TRY");
        var usdMoney = new Money(100m, "USD");

        Assert.Throws<InvalidOperationException>(() => _ = tryMoney + usdMoney);
    }

    [Fact]
    public void Trip_Start_Transitions_State_To_Started()
    {
        var trip = new Trip
        {
            State = TripState.Planned
        };

        var driverId = Guid.NewGuid();
        trip.Start(driverId, new GeoPoint(41.0082, 28.9784));

        Assert.Equal(TripState.Started, trip.State);
        Assert.Equal(driverId, trip.StartedBy);
        Assert.NotNull(trip.StartedAt);
    }

    [Fact]
    public void Trip_Cannot_Start_When_Not_In_Planned_State()
    {
        var trip = new Trip
        {
            State = TripState.Started
        };

        Assert.Throws<DomainException>(() => trip.Start(Guid.NewGuid(), null));
    }

    [Fact]
    public void Trip_Cannot_Finish_Without_SweepCheck()
    {
        var trip = new Trip
        {
            State = TripState.Started
        };

        trip.MoveToSweepPending();

        // Finishing without SweepCheck must throw SWEEP_NOT_CONFIRMED
        Assert.Throws<DomainException>(() => trip.Finish(Guid.NewGuid()));
    }

    [Fact]
    public void Trip_Finishes_Successfully_When_SweepCheck_Confirmed()
    {
        var trip = new Trip
        {
            State = TripState.Started
        };

        trip.MoveToSweepPending();

        trip.SweepCheck = new SweepCheck
        {
            Confirmed = true,
            Result = "CLEAR"
        };

        var finisherId = Guid.NewGuid();
        trip.Finish(finisherId);

        Assert.Equal(TripState.Finished, trip.State);
        Assert.Equal(finisherId, trip.FinishedBy);
        Assert.NotNull(trip.FinishedAt);
    }
}
