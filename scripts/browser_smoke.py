"""Exercise the real five-role browser journey against a running synthetic demo.

Creates a new synthetic request; never resets existing demo data.
Optional dependencies: pip install playwright; playwright install chromium.
"""
import argparse
from pathlib import Path
import os

from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5000')
    parser.add_argument('--screenshots', default='test-results')
    args = parser.parse_args()
    shots = Path(args.screenshots); shots.mkdir(parents=True, exist_ok=True)
    console_errors = []
    with sync_playwright() as pw:
        binary = os.getenv('MAAK_BROWSER') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        browser = pw.chromium.launch(executable_path=binary, headless=True, args=['--no-sandbox'])
        contexts = []

        def login(role, label):
            context = browser.new_context(viewport={'width': 1440, 'height': 1050})
            contexts.append(context)
            page = context.new_page()
            page.on('pageerror', lambda e: console_errors.append(str(e)))
            page.goto(args.url, wait_until='networkidle')
            page.get_by_role('button', name=f'Use demo account: {label}', exact=True).click()
            page.get_by_role('button', name='Sign in', exact=True).click()
            expect(page.get_by_role('button', name='Sign out', exact=True)).to_be_visible()
            return page

        def refresh(page):
            page.get_by_role('button', name='Refresh', exact=True).click()

        def request_card(page, reference):
            return page.locator('article.request-card').filter(has_text=reference)

        resident = login('resident', 'Patient or caregiver')
        resident.get_by_role('button', name='Request help', exact=True).click()
        dialog = resident.get_by_role('dialog')
        dialog.get_by_label('Quantity (kits)', exact=True).fill('10')
        dialog.get_by_label('Tell the coordinator anything else (optional)', exact=True).fill('Browser smoke test — synthetic supplies only.')
        dialog.get_by_role('button', name='Save request', exact=True).click()
        expect(dialog).not_to_be_visible()
        resident.wait_for_timeout(350)
        result = resident.request.get(args.url+'/api/needs').json()['needs']
        need = next(n for n in result if n['private_note'] == 'Browser smoke test — synthetic supplies only.' and not n['reviewed'])
        need_id, reference = need['id'], need['reference']
        expect(request_card(resident, reference)).to_be_visible()

        coordinator = login('coordinator', 'Shelter coordinator')
        request_card(coordinator, reference).get_by_role('button', name='View request', exact=True).click()
        dialog = coordinator.get_by_role('dialog')
        dialog.get_by_role('button', name='Review request', exact=True).click()
        dialog.get_by_label('Update visible to the resident', exact=True).fill('Quantity checked. Practical supply support is being arranged.')
        dialog.get_by_role('button', name='Review request', exact=True).click()
        expect(dialog.get_by_role('button', name='Publish opportunity', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Publish opportunity', exact=True).click()
        dialog.get_by_label('Public-safe description for donors', exact=True).fill('Ten hygiene kits requested at the demo shelter. No patient identity is published.')
        dialog.get_by_role('button', name='Publish opportunity', exact=True).click()
        expect(dialog.get_by_text('Open for assistance', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Close', exact=True).click()

        donor = login('donor', 'Donor')
        opportunity = donor.locator('article.opportunity-card').filter(has_text='Ten hygiene kits requested')
        opportunity.get_by_role('button', name='Pledge supplies', exact=True).click()
        dialog = donor.get_by_role('dialog')
        dialog.get_by_label('How many can you provide? (kits)', exact=True).fill('10')
        dialog.get_by_role('button', name='Pledge supplies', exact=True).click()
        expect(dialog).not_to_be_visible()

        coordinator.get_by_role('link', name='Deliveries', exact=True).click()
        refresh(coordinator)
        pledge_card = coordinator.locator('article.card').filter(has_text=reference)
        expect(pledge_card).to_be_visible()
        pledge_card.get_by_role('button', name='Create delivery task', exact=True).click()
        dialog = coordinator.get_by_role('dialog')
        dialog.get_by_label('Pickup and delivery instructions', exact=True).fill(f'Synthetic pickup point {reference}. Deliver to the demo shelter receiving coordinator.')
        dialog.get_by_role('button', name='Create delivery task', exact=True).click()
        expect(dialog).not_to_be_visible()

        volunteer = login('volunteer', 'Volunteer')
        task_id = next(t['id'] for t in volunteer.request.get(args.url+'/api/tasks').json()['tasks'] if t['status'] == 'available' and t['quantity'] == 10)
        # A clean run has one new available task; choose the newest matching card.
        volunteer.locator('article.task-card').filter(has_text='Hygiene kits · 10 kits').first.get_by_role('button', name='Accept task', exact=True).click()
        expect(volunteer.get_by_role('button', name='Confirm pickup', exact=True).first).to_be_visible()
        active = volunteer.locator('article.task-card').filter(has_text=f'Synthetic pickup point {reference}.')
        active.get_by_role('button', name='Confirm pickup', exact=True).click()
        expect(active.get_by_role('button', name='Report delivery', exact=True)).to_be_visible()
        active.get_by_role('button', name='Report delivery', exact=True).click()
        expect(active.get_by_text('Delivered — receipt pending', exact=True)).to_be_visible()

        refresh(coordinator)
        pledge_card.get_by_role('button', name='Confirm shelter receipt', exact=True).click()
        dialog = coordinator.get_by_role('dialog')
        dialog.get_by_role('button', name='Confirm shelter receipt', exact=True).click()
        expect(dialog).not_to_be_visible()
        pledge_card.get_by_role('button', name='View request', exact=True).click()
        dialog = coordinator.get_by_role('dialog')
        expect(dialog.get_by_text('Received at shelter — distribution pending', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Record issue to resident', exact=True).click()
        dialog.get_by_role('button', name='Record issue to resident', exact=True).click()
        expect(dialog.get_by_text('Issued — confirm receipt', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Close', exact=True).click()

        refresh(resident)
        request_card(resident, reference).get_by_role('button', name='View request', exact=True).click()
        dialog = resident.get_by_role('dialog')
        dialog.get_by_role('button', name='Confirm I received supplies', exact=True).click()
        dialog.get_by_role('button', name='Confirm I received supplies', exact=True).click()
        expect(dialog.get_by_text('Confirmed complete', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Close', exact=True).click()
        expect(request_card(resident, reference).get_by_text('Confirmed complete', exact=True)).to_be_visible()
        resident.evaluate('window.scrollTo(0,0)')
        resident.screenshot(path=str(shots/'resident-desktop.png'), full_page=True)

        ministry = login('ministry', 'Ministry oversight')
        expect(ministry.get_by_role('heading', name='Needs, pledges, and actual receipts', exact=True)).to_be_visible()
        overview = ministry.request.get(args.url+'/api/overview').json()
        assert overview['metrics']['fulfilled_needs'] >= 1
        assert 'Rana' not in str(overview) and 'private_note' not in str(overview)
        assert donor.request.get(args.url+f'/api/needs/{need_id}').status == 403
        ministry.evaluate('window.scrollTo(0,0)')
        ministry.screenshot(path=str(shots/'ministry-desktop.png'), full_page=True)

        # Changing language must preserve an open form and its unsent input.
        resident.get_by_role('button', name='Request help', exact=True).click()
        dialog = resident.get_by_role('dialog')
        dialog.get_by_label('Quantity (kits)', exact=True).fill('7')
        dialog.get_by_role('button', name='Switch to Arabic', exact=True).click()
        expect(dialog).to_be_visible()
        assert dialog.locator('input[type=number]').input_value() == '7'
        dialog.get_by_role('button', name='إغلاق', exact=True).click()
        expect(resident.locator('html')).to_have_attribute('dir', 'rtl')
        resident.evaluate('window.scrollTo(0,0)')
        resident.screenshot(path=str(shots/'resident-arabic-desktop.png'), full_page=True)
        resident.set_viewport_size({'width':390, 'height':844})
        resident.screenshot(path=str(shots/'resident-arabic-mobile.png'), full_page=True)
        assert resident.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        for page in [donor, coordinator, volunteer, ministry]:
            page.set_viewport_size({'width':390, 'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), page.url
        assert not console_errors, console_errors
        print('Browser smoke passed: real five-role need → pledge → delivery → shelter receipt → issue → resident confirmation; aggregate privacy; mobile fit; RTL; no page errors.')
        for context in contexts: context.close()
        browser.close()


if __name__ == '__main__':
    main()
