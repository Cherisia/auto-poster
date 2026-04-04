@echo off
set CHROME1=C:\Program Files\Google\Chrome\Application\chrome.exe
set CHROME2=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe

if exist "%CHROME1%" goto run
if exist "%CHROME2%" set CHROME1=%CHROME2% && goto run

echo Chrome not found.
pause
exit /b 1

:run
start "" "%CHROME1%" --remote-debugging-port=9222 --user-data-dir="C:\chrome-blog-profile" "https://www.tistory.com/auth/login" "https://nid.naver.com/nidlogin.login"
echo Chrome started. Login to Tistory and Naver, then run post.bat or post-naver.bat
pause
