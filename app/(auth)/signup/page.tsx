// app/(auth)/signup/page.tsx
// Signup uses the same passwordless flow as login, so keep /signup as a
// public alias instead of maintaining a second copy of the form.

export { default } from "../login/page"
