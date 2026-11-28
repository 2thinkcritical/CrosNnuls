/**
 * Finds a required element and checks its type, failing loudly if the markup changed.
 * @template {Element} T
 * @param {string} selector
 * @param {new () => T} type
 * @param {ParentNode} [root]
 * @returns {T}
 */
export function element(selector, type, root = document) {
  const node = root.querySelector(selector);
  if (!(node instanceof type)) throw new Error(`Missing ${selector}`);
  return node;
}
