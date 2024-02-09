import { syntaxTree } from "@codemirror/language"
import { RangeSetBuilder } from "@codemirror/state"
import {
  Decoration,
  DecorationSet,
  EditorView,
  PluginValue,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view"
import { SyntaxNodeRef } from "@lezer/common"
import { livePreviewState } from "obsidian"
import { Basetag, PropertyTagSelector } from "./constants"
import { excludeBasetag, getBasename } from "./utils"

class TagRenderPlugin implements PluginValue {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate): void {
    if (
      update.view.composing ||
      update.view.plugin(livePreviewState)?.mousedown
    ) {
      this.decorations = this.decorations.map(update.changes)
    } else if (update.selectionSet || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          // Handle tags in the text region.
          if (node.name.contains("hashtag-end")) {
            if (isInCursorSelection(node, view)) return

            builder.add(
              node.from - 1,
              node.to,
              Decoration.replace({
                widget: new TagWidget(view.state.sliceDoc(node.from, node.to)),
              })
            )
          }

          // Handle tags in frontmatter.
          if (node.name === "hmd-frontmatter") {
            if (isInCursorSelection(node, view)) return

            let frontmatterName = ""
            let currentNode = node.node

            // Go up the nodes to find the name for frontmatter, max 20.
            for (let i = 0; i < 20; i++) {
              currentNode = currentNode.prevSibling ?? node.node
              if (currentNode?.name.contains("atom")) {
                frontmatterName = view.state.sliceDoc(
                  currentNode.from,
                  currentNode.to
                )
                break
              }
            }

            if (
              frontmatterName.toLowerCase() !== "tags" &&
              frontmatterName.toLowerCase() !== "tag"
            )
              return

            const contentNode = node.node
            const tagsArray = view.state
              .sliceDoc(contentNode.from, contentNode.to)
              .split(" ")
              .filter((tag) => tag !== "")

            let index = contentNode.from
            tagsArray.forEach((tag, i) => {
              builder.add(
                index,
                index + tag.length,
                Decoration.replace({
                  widget: new TagWidget(tag),
                })
              )
              index += tag.length + 1
            })
          }
        },
      })
    }

    return builder.finish()
  }
}

export default TagRenderPlugin

/** Create a tag node in the type of widget from text content. */
class TagWidget extends WidgetType {
  constructor(private text: string) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    return createTagNode(this.text)
  }
}

const isInCursorSelection = (node: SyntaxNodeRef, view: EditorView) => {
  const extendedFrom = node.from
  const extendedTo = node.to + 1

  for (const range of view.state.selection.ranges) {
    if (extendedFrom <= range.to && range.from < extendedTo) {
      return true
    }
  }

  return false
}
/**
 * Creates a custom tag node element for the given text (can include #).
 *
 * @param {string} tag - The tag text.
 * @return {HTMLElement} The created tag node element.
 */
export const createTagNode = (tag: string): HTMLElement => {
  const node = document.createElement("a")
  if (!tag) return node

  node.classList.add("tag", Basetag)

  node.target = "_blank"
  node.rel = "noopener"
  node.href = `#${tag}`

  node.textContent = getBasename(tag).replaceAll("#", "")

  return node
}

/**
 * Updates the tags property.
 *
 * @param {string[]} customTagSelectors - Additional custom tag selectors.
 */
export const updatePropertyTagNodes = (customTagSelectors: string[] = []) => {
  document
    .querySelectorAll(
      [PropertyTagSelector, ...(customTagSelectors || [])]
        .map((s) => excludeBasetag(s))
        .join(",")
    )
    .forEach((node: HTMLElement) => {
      const text = node.textContent ?? ""
      node.textContent = getBasename(text)
      node.classList.add(Basetag)
      node.dataset.tag = text
    })
}
