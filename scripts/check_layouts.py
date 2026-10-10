"""Read-only layout checks against a running synthetic Maak demo."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect


root = Path(__file__).resolve().parents[1]
shots = root / 'test-results'
shots.mkdir(exist_ok=True)
roles = {
    'Patient or caregiver': ['Home', 'Care needs', 'My requests'],
    'Shelter coordinator': ['Home', 'Needs queue', 'Deliveries', 'My shelter'],
    'Donor': ['Opportunities', 'My pledges'],
    'Volunteer': ['Available tasks', 'My deliveries'],
    'Ministry oversight': ['Overview', 'Shelters', 'Distribution'],
}
with sync_playwright() as pw:
    binary = os.getenv('MAAK_BROWSER') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser = pw.chromium.launch(executable_path=binary, headless=True, args=['--no-sandbox'])
    errors = []
    checks = 0
    for role, views in roles.items():
        context = browser.new_context(viewport={'width':1440,'height':1050})
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:5000', wait_until='networkidle')
        page.get_by_role('button',name=f'Use demo account: {role}',exact=True).click()
        page.get_by_role('button',name='Sign in',exact=True).click()
        expect(page.get_by_role('button',name='Sign out',exact=True)).to_be_visible()
        expect(page.locator('.loading')).not_to_be_visible()
        if role == 'Patient or caregiver':
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=str(shots/'resident-desktop.png'),full_page=True)
        for width in [390, 768, 1440]:
            page.set_viewport_size({'width':width,'height':900})
            for view in views:
                if width <= 650:
                    page.get_by_role('button',name='Care and community support',exact=True).click()
                page.get_by_role('link',name=view,exact=True).click()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (role,view,width)
                checks += 1
        page.get_by_role('button',name='Switch to Arabic',exact=True).click()
        expect(page.locator('html')).to_have_attribute('dir','rtl')
        page.evaluate('window.scrollTo(0,0)')
        if role == 'Patient or caregiver':
            page.screenshot(path=str(shots/'resident-arabic-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (role,'rtl-mobile')
        if role == 'Patient or caregiver':
            page.screenshot(path=str(shots/'resident-arabic-mobile.png'),full_page=True)
        context.close()
    assert not errors,errors
    browser.close()
    print(f'Layout checks passed: {checks} role/view/viewport combinations plus five RTL mobile views; no horizontal page overflow or page errors.')
