# monitor-camara-cubatao :: roda no PC (IP residencial)
# Pega o "spec" do storyboard das sessoes novas no canal da TV Camara,
# manda pro repositorio e dispara o processamento no GitHub Actions.
# Nao baixa video. Faz 1 requisicao por sessao nova.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo  = 'wardernoob-dot/monitor-camara-cubatao'
$Canal = 'UCSZ2lKO87tFkPxvHuvk5C7A'
$Pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$Log   = Join-Path $Pasta 'log.txt'

function Log($m) { $l = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"; Write-Host $l; Add-Content -Path $Log -Value $l -Encoding UTF8 }

function Texto($url, $headers) {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers
    return [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
}

try {
    # token do GitHub (criptografado pelo Windows para este usuario; criado pelo instalar.ps1)
    $sec = Get-Content (Join-Path $Pasta 'token.sec') | ConvertTo-SecureString
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    $gh = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'monitor-camara-pc' }
    $yt = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'; 'Accept-Language' = 'pt-BR,pt;q=0.9' }

    # 1) sessoes no feed do canal
    [xml]$rss = Texto "https://www.youtube.com/feeds/videos.xml?channel_id=$Canal" $yt
    $sessoes = @($rss.feed.entry | Where-Object { $_.title -match '\d+\S{0,2}\s*SESS\S{1,2}O\s+(ORDIN|EXTRAORDIN)' -and $_.title -match 'DIA\s+\d' } |
        ForEach-Object { [pscustomobject]@{ id = $_.videoId; titulo = $_.title } })
    Log "feed: $($sessoes.Count) sessao(oes) entre os ultimos videos"

    # 2) o que ja foi lido no GitHub
    $prontos = @{}
    try {
        (Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/contents/data/painel" -Headers $gh) |
            Where-Object { $_.name -like '*.json' } | ForEach-Object { $prontos[$_.name -replace '\.json$', ''] = $true }
    } catch { }

    $api = "https://api.github.com/repos/$Repo/contents/data/storyboard_specs.json"
    $atual = Invoke-RestMethod -Uri $api -Headers $gh
    $specs = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($atual.content -replace '\s', ''))) | ConvertFrom-Json

    # 3) spec das sessoes ainda nao lidas (renova sempre: a assinatura pode expirar)
    $novos = 0
    foreach ($s in $sessoes) {
        if ($prontos.ContainsKey($s.id)) { continue }
        $html = Texto "https://www.youtube.com/watch?v=$($s.id)" $yt
        $m = [regex]::Match($html, '"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"')
        if (-not $m.Success) { Log "  sem storyboard ainda (ao vivo ou processando): $($s.titulo)"; continue }
        $dur = [regex]::Match($html, '"lengthSeconds":"(\d+)"').Groups[1].Value
        $obj = [pscustomobject]@{ titulo = $s.titulo; dur = [int]$dur; spec = [regex]::Unescape($m.Groups[1].Value); obtido_em = (Get-Date).ToUniversalTime().ToString('s') + 'Z' }
        $specs | Add-Member -NotePropertyName $s.id -NotePropertyValue $obj -Force
        $novos++
        Log "  spec ok: $($s.titulo)"
        Start-Sleep -Seconds 2
    }

    if ($novos -eq 0) { Log 'nada novo'; exit 0 }

    # 4) atualiza o arquivo no repositorio e dispara o processamento
    $json = $specs | ConvertTo-Json -Depth 6
    $body = @{ message = "specs: $novos sessao(oes) (PC)"; content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)); sha = $atual.sha } | ConvertTo-Json
    Invoke-RestMethod -Method Put -Uri $api -Headers $gh -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' | Out-Null
    Start-Sleep -Seconds 3
    Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repo/actions/workflows/coleta.yml/dispatches" -Headers $gh -Body '{"ref":"main"}' -ContentType 'application/json' | Out-Null
    Log "enviado: $novos spec(s); processamento disparado no GitHub"
}
catch {
    Log "ERRO: $($_.Exception.Message)"
    exit 1
}
