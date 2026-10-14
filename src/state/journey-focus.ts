let headingFocusPending = false

/** Ask Layout to scroll up and focus the next page's heading after a journey link. */
export function requestHeadingFocus() {
  headingFocusPending = true
}

export function consumeHeadingFocus() {
  const pending = headingFocusPending
  headingFocusPending = false
  return pending
}
