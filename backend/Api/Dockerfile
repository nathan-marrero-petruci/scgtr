# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Caminho do Api.csproj
COPY backend/Api/Api.csproj .
RUN dotnet restore "Api.csproj"

COPY . .
RUN dotnet build "Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Api.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app

# Criar diretório de dados para o banco
RUN mkdir -p /data

COPY --from=publish /app/publish .

# Expor porta 8080 (Fly.io usa 8080 por padrão)
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080
ENV DB_PATH=/data/controle-ganhos.db

ENTRYPOINT ["dotnet", "Api.dll"]
