param(
  [string]$DockerUser = "savaandrei2003",
  [string]$StackName  = "school",
  [string]$StackFile  = "docker-stack.yml",
  [string]$Tag        = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Tag)) {
  $Tag = (Get-Date).ToString("yyyyMMdd-HHmmss")
}

Write-Host "Using tag: $Tag"

$services = @(
  @{ Name = "db-migrator";         Path = "./db" },
  @{ Name = "user-service";        Path = "./user-service" },
  @{ Name = "menu-service";        Path = "./menu-service" },
  @{ Name = "orders-service";      Path = "./orders-service" },
  @{ Name = "reporting-service";   Path = "./reporting-service" },
  @{ Name = "notification-service";Path = "./notification-service" }
)

foreach ($s in $services) {
  $image = "$DockerUser/$($s.Name):$Tag"
  Write-Host "`n=== Building $image from $($s.Path) ==="
  docker build -t $image $s.Path
  Write-Host "=== Pushing $image ==="
  docker push $image
}

# Genereaza un override stack file cu imaginile noi
$override = @"
version: "3.8"
services:
  db-migrate:
    image: $DockerUser/db-migrator:$Tag
  user-service:
    image: $DockerUser/user-service:$Tag
  menu-service:
    image: $DockerUser/menu-service:$Tag
  orders-service:
    image: $DockerUser/orders-service:$Tag
  reporting-service:
    image: $DockerUser/reporting-service:$Tag
  notification-service:
    image: $DockerUser/notification-service:$Tag
"@

$overrideFile = "docker-stack.images.override.yml"
$override | Out-File -Encoding utf8 $overrideFile

Write-Host "`n=== Deploying stack $StackName with $StackFile + $overrideFile ==="
docker stack deploy -c $StackFile -c $overrideFile $StackName

Write-Host "`nDone. Check migrator logs:"
Write-Host "docker service logs ${StackName}_db-migrate --tail 200"
Write-Host "or: docker service logs ${StackName}_db-migrate -f"
