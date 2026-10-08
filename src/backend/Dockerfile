# =====================================================================================
# Oservis API — Multi-stage Production Dockerfile for Google Cloud Run (.NET 9)
# =====================================================================================

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files first for better layer caching
COPY ["Oservis.Domain/Oservis.Domain.csproj", "Oservis.Domain/"]
COPY ["Oservis.Application/Oservis.Application.csproj", "Oservis.Application/"]
COPY ["Oservis.Persistence/Oservis.Persistence.csproj", "Oservis.Persistence/"]
COPY ["Oservis.Infrastructure/Oservis.Infrastructure.csproj", "Oservis.Infrastructure/"]
COPY ["Oservis.WebApi/Oservis.WebApi.csproj", "Oservis.WebApi/"]

RUN dotnet restore "Oservis.WebApi/Oservis.WebApi.csproj"

# Copy full source code
COPY . .

WORKDIR "/src/Oservis.WebApi"
RUN dotnet publish "Oservis.WebApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Google Cloud Run standard environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=build /app/publish .

# Run as non-root user for maximum container security
USER $APP_UID

ENTRYPOINT ["dotnet", "Oservis.WebApi.dll"]
