# Script do PC

O YouTube bloqueia servidores em nuvem (GitHub Actions) na página do vídeo, mas libera as
miniaturas. Este script roda no PC (IP residencial), pega só o "spec" do storyboard de cada
sessão nova (1 requisição por sessão) e manda pro repositório. O GitHub faz o resto.

## Instalação (uma vez)

1. Crie um token em https://github.com/settings/personal-access-tokens/new
   - Repository access: **Only select repositories** → `monitor-camara-cubatao`
   - Permissions → Repository: **Contents: Read and write** e **Actions: Read and write**
   - Expiration: 1 ano
2. Abra o PowerShell nesta pasta e rode:
   `powershell -ExecutionPolicy Bypass -File .\instalar.ps1`
3. Copie o token (Ctrl+C) e aperte Enter quando pedir: o instalador lê da área de transferência, testa no GitHub e guarda criptografado pelo Windows (`token.sec`), legível só pelo seu usuário.

A tarefa "MonitorCamaraCubatao" roda todo dia às 12:40 e 21:40. Se o PC estiver desligado,
roda quando ligar. O que aconteceu fica em `log.txt`.

Pra remover: `Unregister-ScheduledTask -TaskName MonitorCamaraCubatao` e apagar a pasta.
