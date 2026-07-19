import { createSignal, Show } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { usePlatform } from "@/context/platform"

export function DialogProxySetup() {
  const dialog = useDialog()
  const platform = usePlatform()
  const [password, setPassword] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [status, setStatus] = createSignal<{ ok: boolean; message: string } | null>(null)
  const [proxyStatus, setProxyStatus] = createSignal<{ configured: boolean; url: string | null } | null>(null)

  void platform().getProxyStatus?.().then(setProxyStatus)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    const exchange = platform().exchangeAdminPassword
    if (!exchange) {
      setStatus({ ok: false, message: "Proxy setup is only available in the desktop app." })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const result = await exchange(password())
      setStatus({ ok: result.ok, message: result.ok ? "Proxy configured." : result.error })
      if (result.ok) setProxyStatus(await platform().getProxyStatus!())
    } catch (e) {
      setStatus({ ok: false, message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    await platform().clearProxyConfig?.()
    setProxyStatus({ configured: false, url: null })
    setStatus(null)
  }

  return (
    <Dialog size="medium" class="w-[420px]">
      <div class="flex flex-col gap-4 p-5">
        <h2 class="text-16-medium text-text-strong">Proxy</h2>

        <Show when={proxyStatus()?.configured}>
          <div class="flex flex-col gap-2 p-3 bg-surface-base rounded-lg">
            <p class="text-14-regular text-text-base">
              Proxy configured via <span class="text-text-strong">{proxyStatus()!.url}</span>.
            </p>
            <p class="text-12-regular text-text-weak">Restart required for changes to take effect.</p>
            <button
              type="button"
              class="text-14-regular text-danger-base hover:text-danger-strong cursor-pointer bg-transparent border-none p-0 self-start"
              onClick={handleClear}
            >
              Clear proxy configuration
            </button>
          </div>
        </Show>

        <Show when={!proxyStatus()?.configured}>
          <form onSubmit={handleSubmit} class="flex flex-col gap-3">
            <p class="text-14-regular text-text-base">
              Enter the admin password to enable API key rotation and rate-limit fallback.
            </p>
            <input
              type="password"
              placeholder="Admin password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              disabled={busy()}
              class="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-base text-text-strong text-14-regular placeholder:text-text-weak outline-none focus:border-border-strong"
            />
            <Show when={status()}>
              {(s) => (
                <p
                  class="text-14-regular"
                  classList={{ "text-danger-base": !s().ok, "text-success-base": s().ok }}
                >
                  {s().message}
                </p>
              )}
            </Show>
            <div class="flex gap-2 justify-end">
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-surface-base border border-border-base text-text-strong text-14-regular cursor-pointer hover:bg-surface-hover"
                onClick={() => dialog.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy()}
                class="px-4 py-2 rounded-lg bg-accent-base text-white text-14-regular cursor-pointer disabled:opacity-50 hover:bg-accent-hover"
              >
                {busy() ? "Connecting..." : "Connect"}
              </button>
            </div>
          </form>
        </Show>

        <Show when={proxyStatus()?.configured}>
          <div class="flex justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-surface-base border border-border-base text-text-strong text-14-regular cursor-pointer hover:bg-surface-hover"
              onClick={() => dialog.close()}
            >
              Close
            </button>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}
