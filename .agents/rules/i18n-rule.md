---
description: Enforce internationalization (i18n) for all user-facing text — EN, ES, pt-BR
---

# Internationalization (i18n) Rule

## Purpose

All user-facing text must be translated using `react-i18next`. No hardcoded strings in components. The app supports three languages: **English (en)**, **Spanish (es)**, and **Brazilian Portuguese (pt-BR)**.

## Rules

### 1. No Hardcoded Strings

```tsx
// ❌ WRONG — Hardcoded text
<h1>Welcome to the dashboard</h1>
<button>Save Changes</button>

// ✅ CORRECT — i18n keys
<h1>{t('dashboard.welcome')}</h1>
<button>{t('common.save')}</button>
```

### 2. Use the `useTranslation` Hook

Every component with user-facing text must use:

```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();
  return <p>{t("namespace.key")}</p>;
}
```

### 3. Translation File Structure

Translations live in `src/i18n/locales/`:

```
src/i18n/locales/
├── en.json      # English (default)
├── es.json      # Spanish
└── pt-br.json   # Brazilian Portuguese
```

### 4. Key Naming Convention

Use dot-notation namespaces:

```json
{
  "auth": {
    "signIn": "Sign In",
    "signUp": "Sign Up",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot Password?",
    "resetPassword": "Reset Password",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?"
  },
  "profile": {
    "title": "My Profile",
    "fullName": "Full Name",
    "phone": "Phone"
  },
  "settings": {
    "title": "Settings",
    "saved": "Settings saved successfully"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "An error occurred",
    "success": "Success",
    "confirm": "Confirm",
    "back": "Back"
  },
  "validation": {
    "required": "This field is required",
    "invalidEmail": "Invalid email address",
    "passwordMin": "Password must be at least {{min}} characters",
    "passwordMatch": "Passwords do not match"
  },
  "tenant": {
    "switch": "Switch Organization",
    "settings": "Organization Settings",
    "name": "Organization Name",
    "members": "Members"
  }
}
```

### 5. Interpolation

Use named interpolation for dynamic values:

```tsx
// Translation: "Welcome, {{name}}!"
t("dashboard.welcomeUser", { name: user.full_name });

// Translation: "Password must be at least {{min}} characters"
t("validation.passwordMin", { min: 8 });
```

### 6. All Three Locales Required

When adding a new key:

- [ ] Add to `en.json`
- [ ] Add to `es.json`
- [ ] Add to `pt-br.json`

Missing keys in any locale file is a **violation**.

### 7. Edge Function Errors

Error messages from Edge Functions should return error **codes** (not translated text). The frontend translates error codes:

```typescript
// Edge Function returns:
{ success: false, error: { message: "Email already exists", code: "CONFLICT" } }

// Frontend translates:
t(`errors.${errorCode}`) // errors.CONFLICT → "This email is already in use"
```

### 8. Date/Number Formatting

Use `Intl` APIs or i18next formatting for locale-aware dates and numbers:

```tsx
new Intl.DateTimeFormat(i18n.language).format(date);
new Intl.NumberFormat(i18n.language).format(number);
```
