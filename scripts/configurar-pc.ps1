# ═══════════════════════════════════════════════════════════════════════════
#  Prepara o PC para hospedar a rede
#
#  Um computador de uso pessoal é configurado de fábrica para economizar
#  energia e se reiniciar quando quiser. Isso é ótimo para um PC comum e
#  péssimo para um que precisa atender o celular da sua namorada às duas da
#  manhã.
#
#  Este script ajusta o que atrapalha. Cada mudança está explicada, e nenhuma
#  delas é irreversível — o final do arquivo mostra como desfazer.
#
#  Rode uma vez, como administrador:   CONFIGURAR-PC.bat
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

function Passo($texto) { Write-Host "`n  $texto" -ForegroundColor Cyan }
function Feito($texto)  { Write-Host "    $texto" -ForegroundColor Green }
function Aviso($texto)  { Write-Host "    $texto" -ForegroundColor Yellow }

# ─── Precisa ser administrador ─────────────────────────────────────────────
$souAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $souAdmin) {
    Write-Host ""
    Write-Host "  Este script precisa de permissao de administrador." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Feche esta janela, clique com o botao direito em"
    Write-Host "  CONFIGURAR-PC.bat e escolha 'Executar como administrador'."
    Write-Host ""
    Read-Host "  Pressione Enter para fechar"
    exit 1
}

Write-Host ""
Write-Host "  Preparando este PC para hospedar a rede" -ForegroundColor White
Write-Host "  ─────────────────────────────────────────────────────────"

# ─── 1. Não dormir ─────────────────────────────────────────────────────────
# Um PC dormindo não responde a nada. A tela pode apagar à vontade — isso
# economiza energia sem derrubar a rede —, mas o computador em si fica acordado.
Passo "Impedindo que o computador durma"

powercfg /change standby-timeout-ac 0      # nunca suspender, na tomada
powercfg /change hibernate-timeout-ac 0    # nunca hibernar, na tomada
powercfg /change disk-timeout-ac 0         # não desligar o disco
powercfg /change monitor-timeout-ac 15     # a tela apaga em 15 min, e tudo bem

Feito "O PC nao vai mais dormir. A tela ainda apaga, para poupar energia."

# ─── 2. Windows Update na hora certa ───────────────────────────────────────
# O Windows reinicia sozinho para instalar atualizações. Se isso acontecer às
# três da manhã, a rede fica fora do ar sem ninguém perceber.
#
# "Horário ativo" é a janela em que o Windows promete NÃO reiniciar. Um PC que
# serve de servidor deve ter essa janela o mais larga possível: 18 horas é o
# máximo que o Windows aceita.
Passo "Ajustando o Windows Update para nao reiniciar de madrugada"

$chave = 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'
New-Item -Path $chave -Force | Out-Null
Set-ItemProperty -Path $chave -Name 'ActiveHoursStart' -Value 6  -Type DWord
Set-ItemProperty -Path $chave -Name 'ActiveHoursEnd'   -Value 24 -Type DWord
Set-ItemProperty -Path $chave -Name 'SmartActiveHoursState' -Value 0 -Type DWord

Feito "Reinicio automatico so entre meia-noite e 6h da manha."
Aviso "As atualizacoes continuam sendo instaladas - so o reinicio muda de hora."

# ─── 3. Docker Desktop junto com o Windows ─────────────────────────────────
# Depois de um reinício, a rede só volta sozinha se o Docker voltar antes.
Passo "Conferindo se o Docker Desktop inicia junto com o Windows"

$docker = Get-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' `
    -Name 'Docker Desktop' -ErrorAction SilentlyContinue

if ($docker) {
    Feito "Ja esta configurado."
} else {
    Aviso "Nao esta. Abra o Docker Desktop, va em Settings > General e"
    Aviso "marque 'Start Docker Desktop when you sign in'."
}

# ─── 4. Backup automático todo dia ─────────────────────────────────────────
# Com criptografia ponta-a-ponta, o backup é a única cópia que existe.
Passo "Agendando o backup diario"

$projeto = Split-Path -Parent $PSScriptRoot
$tarefa  = 'Backup da Nossa Rede'

$acao = New-ScheduledTaskAction -Execute 'cmd.exe' `
    -Argument "/c cd /d `"$projeto`" && pnpm backup >> backups\registro.txt 2>&1"

# 4h da manhã: fora do horário ativo, então o PC está acordado e ocioso.
$quando = New-ScheduledTaskTrigger -Daily -At 4am

# Roda mesmo com o notebook na bateria, e tenta de novo se o PC estava
# desligado na hora marcada.
$comoRoda = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $tarefa -Action $acao -Trigger $quando `
    -Settings $comoRoda -RunLevel Highest -Force | Out-Null

Feito "Todo dia as 4h da manha. Se o PC estiver desligado, roda ao ligar."

# ─── Fim ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────"
Write-Host "  Pronto." -ForegroundColor Green
Write-Host ""
Write-Host "  Uma coisa que este script nao resolve, e nenhum resolveria:"
Write-Host "  queda de luz e queda de internet derrubam a rede do mesmo"
Write-Host "  jeito. O notebook, na mesma casa, nao ajuda nisso - ele esta"
Write-Host "  na mesma tomada e no mesmo provedor. O que ele faz e guardar"
Write-Host "  o backup, para o dia em que este PC morrer de vez."
Write-Host ""
Write-Host "  Para desfazer o que foi feito aqui:" -ForegroundColor DarkGray
Write-Host "    powercfg /change standby-timeout-ac 30" -ForegroundColor DarkGray
Write-Host "    Unregister-ScheduledTask -TaskName '$tarefa'" -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Pressione Enter para fechar"
