# What the admin console walkthrough found in the backend (2026-11-04)

For the owner of AvatarBackend. These are backend behaviours seen while every admin page was walked against the local stack (AvatarBackend main b78ed8fd, docker compose with the apps profile). Nothing here blocks the admin console: the pages work around each item or the item cannot be reached from a page today. Each item says what was done, what came back, and what the admin side needs.

Evidence: 5 items, all observed with a real request and answer against the local stack; the source line is given where it was read. 0 inferred.

## 1. `POST /ads/media` returns a MIME type in `mediaType`
- Seen: upload a PNG to `POST /ads/media`; the answer has `mediaType: "image/png"`. The contract says `IMAGE` or `VIDEO`. Source: `admin/.../facade/AdAdminFacade.java:432` returns `stored.mediaType()`, which is the stored content type.
- The creative itself carries `type: "IMAGE"`, so only the upload answer is off.
- Effect on the page: after an upload the creative dialog prints the raw message id for the type line (console: `Missing message "ads.creatives.type.image/png"`).
- Needed: return `IMAGE` or `VIDEO` in the upload answer, as the contract says.

## 2. Inputs the backend accepts that look wrong (direct requests only; the pages stop all of these first)
- A credit product with store `STEAM`, a product id of 201 characters, or a product id with a space is accepted.
- A fraction is cut silently instead of refused: credits `1.5` is saved as 1, ad priority `1.5` is accepted, a credit request delta `1.5` becomes +1.
- An entitlement with priority `-1` is accepted.
- An e-mail template subject with a line break is accepted.
- A push task to an account id that does not exist is accepted.
- `milestone.days` accepts `[7, 30, 100000]` and an unsorted `[30, 7]`; `companionship.text_burst_minutes` accepts `100000`.
- Needed: refuse them with the field and reason like the neighbouring fields do, or say in the contract that they are allowed.

## 3. `integrity.check_enabled` can be switched off and the answer carries no warning
- Seen: `PUT /config/integrity.check_enabled` with `false` answers 200 with `warnings: []`.
- Needed: say whether switching it off should warn. If it should, put the warning in the answer and the console shows it.

## 4. Feature gate descriptions are English and carry internal section numbers
- Seen: `GET /feature-gates` `description` reads like "... (22.4 step 2)", "(15.6)", "(3.6)". The Chinese gates page prints it as the description column.
- Needed: description text that makes sense to an administrator, without spec section numbers; or a message key the console can translate.

## 5. Moderation record `category` for a rule hit is `RULE:<rule uuid>`
- Seen: a record hit by a word rule shows `category: "RULE:<rule uuid>"` in the queue and in the detail answer; the console prints it as it comes.
- Effect: the reviewer sees an internal id instead of what the rule matched.
- Needed: send the rule's pattern or note beside the id (a separate field), or a category the reviewer can read.
