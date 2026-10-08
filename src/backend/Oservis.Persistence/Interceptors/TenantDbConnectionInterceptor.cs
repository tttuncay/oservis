using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Oservis.Application.Common.Interfaces;

namespace Oservis.Persistence.Interceptors;

public class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ITenantProvider _tenantProvider;

    public TenantDbConnectionInterceptor(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        SetTenantSession(connection);
        base.ConnectionOpened(connection, eventData);
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await SetTenantSessionAsync(connection, cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    private void SetTenantSession(DbConnection connection)
    {
        var tenantId = _tenantProvider.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty) return;

        using var cmd = connection.CreateCommand();
        cmd.CommandText = $"SET LOCAL app.tenant_id = '{tenantId.Value}';";
        cmd.ExecuteNonQuery();
    }

    private async Task SetTenantSessionAsync(DbConnection connection, CancellationToken cancellationToken)
    {
        var tenantId = _tenantProvider.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty) return;

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"SET LOCAL app.tenant_id = '{tenantId.Value}';";
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }
}
