import { Basetag } from "./constants"

export const observe = <T extends HTMLElement>(
  el: T,
  callback: MutationCallback,
  options?: MutationObserverInit
): Unsubscribe => {
  const observer = new MutationObserver(callback)
  observer.observe(el, options)
  return () => observer.disconnect()
}

export type Unsubscribe = () => void

export const getBasename = (tag: string) => tag.slice(tag.lastIndexOf("/") + 1)
export const excludeBasetag = (selector: string) => `${selector}:not(.${Basetag})`

