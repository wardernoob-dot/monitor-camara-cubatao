# monitor-camara-cubatao :: instalacao no PC (rodar uma vez)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo  = 'wardernoob-dot/monitor-camara-cubatao'

Write-Host ''
Write-Host 'Copie o token do GitHub (Ctrl+C no navegador) e depois aperte Enter aqui.'
Write-Host '(o instalador le direto da area de transferencia, nao precisa colar)'
[void](Read-Host -AsSecureString)  # mascara qualquer coisa digitada/colada aqui

$tok = (Get-Clipboard -Raw)
if ($tok) { $tok = ($tok -replace '[\x00-\x20]', '') }
if (-not $tok -or $tok -notmatch '^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$') {
    Write-Host 'A area de transferencia nao tem um token valido do GitHub (comeca com github_pat_ ou ghp_).' -ForegroundColor Red
    Write-Host 'Copie o token de novo e rode o instalador outra vez.'
    exit 1
}

# testa o token antes de guardar
$gh = @{ Authorization = "Bearer $tok"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'monitor-camara-pc' }
try {
    $r = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo" -Headers $gh
    Write-Host "Token OK: acesso ao repositorio $($r.full_name)." -ForegroundColor Green
} catch {
    Write-Host "O GitHub recusou o token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Confira se o token da acesso ao repositorio monitor-camara-cubatao (Contents e Actions: Read and write).'
    exit 1
}

ConvertTo-SecureString $tok -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Path (Join-Path $Pasta 'token.sec')
Set-Clipboard -Value ' '
$tok = $null
Write-Host 'Token guardado criptografado (so o seu usuario do Windows consegue ler). Area de transferencia limpa.'

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Pasta\pegar_specs.ps1`""
$gatilhos = @(
    (New-ScheduledTaskTrigger -Daily -At '12:40'),
    (New-ScheduledTaskTrigger -Daily -At '21:40')
)
$cfg = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'MonitorCamaraCubatao' -Action $acao -Trigger $gatilhos -Settings $cfg -Description 'Pega o storyboard das sessoes da Camara de Cubatao e manda pro GitHub' -Force | Out-Null
Write-Host 'Tarefa agendada: todo dia 12:40 e 21:40 (se o PC estiver desligado, roda quando ligar).'

Write-Host ''
Write-Host 'Rodando uma vez agora pra testar...'
& (Join-Path $Pasta 'pegar_specs.ps1')
