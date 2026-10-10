# Maak identity, caregiving and professional access proposal

Status: design proposal for discussion. Welcome copy and the visible patient/caregiver account label are implemented; the authentication, dependent and professional workflows below are not yet implemented. The existing synthetic demo still uses email and password and its internal `resident` role. Changing its label grants no new permissions.

## Product direction

Maak connects people receiving care, people helping them, professionals and organizations. Shelter residence is a context, not a person's identity or a prerequisite for an account. A patient may receive assistance inside or outside a shelter. A caregiver can also be a patient, volunteer or professional.

Separate these concepts:

- Account: a person who signs in; verified contact channels and account security.
- Care profile: the person receiving care. It can represent the account holder or a dependent who has no login or phone.
- Care relationship: the account holder's permitted actions for that profile, its basis, duration and status.
- Professional credential: profession, issuing authority, registration/license information and verification status.
- Organization membership: approved role and assigned scope at a shelter, clinic or oversight institution.

Do not create independent accounts for every role or make a person share credentials with a caregiver. Give multi-role users a workspace switcher. Switching workspaces does not widen backend permissions.

## Entry page

Use clear choices rather than a long registration form:

1. Patient or caregiver — مريض أو مقدّم رعاية
2. Health professional — اختصاصي في الرعاية الصحية
3. Donor — متبرّع
4. Volunteer — متطوّع
5. Organization staff — فريق المؤسسة

Patients should not need to identify as sick to ask for practical assistance. The personal workspace can be called “My care and support” / “رعايتي والدعم”. Describe its entry as “For yourself or someone you care for.” Organization staff select their invited organization and approved workspace after authentication; coordinator and Ministry roles are not public self-selected privileges.

## Patient and caregiver sign-in

Returning user: phone number → code → workspace. First-time user: phone number → code → minimal profile → Myself / Someone I care for. Passwords are optional later account security settings, not the primary patient entry.

- Default country selector to Lebanon +961, allow other countries and normalize numbers consistently. Use a maintained phone-number library; do not hard-code one Lebanese mobile prefix. Display how the entered number will be contacted.
- Use a six-digit, single-use verification code with a short configurable expiry (initial proposal five minutes), limited guesses and resend limits. Permit pasting and automatic code fill; use accessible labels and a single code input where practical.
- Say “Send code” and “Verify and continue”; mask the destination, allow editing it, show expiry and a clear resend timer.
- Never disclose whether a number has an account before it is verified. Store an HMAC of the code with a server secret, not plaintext or a plain hash of a low-entropy six-digit value; keep codes out of logs.
- Limit attempts and sends by destination, session and network signals. Avoid turning retries into repeated SMS charges. Maintain a command/idempotency key for send requests.
- SMS is the proposed first channel. WhatsApp requires an actual provider, approved messaging setup and delivery/consent design; do not pretend it is available. Providers require account configuration, delivery checks and costs.
- A phone code proves access to the phone, not legal identity, guardianship or a professional license. Do not label phone-verified accounts identity-verified.
- Offer a visible “I cannot receive a code” help route. Assisted recovery needs staffed procedures and must not reveal a profile to someone who simply knows its phone number. Before staffing exists, label the limitation honestly.
- Support logout on shared devices. Avoid persisting patient records in browser storage. Protect phone changes with existing-channel verification or reviewed recovery, and revoke other sessions after approved recovery.
- A later public phone-number reassignment must not silently transfer an existing patient's history to a new owner. Account recovery and linking need a separate policy before sensitive records are introduced.

For the hackathon, use explicitly labeled sandbox verification with synthetic phone numbers and codes; production must refuse sandbox mode. Do not collect real phone numbers through a demo while showing a fixed publicly known code. Keep demo sign-in separate from actual phone verification.

## Dependents and delegated care

After sign-in, show “Who are you requesting support for?” with Myself and linked profiles. Keep the selected person's name visible throughout intake and confirmation to prevent accidental cross-profile actions. New request forms always specify the care profile; no silent fallback to a previous selection.

Add someone: name, relationship, age/date of birth as needed, optional contact, and basis for acting. Never require a child to have a phone or email. Collect precise identity documents only when the purpose and storage/access policy have been agreed. Do not auto-link records by matching name, relationship or phone number.

- Consenting adult: send an invitation or consent request with the exact permissions; activate access only after acceptance. Let the adult revoke it and view who has access. “My mother” does not automatically establish authority.
- Child: capture guardian declaration and proposed guardianship evidence/review appropriate to partner policy; use limited practical support while review is pending. Do not treat one age rule as universally sufficient legal authorization.
- Adult unable to consent: use a separate reviewed representative process. A checkbox cannot establish legal authority. Time-sensitive requests can be captured with restricted practical-support access while authority is pending; no automatic release of clinical history.
- Temporary assistance: an authorized staff member may help record a request with a defined, logged scope. This does not make them a guardian or owner of the profile.
- Existing profile: invite/request a relationship; never reveal whether sensitive records exist during a search. Duplicate resolution is a reviewed process.

Permissions should distinguish request assistance, view request status, confirm supplies received, view clinical data, manage appointments and manage other delegates. Grant only necessary permissions. A delivery confirmation is not clinical consent. Every action records both the acting account and the subject care profile; caregiver confirmations must say that they are made on the person's behalf.

The home screen has a profile switcher and a “People I care for” page with relationship status, allowed actions and remove/revoke controls. Revocation immediately blocks future access, including API reads; prior accountable action records remain according to the retention policy.

## Professional onboarding and Lebanese verification

Sign in → choose profession (doctor, nurse, psychologist; expandable later) → professional details → verification submission → pending dashboard.

Collect profession-specific information only after selection: professional name, registration/license number, issuing body, applicable validity details, declared specialty, organization affiliation when relevant and the minimum evidence agreed with the verifier. Phone verification, professional authorization and organization membership are three separate checks.

Proposed verification states: draft, submitted, under review, information requested, verified, rejected, suspended and expired. Show a clear next step and reason for information requests. Review timing depends on an actual staffed verification process; do not invent an SLA or approval guarantee.

Lebanese verification must be mapped with local partners before implementing claims:

- Doctors: confirm the relevant Order of Physicians registration and any additional applicable MoPH practice authorization for the service offered.
- Nurses: confirm the applicable nursing registration/professional-body and MoPH requirements with the designated local verifier.
- Psychologists: confirm the correct psychology licensing/registration authority and requirements for the declared service; do not conflate psychologist and psychiatrist. Psychiatry follows the physician pathway.

These are proposed evidence categories, not a confirmed exhaustive legal checklist. Obtain the exact authorities, credential formats, permitted services, expiry/revalidation rules and verification procedure from the Lebanese partners. Do not assume a public verification API exists or mark uploaded documents authentic automatically. Association logos/affiliation are not credential verification.

Authorized reviewers check authoritative sources or approved manual contacts and record reviewer, date, evidence source, result and scope. Uploaded documents stay private in protected storage with limited reviewer access, restricted file types/sizes and a retention policy. Do not place them in public static files, GitHub or the free demo filesystem. Define appeal, recheck, suspension and expiry handling before a real pilot.

Pending professionals may complete their profile and monitor verification. They cannot view patient records, claim a verified badge, offer clinical services or accept clinical assignments. Even a verified professional needs a specific care assignment/consent and permitted service scope before viewing a person's data. A verified doctor does not receive all records. Suspension or expiry blocks new clinical work and starts an operational continuity process.

For the hackathon, seeded synthetic credentials can demonstrate states, with a badge reading “Demo credential — not independently verified.” Never create an apparently verified real professional from an upload or self-declaration.

## Authentication by workspace

| Workspace | Entry | Additional trust gate | Scope |
|---|---|---|---|
| Patient/caregiver | Phone + code; optional email | Explicit delegated-care authority when acting for another person | Own profile or approved dependent permissions |
| Individual donor | Phone + code | Additional review for institutional/large commitments if required | Safe opportunities and own pledges |
| Volunteer | Phone + code | Operational approval, training/eligibility as required | Eligible available tasks; private delivery details only after assignment |
| Professional | Verified contact sign-in; stronger authentication for clinical access | Profession-specific credential review and relevant assignment/consent | Assigned people and permitted services only |
| Shelter/clinic coordinator | Approved invitation; organizational identity or verified email with MFA | Organization approval and shelter/clinic assignment | Assigned organizational scope |
| Ministry/oversight staff | Named organizational account with MFA/SSO where available | Organization administrator approval | Approved aggregate reports; no patient-level access by default |

A phone number alone must never assign staff privileges. Shared organization logins should be replaced with named accounts. Patient phone access can stay simple; sensitive staff access needs stronger authentication. No self-registration shortcut creates an approved coordinator or Ministry account.

## Architecture and acceptance gates

Proposed records: Account, ContactVerificationChallenge, CareProfile, CareRelationship, ProfessionalCredential, CredentialReview, Organization, Membership, Session and AuditEvent. Need and clinical records reference the subject profile; all actions reference the actor account. Existing resident request data requires a migration to self-owned care profiles, not just a UI label substitution.

Backend checks enforce verified contact, active relationship, permitted action, organization scope and active professional credential as applicable. A frontend-selected role/profile is never the authority. Session IDs and codes are not stored in localStorage. Use schema migrations and protect simultaneous link/revoke/credential updates.

Acceptance examples:

- One account manages their own request and an authorized child's request without mixing names, quantities or history.
- Knowing an adult's phone/name or declaring them a parent grants no access.
- Adult denial or relationship revocation prevents both list and direct-ID API access immediately.
- A wrong, expired or reused code cannot authenticate; resend and concurrent verification cannot bypass attempt limits.
- Pending/expired/suspended professionals cannot read clinical data, and unrelated verified professionals remain denied.
- Private credentials cannot be accessed by donors, volunteers or arbitrary staff.
- Arabic RTL forms retain input on language changes and show the selected care subject clearly.

## Implementation phases and dependencies

Estimates for an experienced small team with existing working code; real SMS setup, partner response and legal review add elapsed time. These are additional work beyond the original 18-hour prototype, not promises of full delivery within that budget.

1. Account and role UX, profile-selection flows and schema/migration design: 2–4 hours for a reviewable prototype design.
2. Synthetic phone-code flow, minimal self profile and explicitly demo-only dependent permissions: 4–6 hours. Real SMS and abuse/recovery controls require a separate integration and deployment task.
3. Dependent relationships with invitations, granular permissions, revocation and migration tests: 1–2 engineering days for an initial controlled implementation; authority policies must be agreed first.
4. Professional onboarding, credential states and scoped reviewer workflow: 1–2 engineering days for an initial manual-review prototype. Actual credential verification depends on named Lebanese verifiers and approved evidence criteria.
5. Live messaging integration, staff MFA, secure document storage, recovery, authorization testing and deployment persistence: estimate after providers, accounts, security scope and verification policies are selected.

Keep the existing demonstration operational during the redesign. Do not connect a real SMS provider, collect credential uploads or claim live verification without those dependencies. The current free Render SQLite storage resets; patient identities and documents need durable approved storage before any real pilot.
