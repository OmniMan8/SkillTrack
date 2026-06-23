# Firebase Security Specification - SkillTrack

This security specification defines the access control policies, data validation invariants, and threat scenarios (the "Dirty Dozen" payloads) for the SkillTrack application's Firebase integration.

## 1. Data Invariants

- **Ownership Consistency**: A learning set document's `userId` must strictly match the authenticated user's `uid` on both creation and modification.
- **Identity Spoofing Prevention**: Users cannot create or update learning sets belonging to other users.
- **Strict Fields**: Learning sets must contain only valid keys (`id`, `userId`, `title`, `description`, `cards`, `createdAt`, `updatedAt`).
- **Data Types & Range Limits**:
  - `id`: String, length <= 128
  - `userId`: String, length <= 128
  - `title`: String, non-empty, length <= 200
  - `description`: String, length <= 2000
  - `cards`: List of maps, size <= 100
  - `createdAt`: String (ISO 8601), length <= 64
  - `updatedAt`: String (ISO 8601), length <= 64

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

Here are 12 specific payloads attempting to break identity, integrity, and state, all of which must be blocked.

### Case 1: Unauthenticated Creation
An unauthenticated user attempts to create a set.
* **Payload**: `{"id": "set1", "userId": "user123", "title": "Math"}`
* **Expected Result**: `PERMISSION_DENIED`

### Case 2: Identity Spoofing (On Create)
Authenticated user `alice` tries to create a set for user `bob`.
* **Payload**: `{"id": "set1", "userId": "bob", "title": "Bob's Set"}`
* **Expected Result**: `PERMISSION_DENIED`

### Case 3: Identity Spoofing (On Update)
Authenticated user `alice` tries to change the ownership of a set.
* **Payload**: `{"id": "set1", "userId": "bob", "title": "Bob's Set"}`
* **Expected Result**: `PERMISSION_DENIED` (cannot mutate `userId`)

### Case 4: Field Injection / Ghost Fields
A user attempts to insert an unmapped field (e.g., `isAdmin: true` or `verified: true`) into a set.
* **Payload**: `{"id": "set1", "userId": "alice", "title": "Math", "isAdmin": true}`
* **Expected Result**: `PERMISSION_DENIED` (strictly matches keys)

### Case 5: Path Variable ID Poisoning
An attacker injects a 1MB string or invalid characters into the document ID path to cause buffer/system stress.
* **Document ID**: `set1_extremely_long_junk_string_with_excessive_character_length_exceeding_any_sensible_limit_and_potentially_causing_wallet_exhaustion_attacks_using_crafted_parameters`
* **Expected Result**: `PERMISSION_DENIED` (ID matches pattern and size limits)

### Case 6: Excessive Title Length (Denial of Wallet)
User attempts to submit a set with a huge title of 100KB to bloat the database storage.
* **Payload**: `{"id": "set1", "userId": "alice", "title": "[100KB of 'A']"}`
* **Expected Result**: `PERMISSION_DENIED` (size check on title)

### Case 7: Invalid Types (Type Poisoning)
User tries to submit a non-string title (e.g. integer or boolean).
* **Payload**: `{"id": "set1", "userId": "alice", "title": 12345}`
* **Expected Result**: `PERMISSION_DENIED` (type is string check)

### Case 8: Missing Required Fields
User attempts to create a set with missing fields.
* **Payload**: `{"id": "set1", "userId": "alice"}` (missing `title`, `cards`, `createdAt`, `updatedAt`)
* **Expected Result**: `PERMISSION_DENIED`

### Case 9: Unauthorized Read of Other's Data
User `bob` attempts to read a document owned by `alice`.
* **Path**: `/sets/set_alice` (where `userId == 'alice'`)
* **Auth**: `request.auth.uid == 'bob'`
* **Expected Result**: `PERMISSION_DENIED`

### Case 10: Unauthorized List Query Scraping
User attempts to fetch all sets in the database without checking their own ownership.
* **Query**: `db.collection('sets')` (missing `where("userId", "==", auth.uid)`)
* **Expected Result**: `PERMISSION_DENIED`

### Case 11: Immutable Timestamp Modification
User attempts to modify `createdAt` during an update.
* **Existing**: `{"createdAt": "2026-06-23T12:00:00Z"}`
* **Payload**: `{"createdAt": "2026-06-23T13:00:00Z"}`
* **Expected Result**: `PERMISSION_DENIED`

### Case 12: Corrupted Cards Format
User attempts to write an invalid type into the `cards` field (e.g. string instead of list).
* **Payload**: `{"id": "set1", "userId": "alice", "title": "Math", "cards": "not_a_list"}`
* **Expected Result**: `PERMISSION_DENIED`

---

## 3. The Test Runner

The tests are conceptually validated to ensure that any security validation matches the above behaviors.
