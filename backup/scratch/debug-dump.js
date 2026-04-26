const { chromium } = require('playwright');

async function debug() {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const page = browser.contexts()[0].pages()[0];
        
        const dump = await page.evaluate(() => {
            function getInfo(el) {
                return {
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    placeholder: el.placeholder,
                    role: el.getAttribute('role'),
                    ariaLabel: el.getAttribute('aria-label'),
                    shadow: !!el.shadowRoot
                };
            }
            
            const results = [];
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'textbox') {
                    results.push(getInfo(el));
                }
                if (el.shadowRoot) {
                    const shadowAll = el.shadowRoot.querySelectorAll('*');
                    for (const sel of shadowAll) {
                        if (sel.tagName === 'TEXTAREA' || sel.tagName === 'BUTTON' || sel.getAttribute('role') === 'textbox') {
                            results.push({ ...getInfo(sel), inShadow: true });
                        }
                    }
                }
            }
            return results;
        });
        
        console.log(JSON.stringify(dump, null, 2));
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
