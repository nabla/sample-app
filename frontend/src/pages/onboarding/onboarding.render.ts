export function readClientUuid(): string {
  return (
    document.getElementById("client-uuid") as HTMLInputElement
  ).value.trim();
}

export function readHost(): string {
  return (document.getElementById("host") as HTMLInputElement).value.trim();
}

export function restoreClientUuid(uuid: string): void {
  if (!uuid) {
    return;
  }
  (document.getElementById("client-uuid") as HTMLInputElement).value = uuid;
}

export function restoreHost(host: string): void {
  (document.getElementById("host") as HTMLInputElement).value = host;
}

export function setGenerateKeypairLoading(): void {
  const button = document.getElementById(
    "gen-keypair-btn",
  ) as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  button.textContent = "Generating…";
  button.disabled = true;
}

export function resetGenerateKeypairButton(): void {
  const button = document.getElementById(
    "gen-keypair-btn",
  ) as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  button.textContent = "Generate key pair";
  button.disabled = false;
}

export function setGenerateServerTokenLoading(): void {
  const button = document.getElementById(
    "gen-server-token-btn",
  ) as HTMLButtonElement;
  button.textContent = "Generating…";
  button.disabled = true;
}

export function setGenerateServerTokenError(): void {
  const button = document.getElementById(
    "gen-server-token-btn",
  ) as HTMLButtonElement;
  button.textContent = "Error — retry";
  button.disabled = false;
}

export function resetGenerateServerTokenButton(): void {
  const button = document.getElementById(
    "gen-server-token-btn",
  ) as HTMLButtonElement;
  button.textContent = "Regenerate";
  button.disabled = false;
}

export function setProvisionUserLoading(): void {
  const button = document.getElementById("provision-btn") as HTMLButtonElement;
  button.textContent = "Provisioning…";
  button.disabled = true;
}

export function setProvisionUserError(): void {
  const button = document.getElementById("provision-btn") as HTMLButtonElement;
  button.textContent = "Error — retry";
  button.disabled = false;
}

export function resetProvisionUserButton(): void {
  const button = document.getElementById("provision-btn") as HTMLButtonElement;
  button.textContent = "Re-authenticate";
  button.disabled = false;
}

export function showCopyConfirmation(): void {
  const button = document.getElementById(
    "copy-btn",
  ) as HTMLButtonElement | null;
  if (button) {
    button.textContent = "✓ Copied";
  }
}

export function resetCopyButton(): void {
  const button = document.getElementById(
    "copy-btn",
  ) as HTMLButtonElement | null;
  if (button) {
    button.textContent = "Copy public key";
  }
}

export function goToStep(targetStep: number): void {
  document
    .querySelectorAll<HTMLElement>(".step-panel")
    .forEach((panel) => panel.classList.add("hidden"));
  document.getElementById(`step-${targetStep}`)?.classList.remove("hidden");
  document.querySelectorAll("[data-step]").forEach((stepIndicator) => {
    const step = parseInt(stepIndicator.getAttribute("data-step")!, 10);
    const circle = stepIndicator.querySelector<HTMLElement>(".step-circle");
    const label = stepIndicator.querySelector<HTMLElement>(".step-label");
    if (!circle || !label) {
      return;
    }
    if (step < targetStep) {
      circle.className =
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold step-circle bg-success-100 text-success-300";
      circle.textContent = "✓";
      label.className = "text-sm font-medium step-label text-grey-300";
    } else if (step === targetStep) {
      circle.className =
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold step-circle bg-primary-600 text-white";
      circle.textContent = String(step);
      label.className = "text-sm font-medium step-label text-primary-600";
    } else {
      circle.className =
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold step-circle bg-grey-200 text-grey-250";
      circle.textContent = String(step);
      label.className = "text-sm font-medium step-label text-grey-250";
    }
  });
}

export function showKeypairDisplay(publicKeyPem: string): void {
  document.getElementById("keypair-idle")?.classList.add("hidden");
  document.getElementById("keypair-ready")?.classList.remove("hidden");
  document.getElementById("regen-btn")?.classList.remove("hidden");
  const publicKeyDisplay = document.getElementById("public-key-display");
  if (publicKeyDisplay) {
    publicKeyDisplay.textContent = publicKeyPem;
  }
}

export function showServerTokenResponse(): void {
  document.getElementById("server-token-response")?.classList.remove("hidden");
  (document.getElementById("step2-next") as HTMLButtonElement).disabled = false;
}

export function showUserTokenResponse(data: { nabla_user_id?: string }): void {
  document.getElementById("user-token-response")?.classList.remove("hidden");
  const userIdDisplay = document.getElementById("nabla-user-id-display");
  if (userIdDisplay && data.nabla_user_id) {
    userIdDisplay.textContent = data.nabla_user_id;
  }
  document.getElementById("step3-finish")?.classList.remove("hidden");
}
