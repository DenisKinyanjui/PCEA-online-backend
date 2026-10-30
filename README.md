# PCEA Online Ministry backend

## Member accounts and districts

Members register through `POST /api/auth/register`, choosing one of the active
districts returned by `GET /api/districts` or choosing `districtId: "not-sure"`
and providing a location. Registration creates a `member` account; the public
request cannot assign a staff role. Member login uses the existing
`POST /api/auth/login` endpoint.

District members can access `GET /api/members/district` with their bearer token.
That endpoint derives the district from the authenticated account and returns
member names only. Unassigned members receive an empty list and an explanatory
message. Authorized church admins and super admins can manage member names,
emails, district assignments, and unassigned locations through the
`/api/members/admin` endpoints. Contact details are not part of the
member-facing directory.

Church admins and super admins can add and rename district records in the admin
panel. Districts with assigned members cannot be deleted; reassign or unassign
those members first. District options added there are immediately available in
public member signup.

District records can also include a district elder and up to 12 deacons.
Members see those names alongside the member list for their own district;
leadership contact details are not collected or exposed by this feature.

## Public site content

Church admins and super admins can manage the homepage hero photos and About
page copy from **Admin → Content**. Hero photos accept JPG, PNG, and WEBP files
up to 5 MB each (20 maximum); uploaded files are stored in R2. Public pages
read the content from `GET /api/content`.

To migrate the existing homepage photo list and About page copy into MongoDB,
run `npm run seed:site-content` from this backend directory. The script only
creates the initial content record and leaves an existing record unchanged.
