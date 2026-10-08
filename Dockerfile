# =====================================================================================
# Oservis API — Root Dockerfile for Google Cloud Run / Cloud Build (.NET 9)
# =====================================================================================

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj files for optimal layer caching
COPY ["src/backend/Oservis.Domain/Oservis.Domain.csproj", "Oservis.Domain/"]
COPY ["src/backend/Oservis.Application/Oservis.Application.csproj", "Oservis.Application/"]
COPY ["src/backend/Oservis.Persistence/Oservis.Persistence.csproj", "Oservis.Persistence/"]
COPY ["src/backend/Oservis.Infrastructure/Oservis.Infrastructure.csproj", "Oservis.Infrastructure/"]
COPY ["src/backend/Oservis.WebApi/Oservis.WebApi.csproj", "Oservis.WebApi/"]

RUN dotnet restore "Oservis.WebApi/Oservis.WebApi.csproj"

# Copy full backend source code
COPY src/backend/ .

WORKDIR "/src/Oservis.WebApi"
RUN dotnet publish "Oservis.WebApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=build /app/publish .

USER $APP_UID

ENTRYPOINT ["dotnet", "Oservis.WebApi.dll"]
