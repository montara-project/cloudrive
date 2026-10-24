/**
 * Shared signal between the onboarding wizard and the onboarding gate.
 *
 * The wizard's final step runs *after* the organization is created — but the
 * gate bounces "users with an organization" to the dashboard as soon as the
 * organizations query shows one. While the wizard is on its final step that
 * bounce must be suppressed: the live wizard state (the created org id) only
 * exists in the mounted wizard, and a remount would restart the flow from
 * step 1. The signal is intentionally not reactive storage — it lives exactly
 * as long as the mounted wizard needs it and resets on a full page reload,
 * where the dashboard (with its empty states) is the correct landing spot
 * anyway.
 */
let wizardFinalStepActive = false

export function setWizardFinalStepActive(active: boolean) {
  wizardFinalStepActive = active
}

export function isWizardFinalStepActive() {
  return wizardFinalStepActive
}
