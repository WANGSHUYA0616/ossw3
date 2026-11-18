# CDP 자동화 검증 스크립트 (수정본)
$port = 9222
$profileDir = "C:\ossw3\test_profile"

# 기존 프로필 디렉토리 정리
if (Test-Path $profileDir) {
    Remove-Item -Path $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Edge 브라우저를 디버깅 포트와 함께 백그라운드로 실행
$edgeProcess = Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
    -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=$profileDir", "--window-size=1200,900", "file:///C:/ossw3/index.html" `
    -PassThru

Start-Sleep -Seconds 2

try {
    # 열려 있는 페이지 타겟 정보 가져오기
    $json = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json"
    $page = $json | Where-Object { $_.type -eq "page" -and $_.url -like "*index.html*" } | Select-Object -First 1

    if (-not $page) {
        $page = $json | Where-Object { $_.type -eq "page" } | Select-Object -First 1
    }

    $wsUrl = $page.webSocketDebuggerUrl
    Write-Output "WebSocket URL: $wsUrl"

    # .NET ClientWebSocket 연결
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [System.Threading.CancellationToken]::None
    $uri = New-Object System.Uri($wsUrl)
    $ws.ConnectAsync($uri, $ct).Wait()

    $script:cmdId = 1
    function Send-CDPCommand($method, $params = $null) {
        $id = $script:cmdId++
        $msgObj = [ordered]@{
            id = $id
            method = $method
        }
        if ($params -ne $null -and $params.Count -gt 0) {
            $msgObj["params"] = $params
        }
        $msg = $msgObj | ConvertTo-Json -Depth 10 -Compress

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

        # 응답 수신
        $buffer = New-Object byte[] 2097152 # 2MB
        $recvSegment = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
        
        while ($true) {
            $ms = New-Object System.IO.MemoryStream
            do {
                $result = $ws.ReceiveAsync($recvSegment, $ct).Result
                $ms.Write($buffer, 0, $result.Count)
            } while (-not $result.EndOfMessage)

            $responseStr = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $resp = $responseStr | ConvertFrom-Json
            if ($resp.PSObject.Properties['id'] -and $resp.id -eq $id) {
                return $resp
            }
        }
    }

    function Eval-JS($script) {
        $res = Send-CDPCommand "Runtime.evaluate" @{
            expression = $script
            returnByValue = $true
            awaitPromise = $true
        }
        if ($res.result.exceptionDetails) {
            Write-Error ("JS Exception: " + ($res.result.exceptionDetails | ConvertTo-Json -Compress))
        }
        return $res.result.result.value
    }

    function Take-Screenshot($filePath) {
        $res = Send-CDPCommand "Page.captureScreenshot" @{
            format = "png"
        }
        $base64 = $res.result.data
        $bytes = [System.Convert]::FromBase64String($base64)
        [System.IO.File]::WriteAllBytes($filePath, $bytes)
        Write-Output "Screenshot saved: $filePath ($($bytes.Length) bytes)"
    }

    # 1. 메뉴 3개 추가 (김치찌개, 돈까스, 비빔밥)
    Write-Output "=== 1. Adding 3 menu items ==="
    $addResult = Eval-JS @"
    (function() {
        const input = document.getElementById('menuInput');
        const btn = document.getElementById('addBtn');
        const items = ['김치찌개', '돈까스', '비빔밥'];
        items.forEach(item => {
            input.value = item;
            btn.click();
        });
        const domItems = Array.from(document.querySelectorAll('#menuList .menu-name')).map(el => el.textContent);
        const stored = localStorage.getItem('lunch_roulette_menus');
        return JSON.stringify({ domItems: domItems, stored: stored });
    })()
"@
    Write-Output "Added result: $addResult"

    # 2. 돌리기 버튼 클릭
    Write-Output "=== 2. Clicking Spin Button (2s rotation) ==="
    Eval-JS "document.getElementById('spinBtn').click();"

    # 3. 2.5초 대기 (2초 회전 완료 후 결과 표시 대기)
    Start-Sleep -Milliseconds 2500

    # 4. 결과 확인
    $spinResult = Eval-JS @"
    (function() {
        const resultCard = document.getElementById('resultCard');
        const resultMenu = document.getElementById('resultMenu');
        const isHidden = resultCard.classList.contains('hidden');
        return JSON.stringify({ isHidden: isHidden, selectedMenu: resultMenu.textContent });
    })()
"@
    Write-Output "Spin Result after 2s: $spinResult"

    # 5. 스크린샷 1 캡처 (돌리기 완료 및 추천 메뉴 표시)
    Take-Screenshot "C:\ossw3\screenshot_spin_result.png"

    # 6. 새로고침 (Page.reload)
    Write-Output "=== 3. Reloading Page ==="
    Send-CDPCommand "Page.reload" @{}
    Start-Sleep -Seconds 2

    # 7. 새로고침 후 메뉴 목록 및 localStorage 확인
    $reloadResult = Eval-JS @"
    (function() {
        const domItems = Array.from(document.querySelectorAll('#menuList .menu-name')).map(el => el.textContent);
        const stored = localStorage.getItem('lunch_roulette_menus');
        const badge = document.getElementById('menuCountBadge').textContent;
        return JSON.stringify({ domItems: domItems, stored: stored, badge: badge });
    })()
"@
    Write-Output "After reload result: $reloadResult"

    # 8. 스크린샷 2 캡처 (새로고침 후 목록 유지 확인)
    Take-Screenshot "C:\ossw3\screenshot_after_reload.png"

    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait()
    Write-Output "=== Verification Completed Successfully! ==="
}
finally {
    if ($edgeProcess -and -not $edgeProcess.HasExited) {
        Stop-Process -Id $edgeProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
