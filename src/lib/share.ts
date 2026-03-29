export async function shareOrCopy(input: { title?: string; text?: string; url: string }) {
  const { title, text, url } = input

  // Prefer native share if available.
  const nav = typeof navigator !== "undefined" ? navigator : null
  if (nav?.share) {
    await nav.share({ title, text, url })
    return { method: "share" as const }
  }

  // Fallback: clipboard copy.
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(url)
    return { method: "copy" as const }
  }

  // Last resort: attempt a prompt-based copy.
  // (Kept for older browsers; no-op in most modern contexts.)
  alert(`Copy this link:\n\n${url}`)
  return { method: "prompt" as const }
}

