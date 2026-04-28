# DIBS Sally REST worker — pure PowerShell, runs on any Windows back to PS 2.0.
# No Node, no npm, no install. Reads creds from a sibling .env file.
#
# Setup once:
#   mkdir C:\dibs-rest-worker
#   copy "\\GLOVE\c$\tmp\dibs-init\dibs\.env" "C:\dibs-rest-worker\.env"
#   (download this script via iwr to the same folder)
#
# Run:
#   powershell -File "C:\dibs-rest-worker\ll-rest-worker.ps1"
#
# Stop: Ctrl+C (or close the window). To run as a service later, use NSSM.
#
# See docs/sally-rest-worker.md for the architecture.

$ErrorActionPreference = "Stop"

# --- Locate .env beside this script ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $scriptDir ".env"
if (-not (Test-Path $envPath)) { throw "Missing .env at $envPath" }

# --- Parse .env (KEY=value, ignores blank/comment lines) ---
$cfg = @{}
foreach ($line in Get-Content $envPath) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$') {
        $val = $matches[2]
        if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
        elseif ($val.StartsWith("'") -and $val.EndsWith("'")) { $val = $val.Substring(1, $val.Length - 2) }
        $cfg[$matches[1]] = $val
    }
}

$SUPABASE_URL = $cfg["NEXT_PUBLIC_SUPABASE_URL"]
$SERVICE_KEY  = $cfg["SUPABASE_SERVICE_ROLE_KEY"]
$SALLY_LOGIN  = $cfg["LL_SALLY_LOGIN"]
$API_KEY      = $cfg["LL_API_KEY"]
$API_SECRET   = $cfg["LL_API_SECRET"]
$E_CODE       = if ($cfg["LL_E_CODE"]) { $cfg["LL_E_CODE"] } else { "0AG09" }

if (-not $SUPABASE_URL -or -not $SERVICE_KEY -or -not $SALLY_LOGIN -or -not $API_KEY -or -not $API_SECRET) {
    throw "Missing required env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LL_SALLY_LOGIN, LL_API_KEY, LL_API_SECRET)"
}

# --- TLS 1.2 (Supabase HTTPS requires it; older Windows defaults to TLS 1.0) ---
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- JSON helpers (PS 2.0 has no ConvertFrom-Json/ConvertTo-Json) ---
Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = 100MB

function ConvertFrom-JsonCompat($s) { return $json.DeserializeObject($s) }
function ConvertTo-JsonCompat($o)  { return $json.Serialize($o) }

# --- HTTP helpers ---
function Invoke-SbRequest($method, $path, $body) {
    $url = "$SUPABASE_URL/rest/v1/$path"
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = $method
    $req.Headers.Add("apikey", $SERVICE_KEY)
    $req.Headers.Add("Authorization", "Bearer $SERVICE_KEY")
    $req.Accept = "application/json"
    if ($method -ne "GET" -and $body -ne $null) {
        $req.Headers.Add("Prefer", "return=representation")
        $req.ContentType = "application/json"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-JsonCompat $body))
        $req.ContentLength = $bytes.Length
        $stream = $req.GetRequestStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
    }
    $resp = $req.GetResponse()
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $sr.ReadToEnd()
    $sr.Close()
    $resp.Close()
    if ([string]::IsNullOrEmpty($text)) { return @() }
    return ConvertFrom-JsonCompat $text
}

# --- XML helpers ---
function EscapeXml($s) {
    if ($s -eq $null) { return "" }
    return $s.Replace("&","&amp;").Replace("<","&lt;").Replace(">","&gt;").Replace('"',"&quot;")
}

function Build-RequestXml($lisFunction, $eCode, $reqData) {
    return ("<Request><lis_function>" + (EscapeXml $lisFunction) + "</lis_function><e_code>" + (EscapeXml $eCode) + "</e_code><req_data>" + $reqData + "</req_data></Request>")
}

function Get-XmlTag($xml, $tag) {
    if ($xml -match "<$tag>([\s\S]*?)</$tag>") { return $matches[1] }
    return $null
}

function Get-CompletionCode($xml) {
    foreach ($t in @("completion_code","rspcod","response_code")) {
        $v = Get-XmlTag $xml $t
        if ($v) {
            $n = 0
            if ([int]::TryParse($v.Trim(), [ref]$n)) { return $n }
        }
    }
    return $null
}

# --- Curl wrapper ---
$CURL = "G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe"
$JAR  = Join-Path $env:TEMP "ll-jar.txt"
if (-not (Test-Path $CURL)) { throw "curl.exe not found at $CURL" }

Add-Type -AssemblyName System.Web

function Invoke-Sally($lisFunction, $reqDataXml, $waitSeconds) {
    # LL uses /api/rfq/<function> for the LIS legacy surface (what their own
    # client calls). /api/llsm/create is a separate surface (LLSM, C# service)
    # that returns "Unauthorized" for our creds — confirmed 2026-04-28.
    # The body is whatever URL-encoded form data the function expects;
    # caller is responsible for shape. For functions with no params, send
    # an empty body. For richer payloads (put_client_quote etc.), send the
    # function-specific form fields.
    $body = if ($reqDataXml) { $reqDataXml } else { "" }
    $rand = Get-Random
    $outFile    = Join-Path $env:TEMP ("sally-" + $rand + ".xml")
    $stdoutFile = Join-Path $env:TEMP ("curl-stdout-" + $rand + ".txt")
    $stderrFile = Join-Path $env:TEMP ("curl-stderr-" + $rand + ".txt")
    $url = "http://api.lamlinks.com/api/rfq/" + $lisFunction
    $creds = $SALLY_LOGIN + "#" + $API_KEY + ":" + $API_SECRET
    $argList = @("--digest", "--data", $body, "-u", $creds, "-c", $JAR, $url, "-o", $outFile, "-s", "-w", "HTTP_STATUS:%{http_code}\n")
    $proc = Start-Process -FilePath $CURL -ArgumentList $argList -NoNewWindow -Wait -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru
    $exitCode = $proc.ExitCode
    $stdout = if (Test-Path $stdoutFile) { [System.IO.File]::ReadAllText($stdoutFile) } else { "" }
    $stderr = if (Test-Path $stderrFile) { [System.IO.File]::ReadAllText($stderrFile) } else { "" }
    $responseXml = if (Test-Path $outFile) { [System.IO.File]::ReadAllText($outFile) } else { "" }
    $httpStatus = $null
    if ($stdout -match "HTTP_STATUS:(\d+)") { $httpStatus = [int]$matches[1] }
    $compCode = Get-CompletionCode $responseXml
    Remove-Item $outFile, $stdoutFile, $stderrFile -ErrorAction SilentlyContinue
    return @{
        ExitCode       = $exitCode
        HttpStatus     = $httpStatus
        CompletionCode = $compCode
        ResponseXml    = $responseXml
        Stderr         = $stderr
    }
}

# --- Main loop ---
$Host_ = $env:COMPUTERNAME
$lastHeartbeat = [DateTime]::MinValue
$HEARTBEAT_INTERVAL_SEC = 300
$POLL_INTERVAL_SEC = 30

Write-Host ""
Write-Host "ll-rest-worker (PowerShell) starting on $Host_, polling every $POLL_INTERVAL_SEC seconds"
Write-Host "  curl:    $CURL"
Write-Host "  sally:   http://api.lamlinks.com/api/llsm/create"
Write-Host "  config:  $envPath"
Write-Host ""

while ($true) {
    try {
        # Self-heartbeat disabled — are_you_listening returned "Unauthorized" via
        # /api/llsm/create. Once we know which function is authorized for ERG, we'll
        # re-enable using that function. Until then the worker just polls.
        $pending = @(Invoke-SbRequest "GET" "lamlinks_rest_queue?state=eq.pending&order=enqueued_at.asc&limit=1" $null)

        if ($pending.Count -eq 0) {
            Start-Sleep -Seconds $POLL_INTERVAL_SEC
            continue
        }

        $row = $pending[0]
        if ($row -eq $null) {
            Start-Sleep -Seconds $POLL_INTERVAL_SEC
            continue
        }
        $rowId       = $row["id"]
        $lisFunction = $row["lis_function"]
        $reqData     = if ($row["req_data_xml"]) { $row["req_data_xml"] } else { "" }
        $waitSec     = if ($row["wait_seconds"]) { $row["wait_seconds"] } else { 30 }

        try {
            $claim = @{ state = "running"; started_at = (Get-Date).ToString("o"); worker_host = $Host_ }
            Invoke-SbRequest "PATCH" ("lamlinks_rest_queue?id=eq." + $rowId + "&state=eq.pending") $claim | Out-Null
        } catch {
            continue
        }

        Write-Host (("[" + (Get-Date -Format "HH:mm:ss") + "] [" + $rowId + "] processing " + $lisFunction + "..."))
        $result = Invoke-Sally $lisFunction $reqData $waitSec

        $update = @{
            state           = if ($result["ExitCode"] -eq 0) { "done" } else { "error" }
            completed_at    = (Get-Date).ToString("o")
            http_status     = $result["HttpStatus"]
            completion_code = $result["CompletionCode"]
            response_xml    = $result["ResponseXml"]
        }
        if ($result["ExitCode"] -ne 0) {
            $errMsg = "curl exit " + $result["ExitCode"] + ": " + $result["Stderr"]
            if ($errMsg.Length -gt 500) { $errMsg = $errMsg.Substring(0, 500) }
            $update["error_message"] = $errMsg
        } else {
            $update["error_message"] = $null
        }
        Invoke-SbRequest "PATCH" ("lamlinks_rest_queue?id=eq." + $rowId) $update | Out-Null

        Write-Host (("[" + (Get-Date -Format "HH:mm:ss") + "] [" + $rowId + "] -> state=" + $update["state"] + " http=" + $update["http_status"] + " compCode=" + $update["completion_code"]))
    } catch {
        Write-Host (("[" + (Get-Date -Format "HH:mm:ss") + "] loop error: " + $_.Exception.Message)) -ForegroundColor Red
        Start-Sleep -Seconds $POLL_INTERVAL_SEC
    }
}
