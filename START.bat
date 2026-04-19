@echo off
chcp 65001 >nul
cd /d %~dp0
set PORT=8000

echo  Voxel Arena - zapusk...
echo.

python --version >nul 2>nul
if %errorlevel% == 0 (
    echo  Python nayden - zapuskaem server...
    timeout /t 1 /nobreak >nul
    start "" "http://127.0.0.1:%PORT%/"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

py --version >nul 2>nul
if %errorlevel% == 0 (
    echo  Python (py) nayden - zapuskaem server...
    timeout /t 1 /nobreak >nul
    start "" "http://127.0.0.1:%PORT%/"
    py -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

node --version >nul 2>nul
if %errorlevel% == 0 (
    echo  Node.js nayden - zapuskaem server...
    timeout /t 1 /nobreak >nul
    start "" "http://127.0.0.1:%PORT%/"
    node -e "const h=require('http'),fs=require('fs'),p=require('path');const mime={'html':'text/html','js':'application/javascript','ogg':'audio/ogg','vox':'application/octet-stream','ico':'image/x-icon'};h.createServer((req,res)=>{let f=p.join(__dirname,req.url==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end('404');}const ext=p.extname(f).slice(1);res.setHeader('Content-Type',mime[ext]||'application/octet-stream');fs.createReadStream(f).pipe(res);}).listen(8000,'127.0.0.1',()=>console.log('Server: http://127.0.0.1:8000/'));"
    goto :end
)

echo.
echo  OSHIBKA: ne nayden Python ili Node.js
echo  Ustanovi: https://www.python.org/downloads/
echo.
pause
goto :eof

:end
echo.
echo  Server ostanovlen.
pause
