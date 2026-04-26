const { exec, execSync } = require('child_process');
const { chromium } = require('playwright');

const port = 9222;

(async () => {
    try {
        console.log('Stopping existing Copilot...');
        try { execSync('powershell -Command "Stop-Process -Name mscopilot -Force -ErrorAction SilentlyContinue"'); } catch(e){}
        try { execSync('powershell -Command "Stop-Process -Name M365Copilot -Force -ErrorAction SilentlyContinue"'); } catch(e){}

        process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = `--remote-debugging-port=${port}`;
        
        console.log('Launching via protocol...');
        exec('powershell -Command "Start-Process \'ms-copilot://\'"');

        console.log('Waiting 10s...');
        await new Promise(r => setTimeout(r, 10000));

        console.log('Checking port 9222...');
        const http = require('http');
        http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('CDP Version Response:', data);
            });
        }).on('error', (err) => {
            console.log('Error checking port:', err.message);
        });

    } catch (e) {
        console.error(e);
    }
})();
