using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Oservis.Application.Common.Interfaces;
using Oservis.Infrastructure.Services;

namespace Oservis.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ITenantProvider, TenantProvider>();
        services.AddScoped<ICurrentUser, CurrentUser>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ILiveTrackingNotifier, LiveTrackingNotifier>();
        services.AddSignalR();

        return services;
    }
}
