param(
  [Parameter(Mandatory = $true)]
  [uri]$ApiUrl,
  [Parameter(Mandatory = $true)]
  [uri]$WebOrigin
)

$endpoint = ([uri]::new($ApiUrl, "/api/v1/auth/login")).AbsoluteUri
$headers = @{
  Origin = $WebOrigin.AbsoluteUri.TrimEnd("/")
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "content-type"
}

$response = Invoke-WebRequest -Uri $endpoint -Method Options -Headers $headers -UseBasicParsing
$expectedOrigin = $WebOrigin.AbsoluteUri.TrimEnd("/")

if ($response.StatusCode -ne 204) {
  throw "CORS preflight devolvió HTTP $($response.StatusCode); se esperaba 204."
}

$requiredHeaders = @{
  "access-control-allow-origin" = $expectedOrigin
  "access-control-allow-credentials" = "true"
}

foreach ($header in $requiredHeaders.GetEnumerator()) {
  $actual = $response.Headers[$header.Key]
  if ($actual -ne $header.Value) {
    throw "Header $($header.Key) inválido: '$actual'. Se esperaba '$($header.Value)'."
  }
}

if ($response.Headers["access-control-allow-methods"] -notmatch "(^|,)\s*POST\s*(,|$)") {
  throw "POST no está incluido en Access-Control-Allow-Methods."
}

Write-Output "CORS correcto: $endpoint acepta el origen $expectedOrigin"
