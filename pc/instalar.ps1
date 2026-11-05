# monitor-camara-cubatao :: instalacao no PC (rodar uma vez)
$ErrorActionPreference = 'Stop'
$Pasta = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ''
Write-Host 'Cole o token do GitHub e aperte Enter (ele nao aparece na tela):'
$t = Read-Host -AsSecureString
$t | ConvertFrom-SecureString | Set-Content -Path (Join-Path $Pasta 'token.sec')
Write-Host 'Token guardado criptografado (so o seu usuario do Windows consegue ler).'

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
